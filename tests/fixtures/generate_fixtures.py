"""
Synthetic Test Fixture Generator for Dynamic Framing Test Suite (spec-0.1).
Generates:
- F01: Single talking head, static camera
- F02: Single presenter who moves around
- F03: Two-person podcast, alternating long turns
- F04: Two-person fast banter
- F05: Two-person, one long monologue
- F06: Overlapping speech and shared laughter
- F07: Frequent backchannels
- F08: Voice-over or off-screen speaker with visible face
- F15: Phone footage (VFR + rotation metadata + odd dimensions)
Also writes ground-truth label JSON files to tests/labels/*.json.
"""

from __future__ import annotations

import os
import json
import shutil
import subprocess
from pathlib import Path
import cv2
import numpy as np
import scipy.io.wavfile as wavfile

from framing.config import get_binary_paths


def get_head_assets(assets_dir: Path) -> tuple[np.ndarray, np.ndarray]:
    """Returns (head_closed, head_open) for realistic face detection and MAR variation."""
    assets_dir.mkdir(parents=True, exist_ok=True)
    closed_path = assets_dir / "head_closed.png"
    open_path = assets_dir / "head_open.png"

    if closed_path.exists() and open_path.exists():
        return cv2.imread(str(closed_path)), cv2.imread(str(open_path))

    # Base template
    tmpl_path = assets_dir / "head_template.png"
    if tmpl_path.exists():
        head = cv2.imread(str(tmpl_path))
    else:
        src_img = "/Users/deeprajsharma/.gemini/antigravity/brain/184c9618-95ca-4753-9f97-2b04d9baeebe/.user_uploaded/media_1794504288064_ef245eea.jpg"
        if os.path.exists(src_img):
            img = cv2.imread(src_img)
            head = img[0:180, 240:420]
        else:
            head = np.full((180, 180, 3), (200, 200, 200), dtype=np.uint8)
            cv2.circle(head, (90, 90), 80, (180, 150, 120), -1)

    cv2.imwrite(str(closed_path), head)

    # Create open-mouth variant
    h, w = head.shape[:2]
    head_open = head.copy()
    shift = 8
    head_open[83+shift:h] = head[83:h-shift]
    head_open[81:83+shift, 75:102] = (30, 20, 20)
    cv2.imwrite(str(open_path), head_open)

    return head, head_open


