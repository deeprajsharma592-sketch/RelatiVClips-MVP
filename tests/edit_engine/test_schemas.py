"""The three contracts: models, exported JSON Schema, and version pinning."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from schemas import EDL, JudgeReport, StoryPlan, production_ready_rule, validate
from schemas.compile import OUT_DIR, write_schemas
from schemas.validate import schema_path


def test_story_plan_roundtrip(story_plan):
    plan = StoryPlan.model_validate(story_plan)
    assert plan.duration_s == 5.0
    assert plan.segment_at(0.2).role == "hook"
    assert plan.segment_at(3.5).role == "rehook"
    assert validate(plan.model_dump(mode="json"), "StoryPlan") == []


def test_story_plan_rejects_overlap_and_out_of_range():
    plan = {
        "clip_id": "c",
        "duration_s": 4,
        "segments": [
            {"start": 0, "end": 2, "role": "hook", "text": "a"},
            {"start": 1.5, "end": 3, "role": "info", "text": "b"},
        ],
    }
    errors = validate(plan, "StoryPlan")
    assert any("overlaps" in e for e in errors)


def test_judge_report_ready_rule():
    scores = {"hook": 8, "arc": 7, "readability": 6, "overload": 6, "audio": 6}
    assert production_ready_rule(scores) is True
    report = {
        "clip_id": "c",
        "scores": scores,
        "critique": "At 1.2s the caption is covered by the popup; move it to the top right.",
        "production_ready": True,
        "schema_version": "1.0.0",
    }
    assert validate(report, "JudgeReport") == []

    report["production_ready"] = False
    errors = validate(report, "JudgeReport")
    assert any("production_ready" in e for e in errors)

    report["scores"]["audio"] = 3
    report["production_ready"] = True
    errors = validate(report, "JudgeReport")
    assert any("no score < 5" in e or "production_ready" in e for e in errors)


def test_schema_files_are_exported_and_current():
    write_schemas()
    manifest = json.loads((OUT_DIR / "manifest.json").read_text())
    assert set(manifest["contracts"]) == {"StoryPlan", "EDL", "JudgeReport"}
    for name in manifest["contracts"]:
        path = schema_path(name)
        assert path.exists(), path
        schema = json.loads(path.read_text())
        assert schema["title"] == name
        assert schema["$schema"].endswith("2020-12/schema")
        assert "schema_version" in schema["required"]


def test_exported_schema_is_strict():
    edl_schema = json.loads(schema_path("EDL").read_text())
    assert edl_schema["additionalProperties"] is False
    effects = edl_schema["properties"]["effects"]
    item = effects.get("items", {})
    if "$ref" in item:
        item = edl_schema["$defs"][item["$ref"].split("/")[-1]]
    assert item["additionalProperties"] is False
    assert item["properties"]["type"]["enum"] == [
        "shake",
        "motion_blur",
        "caption_style",
        "popup",
        "sfx",
        "zoom",
    ]


def test_models_forbid_extra_fields():
    with pytest.raises(Exception):
        EDL.model_validate(
            {
                "clip_id": "c",
                "niche": "n",
                "effects": [],
                "surprise": True,
            }
        )


def test_judge_model_enforces_rule_at_construction():
    with pytest.raises(Exception):
        JudgeReport.model_validate(
            {
                "clip_id": "c",
                "scores": {"hook": 5, "arc": 9, "readability": 8, "overload": 8, "audio": 8},
                "critique": "Hook is weak at 0.5s: the frame has no face and no text.",
                "production_ready": True,
            }
        )
