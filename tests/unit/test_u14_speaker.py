"""
Unit tests for S4 Speech & Speaker Attribution (U14).
U14: Synthetic MAR signals with known lag -> Correct speaker and lag recovered.
"""

import numpy as np
import pytest
from framing.s4_speech import estimate_av_offset, attribute_speaker


def test_u14_synthetic_mar_lag_recovery():
    """U14: Synthetic mouth activity signal with known audio-video lag is recovered accurately."""
    sample_rate_hz = 30.0
    duration_s = 10.0
    n_frames = int(duration_s * sample_rate_hz)

    # Synthetic VAD speech mask (active between 2.0s and 6.0s)
    vad_active = np.zeros(n_frames, dtype=float)
    vad_active[int(2.0 * sample_rate_hz): int(6.0 * sample_rate_hz)] = 1.0

    # Introduce a 100 ms (3 frames at 30 fps) audio lead / video lag
    true_lag_frames = 3
    true_lag_ms = (true_lag_frames / sample_rate_hz) * 1000.0  # 100.0 ms

    # Track 1 has mouth activity matching VAD with the true lag
    mar_activity_p1 = np.zeros(n_frames, dtype=float)
    mar_activity_p1[int(2.0 * sample_rate_hz) + true_lag_frames: int(6.0 * sample_rate_hz) + true_lag_frames] = 1.0

    # Track 2 is silent/idle
    mar_activity_p2 = np.full(n_frames, 0.05)

    detected_lag_ms = estimate_av_offset(
        vad_mask=vad_active,
        total_mouth_activity=mar_activity_p1 + mar_activity_p2,
        fps=sample_rate_hz,
        max_search_ms=300.0,
    )

    assert detected_lag_ms == pytest.approx(true_lag_ms, abs=35.0)

    # Attribution check: Track P1 should be attributed as speaker
    speaker = attribute_speaker(
        track_activities={"P1": 1.8, "P2": 0.2}, # normalized relative to baseline
        vad_active=True,
        current_speaker="unknown",
        switch_margin=1.3,
    )
    assert speaker == "P1"
