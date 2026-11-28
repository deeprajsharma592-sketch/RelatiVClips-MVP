"""Editor: prompt assembly, mock generation, and the validate-and-retry loop."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy import func, select

import engine_config
import schemas.db as db
from composer import safety
from editor import generate_edl, parse_json_object
from editor.llm import ScriptedClient
from schemas.validate import validate_document


def _good_edl(clip_id: str = "demo_01") -> dict:
    return {
        "schema_version": "1.0.0",
        "clip_id": clip_id,
        "niche": "livestream_comedy",
        "effects": [
            {
                "id": "cap",
                "type": "caption_style",
                "start": 0.0,
                "end": 4.9,
                "params": {"style": "irl_stream", "max_words_per_group": 2},
                "rationale": "Captions follow the spoken words for the whole clip.",
            },
            {
                "id": "hook",
                "type": "zoom",
                "start": 0.2,
                "end": 1.0,
                "params": {"scale": 1.15},
                "rationale": "Punch-in on 'nobody told me' at the top of the hook.",
            },
        ],
    }


@pytest.mark.parametrize("clip_index, clip_id", enumerate(["demo_01", "demo_02", "demo_03"]))
def test_mock_generation_is_valid_for_all_sample_clips(clip_index, clip_id, transcript):
    plan = json.loads((Path("data/fixtures") / f"story_plan_{clip_id}.json").read_text())
    for style in ("minimal", "punchy", "chaotic"):
        result = generate_edl(plan, transcript, style_direction=style, variant_index=clip_index)
        assert result.ok, result.errors
        assert result.edl is not None
        assert validate_document(result.edl, "EDL") == []
        assert safety.check_edl(result.edl, duration_s=plan["duration_s"]) == []
        assert result.mock is True


def test_repair_loop_recovers_from_malformed_output(story_plan, transcript):
    bad_json = 'Sure! Here is your EDL:\n```json\n{"clip_id": "demo_01",\n```'
    bad_schema = json.dumps(
        {
            "schema_version": "1.0.0",
            "clip_id": "demo_01",
            "niche": "livestream_comedy",
            "effects": [
                {
                    "id": "hook",
                    "type": "zoom",
                    "start": 0.2,
                    "end": 1.0,
                    "params": {"scale": 99},
                    "rationale": "too strong",
                }
            ],
        }
    )
    good = json.dumps(_good_edl())

    client = ScriptedClient([bad_json, bad_schema, good])
    result = generate_edl(story_plan, transcript, client=client, use_mock=False)

    assert result.ok, result.errors
    assert len(result.attempts) == 3
    assert [a.ok for a in result.attempts] == [False, False, True]
    assert any("JSON" in e for e in result.attempts[0].errors)
    # the third call must contain the exact validator feedback for the second attempt
    repair_text = client.calls[2][-1]["content"]
    assert "must be <= 2" in repair_text
    assert "$.effects[0].params.scale" in repair_text
    assert result.edl["effects"][0]["id"] == "cap"
    assert all(a.prompt_tokens > 0 for a in result.attempts)


def test_repair_loop_gives_up_after_three_attempts(story_plan, transcript):
    bad = json.dumps(_good_edl() | {"effects": [{"id": "x", "type": "explode", "start": 0, "end": 1, "params": {}, "rationale": "boom goes the clip"}]})
    client = ScriptedClient([bad, bad, bad])
    result = generate_edl(story_plan, transcript, client=client, use_mock=False)
    assert result.ok is False
    assert result.edl is None
    assert len(result.attempts) == 3
    assert result.errors


def test_safety_violation_is_repaired(story_plan, transcript):
    overlapping = json.loads(json.dumps(_good_edl()))
    overlapping["effects"] += [
        {
            "id": "pop",
            "type": "popup",
            "start": 0.3,
            "end": 1.2,
            "params": {"asset_id": "reaction_box", "position": "center"},
            "rationale": "popup on the same beat as the zoom",
        }
    ]
    client = ScriptedClient([json.dumps(overlapping), json.dumps(_good_edl())])
    result = generate_edl(story_plan, transcript, client=client, use_mock=False)
    assert result.ok
    assert any("within 300ms" in e for e in result.attempts[0].errors)


def test_parse_json_object_handles_fences_and_prose():
    assert parse_json_object('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json_object('Here you go: {"a": {"b": 2}} thanks') == {"a": {"b": 2}}
    with pytest.raises(ValueError):
        parse_json_object("not json at all")


def test_system_prompt_is_fully_assembled():
    from editor.prompting import build_system_prompt

    prompt = build_system_prompt("livestream_comedy")
    assert "{{" not in prompt
    assert "BLOCK CATALOG" in prompt
    assert "light" not in prompt.split("BLOCK CATALOG")[0][-20:]  # niche body landed
    assert "hook is a gate" in prompt
    assert "never cause" not in prompt.lower()
    for block in ("shake", "caption_style", "popup", "sfx", "zoom"):
        assert f"### {block}" in prompt


def test_few_shot_examples_are_used_when_present(tmp_path, monkeypatch):
    n = engine_config.settings().niches_dir
    monkeypatch.setenv("EDIT_NICHES_DIR", str(n))
    examples = {
        "examples": [
            {
                "clip_id": "win_1",
                "weighted_score": 8.6,
                "critique": "Hook punch-in at 0.2s read instantly.",
                "edl": _good_edl("win_1"),
            }
        ]
    }
    path = n / "livestream_comedy.examples.json"
    original = path.read_text() if path.exists() else None
    path.write_text(json.dumps(examples))
    try:
        from editor.prompting import build_system_prompt

        prompt = build_system_prompt("livestream_comedy")
        assert "win_1" in prompt
        assert "Hook punch-in at 0.2s" in prompt
    finally:
        if original is None:
            path.unlink()
        else:
            path.write_text(original)


def test_token_usage_is_persisted(story_plan, transcript):
    db.init_db()
    client = ScriptedClient([json.dumps(_good_edl())])
    with db.session_scope() as session:
        result = generate_edl(story_plan, transcript, client=client, use_mock=False, session=session)
        assert result.ok
    with db.session_scope() as session:
        total = session.scalar(select(func.coalesce(func.sum(db.TokenUsage.total_tokens), 0)))
        rows = session.scalar(select(func.count(db.TokenUsage.id)))
    assert rows == 1
    assert total and total > 0


def test_style_and_temperature_are_plumbed(story_plan, transcript):
    client = ScriptedClient([json.dumps(_good_edl())])
    result = generate_edl(
        story_plan, transcript, client=client, use_mock=False, style_direction="chaotic", temperature=1.1
    )
    assert result.ok
    assert result.temperature == 1.1
    assert "STYLE DIRECTION: chaotic" in client.calls[0][1]["content"]
