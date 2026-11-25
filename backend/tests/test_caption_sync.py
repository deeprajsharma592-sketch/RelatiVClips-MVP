import struct
import tempfile
import wave
from pathlib import Path
from unittest.mock import patch

from backend.captioning.ass_builder import build_ass, normalize_words
from backend.captioning.sync import _detect_speech_intervals, _energy_align_words, sync_clip_captions_to_audio


def _write_speech_wav(path: Path, silence_s: float, tone_s: float, tail_s: float = 0.5, sr: int = 16000) -> None:
    """Create a 16kHz mono PCM WAV with silence -> 440Hz speech-like burst -> silence."""
    import math

    n_sil = int(silence_s * sr)
    n_tone = int(tone_s * sr)
    n_tail = int(tail_s * sr)
    samples = [0] * n_sil
    for i in range(n_tone):
        samples.append(int(12000 * math.sin(2.0 * math.pi * 220.0 * i / sr)))
    samples.extend([0] * n_tail)

    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(struct.pack(f"<{len(samples)}h", *samples))


def test_detect_speech_intervals_and_energy_align():
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / "test.wav"
        _write_speech_wav(wav_path, silence_s=1.5, tone_s=2.0, tail_s=0.5)

        intervals, dur = _detect_speech_intervals(wav_path)
        assert dur >= 3.9
        assert len(intervals) == 1
        assert abs(intervals[0][0] - 1.5) < 0.1

        # Words originally started at 0.2s (1.3s early due to keyframe snap)
        words = [
            {"w": "Hello", "start": 0.2, "end": 0.6, "emph": 0},
            {"w": "world", "start": 0.6, "end": 1.1, "emph": 0},
        ]
        aligned = _energy_align_words(words, wav_path, clip_duration=4.0)
        assert abs(aligned[0]["start"] - 1.5) < 0.1
        assert abs(aligned[1]["start"] - 1.9) < 0.1


def test_sync_clip_captions_prefers_whisper_when_available():
    with tempfile.TemporaryDirectory() as tmp:
        media = Path(tmp) / "clip.mp4"
        media.write_bytes(b"fake")
        wav_path = Path(tmp) / "sync.wav"
        _write_speech_wav(wav_path, silence_s=0.5, tone_s=1.5)

        clip = {"start": 42.0, "end": 46.0, "caption": "fallback"}
        whisper_words = [{"w": "Exact", "start": 0.52, "end": 0.88, "emph": 0}]

        with (
            patch("backend.utils.config.TEMP_DIR", Path(tmp), create=True),
            patch("backend.captioning.sync._extract_sync_wav", return_value=wav_path),
            patch("backend.captioning.sync._transcribe_wav_words", return_value=whisper_words),
        ):
            mode = sync_clip_captions_to_audio(clip, media, "t1", 1, start_s=0.0, duration_s=4.0)

        assert mode == "whisper_audio"
        assert clip["caption_words_relative"] is True
        assert clip["words"] == whisper_words
        normalized = normalize_words(clip)
        assert normalized[0]["start"] == 0.52


def _ass_ts_to_s(ts: str) -> float:
    h, m, rest = ts.split(":")
    s, cs = rest.split(".")
    return int(h) * 3600 + int(m) * 60 + int(s) + int(cs) / 100.0


def test_build_ass_never_overlaps_dialogue_lines():
    with tempfile.TemporaryDirectory() as tmp:
        ass_path = Path(tmp) / "no_overlap.ass"
        clip = {
            "start": 0.0,
            "end": 5.0,
            "caption_words_relative": True,
            "words": [
                {"w": "real", "start": 0.00, "end": 0.25, "emph": 0},
                {"w": "quick?", "start": 0.26, "end": 0.50, "emph": 0},
                {"w": "Sure.", "start": 0.52, "end": 0.90, "emph": 0},
                {"w": "Yeah.", "start": 0.92, "end": 1.30, "emph": 0},
            ],
        }
        build_ass(clip, ass_path, {"preset": "impact", "overrides": {"position_mode": "mid"}})
        dialogues = [l for l in ass_path.read_text(encoding="utf-8").splitlines() if l.startswith("Dialogue:")]
        assert len(dialogues) == 4
        intervals = [(_ass_ts_to_s(d.split(",", 9)[1]), _ass_ts_to_s(d.split(",", 9)[2])) for d in dialogues]
        for (s1, e1), (s2, e2) in zip(intervals, intervals[1:]):
            assert e1 <= s2 + 1e-6, f"Overlapping Dialogue events: ({s1}, {e1}) vs ({s2}, {e2})"


def test_build_ffmpeg_command_trims_before_ass_filter():
    import sys
    import types

    cv2_stub = types.ModuleType("cv2")
    class _Cap:
        def __init__(self, *a): pass
        def get(self, prop): return 1920 if prop == 3 else (1080 if prop == 4 else 30.0)
        def release(self): pass
    cv2_stub.VideoCapture = _Cap
    cv2_stub.CAP_PROP_FRAME_WIDTH = 3
    cv2_stub.CAP_PROP_FRAME_HEIGHT = 4
    cv2_stub.CAP_PROP_FPS = 5

    with tempfile.TemporaryDirectory() as tmp:
        ass_path = Path(tmp) / "sub.ass"
        ass_path.write_text("[Script Info]\n" + "x" * 60, encoding="utf-8")
        with patch.dict(sys.modules, {"cv2": cv2_stub}):
            from backend.pipeline.renderer import build_ffmpeg_command
            cmd = build_ffmpeg_command(
                video_path=str(Path(tmp) / "seg.mp4"),
                output_path=str(Path(tmp) / "out.mp4"),
                clip_start=10.0,
                clip_end=70.0,
                x_offset=0,
                subtitle_path=str(ass_path),
            )

    i_idx = cmd.index("-i")
    assert cmd[i_idx - 2 : i_idx] == ["-ss", "5.000"]
    assert "-ss" not in cmd[i_idx + 1:], "Output-side -ss shifts ASS captions early by fine_seek"
    vf = cmd[cmd.index("-vf") + 1]
    af = cmd[cmd.index("-af") + 1]
    assert vf.startswith("trim=start=5.000:duration=60.000,setpts=PTS-STARTPTS,")
    assert vf.index("setpts=PTS-STARTPTS") < vf.index("ass='")
    assert af.startswith("atrim=start=5.000:duration=60.000,asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0,")


def test_infer_clip_language_locks_hindi_and_english():
    from backend.captioning.sync import _infer_clip_language

    assert _infer_clip_language({"caption": "तो यह ओलेड है"}) == "hi"
    assert _infer_clip_language({"language": "hi-IN", "caption": "hello"}) == "hi"
    assert _infer_clip_language({"language": "en-US", "caption": "hello"}) == "en"
    assert _infer_clip_language({"transcript": {"language": "hi"}}) == "hi"
    assert _infer_clip_language({"caption": "plain english"}) is None
