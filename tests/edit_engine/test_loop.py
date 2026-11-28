"""Loop: selection, memory, feedback/report, export, and the end-to-end run."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
from sqlalchemy import select

import engine_config
import schemas.db as db
from loop import clipdata, export_dataset, feedback, memory, regression, selection
from loop.config import weighted_score
from loop.pipeline import VariantResult


def _variant(index: int, scores: dict, *, effects: int = 2, ready: bool | None = None) -> VariantResult:
    report = {
        "schema_version": "1.0.0",
        "clip_id": "demo_01",
        "scores": scores,
        "critique": "At 0.5s the hook reads; move the popup at 2.1s earlier.",
        "production_ready": (
            scores["hook"] >= 7 and scores["arc"] >= 7 and min(scores.values()) >= 5
            if ready is None
            else ready
        ),
    }
    return VariantResult(
        index=index,
        style_direction="punchy",
        temperature=0.7,
        ok=True,
        edl={
            "clip_id": "demo_01",
            "niche": "livestream_comedy",
            "effects": [
                {"id": f"e{i}", "type": "zoom", "start": i, "end": i + 0.5, "params": {}, "rationale": "x"}
                for i in range(effects)
            ],
        },
        weighted=weighted_score(scores),
        production_ready=report["production_ready"],
        judge=_judge_stub(report),
    )


def _judge_stub(report: dict):
    class Stub:
        ok = True
        mock = True
        prompt_version = "v1"
        model = "stub"
        errors: list = []
        frames: list = []
        attempts: list = []

        @property
        def scores(self):
            return report["scores"]

        @property
        def report(self):
            return report

        @property
        def total_tokens(self):
            return 0

    return Stub()


def test_selection_prefers_production_ready_then_score_then_fewer_effects():
    strong_draft = _variant(0, {"hook": 9, "arc": 6, "readability": 8, "overload": 8, "audio": 8}, effects=5)
    ready = _variant(1, {"hook": 8, "arc": 8, "readability": 8, "overload": 7, "audio": 7}, effects=4)
    tie_ready = _variant(2, {"hook": 8, "arc": 8, "readability": 8, "overload": 7, "audio": 7}, effects=2)
    picked = selection.select([strong_draft, ready, tie_ready])
    assert picked.winner is tie_ready, "same score, fewer effects should win"
    assert picked.worst is strong_draft
    assert picked.ready_count == 2
    pair = selection.preference_pair(picked)
    assert pair[0] is tie_ready and pair[1] is strong_draft


def test_selection_without_ready_variants_falls_back_to_score():
    draft = _variant(0, {"hook": 6, "arc": 6, "readability": 7, "overload": 7, "audio": 7})
    picked = selection.select([draft])
    assert picked.winner is draft
    assert "not production_ready" in picked.reason or "production_ready" in picked.reason


def test_memory_records_dedupes_and_prunes(tmp_path, monkeypatch):
    monkeypatch.setenv("EDIT_NICHES_DIR", str(tmp_path))
    engine_config.reset_settings_cache()
    edl = _variant(0, {"hook": 8, "arc": 8, "readability": 8, "overload": 7, "audio": 7}).edl
    path = memory.record_winner(
        niche="test_niche", clip_id="c1", edl=edl,
        scores={"hook": 8, "arc": 8, "readability": 8, "overload": 7, "audio": 7},
        weighted_score=7.8,
    )
    assert path.exists()
    first = json.loads(path.read_text())
    assert len(first["examples"]) == 1
    memory.record_winner(
        niche="test_niche", clip_id="c1", edl=edl,
        scores={"hook": 8, "arc": 8, "readability": 8, "overload": 7, "audio": 7},
        weighted_score=7.8,
    )
    second = json.loads(path.read_text())
    assert len(second["examples"]) == 1, "same EDL must dedupe by hash"


def test_feedback_report_flags_divergence(tmp_path, monkeypatch):
    monkeypatch.setenv("EDIT_NICHES_DIR", str(tmp_path))
    engine_config.reset_settings_cache()
    db.init_db()
    with db.session_scope() as session:
        clip = db.get_or_create_clip(session, "fb_clip", niche="livestream_comedy", duration_s=5)
        edl = db.save_edl(session, clip, {"clip_id": "fb_clip", "niche": "livestream_comedy", "effects": []})
        report = {
            "schema_version": "1.0.0",
            "clip_id": "fb_clip",
            "scores": {"hook": 10, "arc": 10, "readability": 10, "overload": 9, "audio": 9},
            "critique": "Perfect clip according to the judge, which is suspicious at 0.5s.",
            "production_ready": True,
        }
        db.save_judgment(session, edl, report)
        for _ in range(3):
            db.record_feedback(session, edl, kind="dislike", reason="hated the captions", value=2.0)
        edl_id = edl.id
    report = feedback.weekly_report(days=7)
    row = report["niches"]["livestream_comedy"]
    assert row["divergent"] is True
    assert row["gap"] and row["gap"] > 2
    assert report["suggestions"], "a divergent niche must produce a suggestion"
    assert "Suggestion only" in report["suggestions"][0]
    assert feedback.record(edl_id, "download", value=10.0) > 0


def test_export_writes_jsonl(tmp_path):
    db.init_db()
    with db.session_scope() as session:
        clip = db.get_or_create_clip(session, "export_clip", niche="livestream_comedy", duration_s=5)
        edl = db.save_edl(session, clip, {"clip_id": "export_clip", "niche": "livestream_comedy", "effects": []})
        worse = db.save_edl(session, clip, {"clip_id": "export_clip", "niche": "livestream_comedy", "effects": []}, label="v2")
        run_row = db.save_run(session, clip, variant_count=2)
        db.save_preference(session, run_row, chosen_edl_id=edl.id, rejected_edl_id=worse.id, margin=1.2)
        db.record_feedback(session, edl, kind="like", value=8.0)
    out = tmp_path / "dataset.jsonl"
    summary = export_dataset.export(out)
    lines = [json.loads(line) for line in out.read_text().splitlines()]
    assert summary["clip_edl"] == 2
    assert summary["preference"] == 1
    assert {line["type"] for line in lines} == {"clip_edl", "preference"}
    assert any(line.get("feedback") for line in lines if line["type"] == "clip_edl")


def test_clipdata_loads_fixtures_and_regression_has_ten_clips(tmp_path, monkeypatch):
    monkeypatch.setenv("EDIT_DATA_DIR", str(tmp_path))
    engine_config.reset_settings_cache()
    clip = clipdata.load_clip("demo_01")
    assert clip is not None
    assert clip.story_plan["clip_id"] == "demo_01"
    assert clip.transcript and clip.transcript["words"]
    specs = regression.load_specs(10)
    assert len(specs) == 10
    assert all({"label", "clip_id", "style"} <= set(spec) for spec in specs)


@pytest.mark.slow
def test_pipeline_end_to_end_and_memory_feeds_next_prompt(tmp_path, monkeypatch):
    niches = tmp_path / "niches"
    niches.mkdir()
    shutil.copy2("niches/livestream_comedy.md", niches / "livestream_comedy.md")
    monkeypatch.setenv("EDIT_NICHES_DIR", str(niches))
    engine_config.reset_settings_cache()
    from editor.prompting import build_system_prompt
    from loop.pipeline import run

    result = run("demo_01", variants=2, use_mock=True, refine=False)
    assert result.ok, result.error
    assert result.winner is not None
    assert len(result.variants) == 2
    assert result.tokens > 0
    assert Path(result.winner_mp4).exists()
    assert Path(result.winner_edl_path).exists()

    examples = json.loads(Path(result.examples_path).read_text())
    assert examples["examples"], "winner should be remembered"
    prompt = build_system_prompt("livestream_comedy")
    assert result.clip_id in prompt
    assert "{{" not in prompt

    with db.session_scope() as session:
        runs = session.scalars(select(db.Run)).all()
        variants = session.scalars(select(db.Variant)).all()
        prefs = session.scalars(select(db.Preference)).all()
        judgments = session.scalars(select(db.Judgment)).all()
    assert runs and runs[-1].winner_edl_id
    assert len(variants) == 2
    assert len(judgments) >= 1
    assert len(prefs) == 1


@pytest.mark.slow
def test_regression_prints_deltas(tmp_path, monkeypatch, capsys):
    niches = tmp_path / "niches"
    niches.mkdir()
    shutil.copy2("niches/livestream_comedy.md", niches / "livestream_comedy.md")
    monkeypatch.setenv("EDIT_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("EDIT_NICHES_DIR", str(niches))
    engine_config.reset_settings_cache()
    report = regression.run_regression(count=2, use_mock=True, update_baseline=True)
    out = capsys.readouterr().out
    assert "delta" in out
    assert report["current"]["clips"] == 2
    assert (tmp_path / "regression" / "baseline.json").exists()