def generate_speech_timeline(
    turns: list[dict],
    duration_s: float,
    output_wav: Path,
    sr: int = 16000
) -> Path:
    """Generates natural spoken voice timeline matching turn intervals."""
    total_samples = int(duration_s * sr)
    timeline = np.zeros(total_samples, dtype=np.float32)

    has_say = bool(shutil.which("say"))
    bins = get_binary_paths()

    temp_dir = output_wav.parent / "temp_audio_gen"
    temp_dir.mkdir(parents=True, exist_ok=True)

    phrases = {
        "P1": ["Good morning everyone and welcome to the show.", "Let us talk about deep neural networks and dynamic camera framing."],
        "P2": ["Thanks for having me here today.", "I completely agree with that perspective and would like to add more details."],
        "offscreen": ["Attention please, this is a narration from the studio offscreen."],
    }

    voice_map = {
        "P1": "Alex",
        "P2": "Victoria",
        "offscreen": "Fred",
    }

    for idx, turn in enumerate(turns):
        spk = turn.get("speaker")
        if spk == "silence" or spk == "unknown":
            continue

        start_s = float(turn["start_s"])
        end_s = float(turn["end_s"])
        turn_dur = end_s - start_s
        if turn_dur <= 0:
            continue

        s_sample = max(0, int(round(start_s * sr)))
        e_sample = min(total_samples, int(round(end_s * sr)))
        needed_samples = e_sample - s_sample
        if needed_samples <= 0:
            continue

        turn_samples = None
        if has_say:
            voice = voice_map.get(spk, "Alex")
            phrase_list = phrases.get(spk, ["Here is the spoken turn content."])
            phrase = phrase_list[idx % len(phrase_list)]
            temp_aiff = temp_dir / f"turn_{idx}.aiff"
            temp_turn_wav = temp_dir / f"turn_{idx}.wav"

            try:
                subprocess.run(["say", "-v", voice, phrase, "-o", str(temp_aiff)], check=True, capture_output=True)
                subprocess.run([bins["ffmpeg"], "-y", "-i", str(temp_aiff), "-ar", str(sr), "-ac", "1", str(temp_turn_wav)], check=True, capture_output=True)

                _, data = wavfile.read(str(temp_turn_wav))
                if data.dtype == np.int16:
                    raw_float = data.astype(np.float32) / 32768.0
                else:
                    raw_float = data.astype(np.float32)

                # Loop or trim to exactly needed_samples
                if len(raw_float) < needed_samples:
                    repeats = int(np.ceil(needed_samples / len(raw_float)))
                    turn_samples = np.tile(raw_float, repeats)[:needed_samples]
                else:
                    turn_samples = raw_float[:needed_samples]

                if temp_aiff.exists(): temp_aiff.unlink()
                if temp_turn_wav.exists(): temp_turn_wav.unlink()
            except Exception as e:
                turn_samples = None

        if turn_samples is None:
            # Fallback synthetic formant wave
            t = np.linspace(0, turn_dur, needed_samples, endpoint=False)
            f0 = 150.0 if spk == "P1" else 220.0
            turn_samples = (
                np.sin(2 * np.pi * f0 * t) +
                0.7 * np.sin(2 * np.pi * (2 * f0) * t) +
                0.4 * np.sin(2 * np.pi * (4 * f0) * t)
            ).astype(np.float32) * np.clip(np.sin(2 * np.pi * 3.5 * t), 0, 1)

        # Apply smooth ramp at boundaries
        ramp_len = min(sr // 50, needed_samples // 4)
        if ramp_len > 0:
            turn_samples[:ramp_len] *= np.linspace(0, 1, ramp_len)
            turn_samples[-ramp_len:] *= np.linspace(1, 0, ramp_len)

        timeline[s_sample:e_sample] += turn_samples

    if temp_dir.exists():
        shutil.rmtree(temp_dir, ignore_errors=True)

    # Normalize volume
    peak = np.max(np.abs(timeline))
    if peak > 0:
        int_data = (timeline / peak * 28000).astype(np.int16)
    else:
        int_data = np.zeros(total_samples, dtype=np.int16)

    wavfile.write(str(output_wav), sr, int_data)
    return output_wav


def mux_video_and_audio(raw_video: Path, wav_path: Path, output_mp4: Path):
    bins = get_binary_paths()
    cmd = [
        bins["ffmpeg"], "-y",
        "-i", str(raw_video),
        "-i", str(wav_path),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-ar", "48000",
        "-shortest",
        str(output_mp4),
    ]
    subprocess.run(cmd, capture_output=True, check=True, timeout=30)
    if raw_video.exists(): raw_video.unlink()
    if wav_path.exists(): wav_path.unlink()


def generate_podcast_fixture(
    fixture_id: str,
    output_mp4: Path,
    labels_path: Path,
    duration_s: float,
    speaker_turns: list[dict],
    visible_faces: list[str] = ["P1", "P2"],
    fps: int = 30,
) -> Path:
    """Generates synthetic 2-person podcast video with synchronous speech audio & MAR animation."""
    output_mp4 = Path(output_mp4)
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    labels_path = Path(labels_path)
    labels_path.parent.mkdir(parents=True, exist_ok=True)

    head_closed, head_open = get_head_assets(output_mp4.parent)
    head_c = cv2.resize(head_closed, (300, 300))
    head_o = cv2.resize(head_open, (300, 300))

    wav_path = output_mp4.parent / f"temp_{fixture_id}.wav"
    generate_speech_timeline(speaker_turns, duration_s, wav_path)

    raw_video = output_mp4.parent / f"temp_{fixture_id}_raw.mp4"
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(raw_video), fourcc, fps, (1920, 1080))

    total_frames = int(round(duration_s * fps))
    for f in range(total_frames):
        t = f / fps
        frame = np.full((1080, 1920, 3), (225, 225, 225), dtype=np.uint8)

        # Check who is speaking
        p1_speaking = any(st["start_s"] <= t <= st["end_s"] and st["speaker"] == "P1" for st in speaker_turns)
        p2_speaking = any(st["start_s"] <= t <= st["end_s"] and st["speaker"] == "P2" for st in speaker_turns)

        # 3.1 Hz natural syllable cadence (avoids 4.0 Hz stroboscopic aliasing with 8 fps detector)
        cycle = (t * 3.1) % 1.0
        mouth_open = cycle < 0.50

        # P1 (left face: x=320, y=200)
        if "P1" in visible_faces:
            p1_img = head_o if (p1_speaking and mouth_open) else head_c
            frame[200:500, 320:620] = p1_img

        # P2 (right face: x=1300, y=200)
        if "P2" in visible_faces:
            p2_img = head_o if (p2_speaking and mouth_open) else head_c
            frame[200:500, 1300:1600] = p2_img

        out.write(frame)
    out.release()

    mux_video_and_audio(raw_video, wav_path, output_mp4)

    # Write ground-truth label
    label_data = {
        "fixture_id": fixture_id,
        "clip": output_mp4.name,
        "duration_s": duration_s,
        "speaker_intervals": speaker_turns,
    }
    with open(labels_path, "w", encoding="utf-8") as f:
        json.dump(label_data, f, indent=2)

    return output_mp4


