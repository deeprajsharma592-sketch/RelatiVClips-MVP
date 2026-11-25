import json
import re
import subprocess
from pathlib import Path

from backend.captioning.ass_builder import build_ass, normalize_words
from backend.pipeline.renderer import build_ffmpeg_command
from backend.utils import ytagent_downloader as adapter
from backend.utils.config import FFMPEG_PATH, FFPROBE_PATH


def _ass_time_to_seconds(ts: str) -> float:
    h, m, rest = ts.split(":")
    s, cs = rest.split(".")
    return int(h) * 3600 + int(m) * 60 + int(s) + int(cs) / 100.0


def _ffprobe_streams(path: Path) -> dict:
    res = subprocess.run(
        [
            FFPROBE_PATH,
            "-v", "error",
            "-show_entries", "stream=codec_type,start_time,duration",
            "-show_entries", "format=start_time,duration",
            "-of", "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(res.stdout)


def test_normalize_words_rebases_absolute_transcript_to_clip_zero():
    clip = {
        "start": 155.0,
        "end": 165.0,
        "transcript": {
            "segments": [
                {
                    "start": 155.2,
                    "end": 158.0,
                    "text": "First spoken sentence",
                    "words": [
                        {"word": "First", "start": 155.20, "end": 155.80},
                        {"word": "spoken", "start": 155.85, "end": 156.40},
                        {"word": "sentence", "start": 156.45, "end": 157.20},
                    ],
                },
                {
                    "start": 160.0,
                    "end": 162.0,
                    "text": "Second phrase",
                    "words": [
                        {"word": "Second", "start": 160.00, "end": 160.60},
                        {"word": "phrase", "start": 160.65, "end": 161.40},
                    ],
                },
            ]
        },
    }
    words = normalize_words(clip)
    assert [w["w"] for w in words] == ["First", "spoken", "sentence", "Second", "phrase"]
    assert abs(words[0]["start"] - 0.20) < 1e-3
    assert abs(words[0]["end"] - 0.80) < 1e-3
    assert abs(words[3]["start"] - 5.00) < 1e-3
    assert abs(words[4]["end"] - 6.40) < 1e-3


def test_normalize_words_preserves_already_relative_editor_words():
    clip = {
        "start": 155.0,
        "end": 165.0,
        "words": [
            {"w": "Already", "start": 0.30, "end": 0.90},
            {"w": "relative", "start": 0.95, "end": 1.60},
        ],
    }
    words = normalize_words(clip)
    assert len(words) == 2
    assert abs(words[0]["start"] - 0.30) < 1e-3
    assert abs(words[1]["end"] - 1.60) < 1e-3


def test_build_ass_places_dialogue_at_exact_clip_timestamps(tmp_path: Path):
    ass_path = tmp_path / "sync_check.ass"
    clip = {
        "start": 155.0,
        "end": 165.0,
        "caption_font": "impact",
        "transcript": {
            "segments": [
                {
                    "start": 155.5,
                    "end": 157.0,
                    "words": [
                        {"word": "Watch", "start": 155.50, "end": 156.00},
                        {"word": "this", "start": 156.00, "end": 156.50},
                    ],
                },
                {
                    "start": 160.0,
                    "end": 161.2,
                    "words": [
                        {"word": "Boom", "start": 160.00, "end": 161.00},
                    ],
                },
            ]
        },
    }
    res = build_ass(clip, ass_path)
    assert res["path"] == str(ass_path)
    dialogue_lines = [
        line for line in ass_path.read_text(encoding="utf-8").splitlines()
        if line.startswith("Dialogue:")
    ]
    assert len(dialogue_lines) >= 2

    # First word group starts at 155.50 - 155.00 = 0.50s
    first_fields = dialogue_lines[0].split(",", 9)
    assert abs(_ass_time_to_seconds(first_fields[1]) - 0.50) <= 0.02

    # Second word group ("BOOM") starts at 160.00 - 155.00 = 5.00s
    boom_line = next(l for l in dialogue_lines if "BOOM" in l)
    boom_fields = boom_line.split(",", 9)
    assert abs(_ass_time_to_seconds(boom_fields[1]) - 5.00) <= 0.02


def test_ffmpeg_mid_gop_slice_and_render_keep_zero_sync_drift(monkeypatch, tmp_path: Path):
    """End-to-end FFmpeg verification:
    1. Generate a 22s 720p video with 2s GOP (-g 60 @ 30fps) so 9.0s is mid-GOP.
    2. Slice [9.0s, 21.0s] via ytagent_downloader.download_segment (duration=12.0s).
    3. Verify via ffprobe that sliced segment is ~12.0s (no 2s keyframe snap drift)
       and both streams start at ~0.000s.
    4. Generate ASS captions for clip [11.0s, 19.0s] (rel_start=2.0s, duration=8.0s)
       and render via build_ffmpeg_command.
    5. Verify final output duration is ~8.0s and streams start at ~0.000s.
    """
    source_mp4 = tmp_path / "source_22s.mp4"
    subprocess.run(
        [
            FFMPEG_PATH, "-y",
            "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=22",
            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=22",
            "-c:v", "libx264", "-preset", "ultrafast", "-g", "60", "-keyint_min", "60",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
            str(source_mp4),
        ],
        capture_output=True,
        check=True,
        timeout=60,
    )

    monkeypatch.setattr(
        adapter,
        "download_high_quality_source",
        lambda url, log=None: {"path": str(source_mp4), "video_id": "test123", "method": "cache"},
    )

    sliced_mp4 = tmp_path / "sliced_9_21.mp4"
    adapter.download_segment("https://youtu.be/test123", sliced_mp4, start=9.0, end=21.0)
    assert sliced_mp4.exists()

    sliced_probe = _ffprobe_streams(sliced_mp4)
    sliced_dur = float(sliced_probe["format"]["duration"])
    # Before the fix (-c copy), -ss 9.0 snapped back to keyframe at 8.0s (duration ~13.0s).
    # With hybrid seek + re-encode, duration must be accurate to 12.0s within 0.15s.
    assert abs(sliced_dur - 12.0) < 0.15, f"Expected ~12.0s slice, got {sliced_dur:.3f}s"
    for stream in sliced_probe["streams"]:
        st = float(stream.get("start_time", 0.0))
        assert abs(st) < 0.08, f"Stream {stream['codec_type']} start_time drifted: {st}"

    # Now build ASS captions for clip [11.0s, 19.0s] -> rel_start = 2.0s, duration = 8.0s
    ass_path = tmp_path / "clip.ass"
    clip = {
        "start": 11.0,
        "end": 19.0,
        "caption_font": "impact",
        "transcript": {
            "segments": [
                {
                    "start": 11.5,
                    "end": 13.0,
                    "words": [
                        {"word": "Synced", "start": 11.50, "end": 12.20},
                        {"word": "right", "start": 12.20, "end": 12.80},
                    ],
                }
            ]
        },
    }
    build_ass(clip, ass_path)

    final_mp4 = tmp_path / "final_clip.mp4"
    cmd = build_ffmpeg_command(
        str(sliced_mp4),
        str(final_mp4),
        clip_start=2.0,
        clip_end=10.0,
        x_offset=640,
        subtitle_path=str(ass_path),
    )
    subprocess.run(cmd, capture_output=True, check=True, timeout=60)
    assert final_mp4.exists() and final_mp4.stat().st_size > 10_000

    final_probe = _ffprobe_streams(final_mp4)
    final_dur = float(final_probe["format"]["duration"])
    assert abs(final_dur - 8.0) < 0.15, f"Expected ~8.0s final clip, got {final_dur:.3f}s"
    for stream in final_probe["streams"]:
        st = float(stream.get("start_time", 0.0))
        assert abs(st) < 0.08, f"Final {stream['codec_type']} start_time drifted: {st}"

    # Verify ASS timestamp matches 0.50s (11.50 - 11.00)
    dialogue_lines = [
        l for l in ass_path.read_text(encoding="utf-8").splitlines()
        if l.startswith("Dialogue:")
    ]
    assert dialogue_lines
    first_start = _ass_time_to_seconds(dialogue_lines[0].split(",", 9)[1])
    assert abs(first_start - 0.50) <= 0.02
