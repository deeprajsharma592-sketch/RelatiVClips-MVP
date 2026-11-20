"""
Integration test and Gate 2 verification for Phase 2.
Tests S4 VAD + mouth speaker attribution and S5 turns across fixtures F03 to F08.
Verifies Metric M2 (>= 90% accuracy on clean 2-person fixtures), U14, and turns behavior.
"""

from pathlib import Path
import json
import pytest

from framing.config import load_config
from framing.s1_normalize import normalize_media
from framing.s2_shots import detect_shots
from framing.s3_faces import detect_and_track_faces
from framing.s4_speech import attribute_speech_pipeline
from framing.s5_turns import compute_turns


@pytest.fixture(scope="module")
def base_config():
    config_path = Path(__file__).resolve().parents[2] / "framing" / "config.yaml"
    return load_config(config_path)


def evaluate_fixture_speaker_accuracy(
    fixture_id: str,
    tmp_path: Path,
    config: dict,
) -> float:
    """Runs S1 through S5 on fixture, compares against ground truth, and returns Metric M2 %."""
    fixtures_dir = Path(__file__).resolve().parents[1] / "fixtures"
    labels_dir = Path(__file__).resolve().parents[1] / "labels"

    fixture_video = fixtures_dir / f"{fixture_id}.mp4"
    label_path = labels_dir / f"{fixture_id}.json"
    assert fixture_video.exists(), f"Fixture {fixture_video} missing"
    assert label_path.exists(), f"Label {label_path} missing"

    with open(label_path, "r", encoding="utf-8") as f:
        ground_truth = json.load(f)

    workdir = tmp_path / f"gate2_{fixture_id}"
    workdir.mkdir(parents=True, exist_ok=True)

    # Stages S1, S2, S3
    norm_info = normalize_media(fixture_video, workdir, config)
    norm_video = Path(norm_info["normalized_video_path"])
    fps = norm_info["fps"]
    total_frames = int(round(norm_info["duration_s"] * fps))

    shots = detect_shots(norm_video, workdir, config)
    tracks = detect_and_track_faces(norm_video, shots, workdir, config)

    # Stage S4: Speech attribution
    speech = attribute_speech_pipeline(
        wav_path=Path(norm_info["audio_wav_path"]) if norm_info.get("has_audio") else None,
        tracks_data=tracks,
        total_frames=total_frames,
        fps=fps,
        workdir=workdir,
        config=config,
    )
    predicted_frames = speech.get("frames", [])

    # Stage S5: Turns
    turns = compute_turns(speech.get("intervals", []), workdir, config)
    assert Path(workdir / "turns.json").exists()

    # Calculate Metric M2 accuracy
    correct_count = 0
    total_eval_frames = len(predicted_frames)

    gt_intervals = ground_truth.get("speaker_intervals", [])

    for f_idx, p_frame in enumerate(predicted_frames):
        t = f_idx / fps
        pred_spk = p_frame["speaker"]

        # Find active ground-truth speakers at time t
        active_gt = [intv["speaker"] for intv in gt_intervals if intv["start_s"] <= t <= intv["end_s"]]
        if not active_gt:
            # Silence
            is_correct = (pred_spk in ["silence", "unknown"])
        else:
            # In overlaps, pred matching any active speaker is correct
            is_correct = (pred_spk in active_gt)

        if is_correct:
            correct_count += 1

    accuracy_pct = (correct_count / max(1, total_eval_frames)) * 100.0
    return accuracy_pct


def test_gate2_f03_clean_two_person_podcast(tmp_path, base_config):
    """Gate 2 on F03: Alternating long turns between P1 and P2."""
    acc = evaluate_fixture_speaker_accuracy("F03", tmp_path, base_config)
    print(f"\n[F03] Metric M2 accuracy: {acc:.2f}% (Target: >= 90%)")
    assert acc >= 90.0


def test_gate2_f04_fast_banter(tmp_path, base_config):
    """Gate 2 on F04: Rapid turn exchanges."""
    acc = evaluate_fixture_speaker_accuracy("F04", tmp_path, base_config)
    print(f"\n[F04] Metric M2 accuracy: {acc:.2f}% (Target: >= 85%)")
    assert acc >= 85.0


def test_gate2_f05_monologue(tmp_path, base_config):
    """Gate 2 on F05: P1 long monologue."""
    acc = evaluate_fixture_speaker_accuracy("F05", tmp_path, base_config)
    print(f"\n[F05] Metric M2 accuracy: {acc:.2f}% (Target: >= 90%)")
    assert acc >= 90.0


def test_gate2_f06_overlap(tmp_path, base_config):
    """Gate 2 on F06: Overlapping speech."""
    acc = evaluate_fixture_speaker_accuracy("F06", tmp_path, base_config)
    print(f"\n[F06] Metric M2 accuracy: {acc:.2f}%")
    assert acc >= 80.0


def test_gate2_f07_backchannels(tmp_path, base_config):
    """Gate 2 on F07: Backchannel turn detection."""
    acc = evaluate_fixture_speaker_accuracy("F07", tmp_path, base_config)
    print(f"\n[F07] Metric M2 accuracy: {acc:.2f}%")
    assert acc >= 85.0


def test_gate2_f08_offscreen_voiceover(tmp_path, base_config):
    """Gate 2 on F08: Voice-over where visible face is silent."""
    acc = evaluate_fixture_speaker_accuracy("F08", tmp_path, base_config)
    print(f"\n[F08] Metric M2 accuracy: {acc:.2f}%")
    assert acc >= 80.0