def generate_all_fixtures(fixtures_dir: Path, labels_dir: Path):
    fixtures_dir = Path(fixtures_dir)
    labels_dir = Path(labels_dir)

    # F03: Two-person podcast, alternating long turns
    generate_podcast_fixture(
        fixture_id="F03",
        output_mp4=fixtures_dir / "F03.mp4",
        labels_path=labels_dir / "F03.json",
        duration_s=5.0,
        speaker_turns=[
            {"start_s": 0.0, "end_s": 2.5, "speaker": "P1"},
            {"start_s": 2.5, "end_s": 5.0, "speaker": "P2"},
        ],
    )

    # F04: Two-person fast banter (alternating every 1.2s)
    generate_podcast_fixture(
        fixture_id="F04",
        output_mp4=fixtures_dir / "F04.mp4",
        labels_path=labels_dir / "F04.json",
        duration_s=4.8,
        speaker_turns=[
            {"start_s": 0.0, "end_s": 1.2, "speaker": "P1"},
            {"start_s": 1.2, "end_s": 2.4, "speaker": "P2"},
            {"start_s": 2.4, "end_s": 3.6, "speaker": "P1"},
            {"start_s": 3.6, "end_s": 4.8, "speaker": "P2"},
        ],
    )

    # F05: Two-person, one long monologue (P1 speaks entire time)
    generate_podcast_fixture(
        fixture_id="F05",
        output_mp4=fixtures_dir / "F05.mp4",
        labels_path=labels_dir / "F05.json",
        duration_s=5.0,
        speaker_turns=[
            {"start_s": 0.0, "end_s": 5.0, "speaker": "P1"},
        ],
    )

    # F06: Overlapping speech and shared laughter (P1 and P2 overlap between 2.0s and 3.2s)
    generate_podcast_fixture(
        fixture_id="F06",
        output_mp4=fixtures_dir / "F06.mp4",
        labels_path=labels_dir / "F06.json",
        duration_s=5.0,
        speaker_turns=[
            {"start_s": 0.0, "end_s": 3.2, "speaker": "P1"},
            {"start_s": 2.0, "end_s": 5.0, "speaker": "P2"},
        ],
    )

    # F07: Frequent backchannels (P1 monologue with P2 saying 0.4s backchannel at 2.0s)
    generate_podcast_fixture(
        fixture_id="F07",
        output_mp4=fixtures_dir / "F07.mp4",
        labels_path=labels_dir / "F07.json",
        duration_s=5.0,
        speaker_turns=[
            {"start_s": 0.0, "end_s": 5.0, "speaker": "P1"},
            {"start_s": 2.0, "end_s": 2.4, "speaker": "P2"},
        ],
    )

    # F08: Voice-over or off-screen speaker with visible face (Face P1 visible but silent; offscreen speaks)
    generate_podcast_fixture(
        fixture_id="F08",
        output_mp4=fixtures_dir / "F08.mp4",
        labels_path=labels_dir / "F08.json",
        duration_s=4.0,
        visible_faces=["P1"],
        speaker_turns=[
            {"start_s": 0.5, "end_s": 3.5, "speaker": "offscreen"},
        ],
    )


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent
    root_dir = base_dir.parent.parent
    f_dir = base_dir
    l_dir = root_dir / "tests" / "labels"
    generate_all_fixtures(f_dir, l_dir)
    print("All fixtures F03-F08 and labels successfully generated.")
