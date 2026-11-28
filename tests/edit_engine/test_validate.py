"""The validator: messages must be precise enough to paste back into an LLM."""

from __future__ import annotations

import json

from blocks import registry
from schemas import EDL, validate, validate_document
from schemas.validate import SchemaValidationError, assert_valid, block_errors


def _edl(**overrides):
    base = {
        "clip_id": "c1",
        "niche": "livestream_comedy",
        "schema_version": "1.0.0",
        "effects": [],
    }
    base.update(overrides)
    return base


def test_error_paths_are_addressable(all_blocks_edl):
    bad = json.loads(json.dumps(all_blocks_edl))
    bad["effects"][1]["start"] = -1.5
    errors = validate(bad, "EDL")
    assert errors, "expected an error"
    joined = "\n".join(errors)
    assert "$.effects[1].start" in joined
    assert ">= 0" in joined
    assert "-1.5" in joined


def test_enum_and_unknown_field_messages():
    bad = _edl(
        effects=[
            {
                "id": "e1",
                "type": "explode",
                "start": 0,
                "end": 1,
                "params": {},
                "rationale": "on the word boom",
            }
        ]
    )
    errors = validate(bad, "EDL")
    assert any("explode" in e and "shake" in e for e in errors)

    bad = _edl(extra_field=1)
    errors = validate(bad, "EDL")
    assert any("unknown field 'extra_field'" in e for e in errors)


def test_schema_version_is_enforced():
    errors = validate_document(_edl(schema_version="0.9.0"), "EDL")
    assert any("schema_version" in e for e in errors)
    assert validate_document(_edl(), "EDL") == []


def test_duplicate_ids_and_short_rationale():
    eff = {
        "id": "same",
        "type": "zoom",
        "start": 0.2,
        "end": 1.0,
        "params": {},
        "rationale": "ok",
    }
    errors = validate(_edl(effects=[eff, dict(eff)]), "EDL")
    assert any("duplicated" in e for e in errors)
    assert any("rationale" in e for e in errors)


def test_assert_valid_raises_with_feedback():
    try:
        assert_valid({"clip_id": "", "niche": "", "effects": []}, "EDL")
    except SchemaValidationError as exc:
        assert exc.errors
        assert exc.as_feedback().startswith("- ")
    else:  # pragma: no cover
        raise AssertionError("expected SchemaValidationError")


def test_block_param_validation():
    schema = registry.load_params_schema("shake")
    errors = block_errors({"intensity": 3, "frequency": 200}, schema)
    assert any("intensity" in e and "1" in e for e in errors)
    assert any("frequency" in e for e in errors)
    assert block_errors({"intensity": 0.5}, schema) == []


def test_models_agree_with_json_schema(all_blocks_edl):
    EDL.model_validate(all_blocks_edl)
    assert validate(all_blocks_edl, "EDL") == []
    assert validate(all_blocks_edl, EDL) == []
