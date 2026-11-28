"""Judge: frame planning/extraction, rubric validation, retry, calibration, variance."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from judge import judge_clip, plan_timestamps
from judge.calibrate import calibrate, pearson, write_template
from judge.consistency import consistency
from judge.frames import extract_frames, transcript_snippet
from schemas.validate import validate_document


def test_timestamps_cover_hook_peaks_midpoint_and_final(all_blocks_edl):
    points = plan_timestamps(all_blocks_edl, 5.0)
    labels = [label for _, label in points]
    times = [ts for ts, _ in points]
    assert any(l.startswith("hook@") for l in labels)
    assert any(l.startswith("peak:") for l in labels)
    assert "midpoint" in labels and "final" in labels
    assert times == sorted(times)
    assert max(times) <= 4.95


def test_transcript_snippet_aligns_words(transcript):
    assert "nobody" in transcript_snippet(transcript, 0.7)
    assert transcript_snippet(transcript, 4.6).startswith("more") or "more" in transcript_snippet(transcript, 4.6)


@pytest.mark.slow
def test_frames_extract_and_cleanup(tmp_path, sample_clip, all_blocks_edl, transcript):
    result = judge_clip(
        sample_clip,
        all_blocks_edl,
        transcript,
        duration_s=5.0,
        frames_dir=tmp_path / "frames",
        clip_id="demo_01",
        use_mock=True,
    )
    assert result.ok, result.errors
    assert len(result.frames) >= 4
    assert validate_document(result.report, "JudgeReport") == []
    assert not list((tmp_path / "frames").glob("*.jpg")), "frames should be cleaned up"


def test_mock_report_matches_rubric(all_blocks_edl):
    result = judge_clip(
        "data/fixtures/sample_5s.mp4", all_blocks_edl, use_mock=True, clip_id="demo_01"
    )
    assert result.ok, result.errors
    report = result.report
    assert set(report["scores"]) == {"hook", "arc", "readability", "overload", "audio"}
    assert all(1 <= v <= 10 for v in report["scores"].values())
    assert report["production_ready"] == (
        report["scores"]["hook"] >= 7
        and report["scores"]["arc"] >= 7
        and min(report["scores"].values()) >= 5
    )


def test_judge_retries_once_on_bad_report(sample_clip, all_blocks_edl):
    from editor.llm import ScriptedClient

    bad = json.dumps(
        {
            "schema_version": "1.0.0",
            "clip_id": "demo_01",
            "scores": {"hook": 12, "arc": 7, "readability": 7, "overload": 7, "audio": 7},
            "critique": "short",
            "production_ready": True,
        }
    )
    good = json.dumps(
        {
            "schema_version": "1.0.0",
            "clip_id": "demo_01",
            "scores": {"hook": 8, "arc": 7, "readability": 7, "overload": 7, "audio": 8},
            "critique": "At 0.5s the hook reads; at 2.1s the popup arrives late - move it to 1.8s.",
            "production_ready": True,
        }
    )
    client = ScriptedClient([bad, good], model="scripted-vision")
    result = judge_clip(
        sample_clip, all_blocks_edl, use_mock=False, clip_id="demo_01", client=client
    )
    assert result.ok, result.errors
    assert len(result.attempts) == 2
    assert result.attempts[0].ok is False
    assert any("hook" in e for e in result.attempts[0].errors)
    assert "At 0.5s the hook reads" in result.report["critique"]


def test_judge_fails_after_retry_without_raising(sample_clip, all_blocks_edl):
    from editor.llm import ScriptedClient

    client = ScriptedClient(["not json", "still not json"], model="scripted-vision")
    result = judge_clip(sample_clip, all_blocks_edl, clip_id="demo_01", client=client)
    assert result.ok is False
    assert result.report is None
    assert len(result.attempts) == 2


def test_pearson_and_template(tmp_path):
    assert pearson([1, 2, 3], [2, 4, 6]) == pytest.approx(1.0)
    assert pearson([1, 2, 3], [3, 2, 1]) == pytest.approx(-1.0)
    template = tmp_path / "template.csv"
    write_template(template)
    header = template.read_text().splitlines()[0]
    assert header.startswith("clip_id,mp4,edl")
    assert "human_hook" in header


@pytest.mark.slow
def test_calibration_runs_on_csv(tmp_path, sample_clip, all_blocks_edl, transcript):
    edl_path = tmp_path / "edl.json"
    edl_path.write_text(json.dumps(all_blocks_edl))
    mp4 = tmp_path / "clip.mp4"
    mp4.write_bytes(sample_clip.read_bytes())
    csv_path = tmp_path / "ratings.csv"
    csv_path.write_text(
        "clip_id,mp4,edl,transcript,human_hook,human_arc,human_readability,human_overload,human_audio,notes\n"
        f"demo_01,{mp4.name},{edl_path.name},,9,8,8,7,7,hook was strong\n"
        f"demo_02,{mp4.name},{edl_path.name},,6,6,7,6,6,weaker open\n"
    )
    report = calibrate(csv_path, use_mock=True, out_path=tmp_path / "report.json")
    assert report["rows"] == 2
    assert report["dimensions"]["hook"]["n"] == 2
    assert report["dimensions"]["hook"]["mae"] >= 0
    assert len(report["disagreements"]) == 2
    assert (tmp_path / "report.json").exists()


@pytest.mark.slow
def test_consistency_prints_variance_table(sample_clip, all_blocks_edl, capsys):
    table = consistency(sample_clip, all_blocks_edl, runs=3, use_mock=True)
    out = capsys.readouterr().out
    assert "stdev" in out
    assert table["runs"] == 3
    assert table["table"]["hook"]["stdev"] == 0
