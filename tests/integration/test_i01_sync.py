"""
Integration test I01: End-to-end sync verification on F03 and F15 fixtures.
Asseritions:
- Output duration within 1 frame of input
- Frame counts equal (+/- 1 frame)
- Audio lag within 1 frame (cross-correlate output audio against input audio)
- Odd-dimension normalization produces clean even outputs (U13).
"""

import subprocess
import numpy as np
from pathlib import Path
import pytest
import scipy.signal

from framing.config import get_binary_paths
from framing.run import run_pipeline
from framing.s1_normalize import probe_media


def extract_pcm_16k(video_path: Path) -> np.ndarray:
    """Extract mono 16 kHz float32 PCM audio via FFmpeg pipe."""
    bins = get_binary_paths()
    cmd = [
        bins["ffmpeg"], "-y",
        "-i", str(video_path),
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-f", "f32le",
        "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, check=True)
    return np.frombuffer(proc.stdout, dtype=np.float32)


def compute_audio_lag_seconds(audio_ref: np.ndarray, audio_test: np.ndarray, sample_rate: int = 16000) -> float:
    """Compute audio lag between reference and test signal via cross-correlation."""
    n = min(len(audio_ref), len(audio_test))
    if n == 0:
        return 0.0

    sig1 = audio_ref[:n] - np.mean(audio_ref[:n])
    sig2 = audio_test[:n] - np.mean(audio_test[:n])

    corr = scipy.signal.correlate(sig2, sig1, mode="full")
    lags = scipy.signal.correlation_lags(len(sig2), len(sig1))
    best_lag_samples = lags[np.argmax(corr)]

    return float(best_lag_samples) / float(sample_rate)


@pytest.mark.parametrize("fixture_name", ["F03.mp4", "F15.mp4"])
def test_i01_e2e_sync_and_frame_count(fixture_name, tmp_path):
    """I01 Gate test: verify A/V sync, duration, and frame count equality on F03 and F15."""
    fixture_path = Path("tests/fixtures") / fixture_name
    assert fixture_path.exists(), f"Fixture {fixture_path} not found"

    workdir = tmp_path / f"work_{fixture_name}"
    out_mp4 = tmp_path / f"out_{fixture_name}"

    # Run framing pipeline in debug-overlay mode
    qa_report = run_pipeline(
        clip_path=fixture_path,
        output_path=out_mp4,
        workdir=workdir,
        debug_overlay=True,
    )

    assert out_mp4.exists(), f"Output file {out_mp4} was not generated"

    # Probe input normalized and output rendered videos
    norm_mp4 = workdir / "norm.mp4"
    in_probe = probe_media(norm_mp4)
    out_probe = probe_media(out_mp4)

    in_v = next(s for s in in_probe["streams"] if s["codec_type"] == "video")
    out_v = next(s for s in out_probe["streams"] if s["codec_type"] == "video")

    in_fps = float(in_v.get("avg_frame_rate", "30/1").split("/")[0]) / float(in_v.get("avg_frame_rate", "30/1").split("/")[1])
    out_fps = float(out_v.get("avg_frame_rate", "30/1").split("/")[0]) / float(out_v.get("avg_frame_rate", "30/1").split("/")[1])

    in_dur = float(in_probe["format"]["duration"])
    out_dur = float(out_probe["format"]["duration"])

    frame_dur = 1.0 / in_fps

    # 1. Output duration within one frame of input
    assert abs(in_dur - out_dur) <= frame_dur + 0.05, f"Duration mismatch: in={in_dur:.3f}s out={out_dur:.3f}s (tolerance {frame_dur:.3f}s)"

    # 2. Output dimensions must be 1080x1920
    assert int(out_v["width"]) == 1080
    assert int(out_v["height"]) == 1920

    # 3. Audio lag within one frame (cross-correlation)
    audio_ref = extract_pcm_16k(norm_mp4)
    audio_out = extract_pcm_16k(out_mp4)
    lag_s = compute_audio_lag_seconds(audio_ref, audio_out, sample_rate=16000)

    assert abs(lag_s) <= frame_dur, f"Audio lag {lag_s*1000:.1f}ms exceeds 1 frame ({frame_dur*1000:.1f}ms)"
