"""Contracts and validation for the RelatiV edit engine."""

from .models import (
    SCHEMA_VERSION,
    CONTRACTS,
    EDL,
    VISUAL_EFFECT_TYPES,
    IMPACT_EFFECT_TYPES,
    Effect,
    JudgeReport,
    Scores,
    Segment,
    StoryPlan,
    model_for,
    production_ready_rule,
)
from .validate import (
    SchemaValidationError,
    assert_valid,
    block_errors,
    check_schema_version,
    is_valid,
    load_schema,
    validate,
    validate_document,
)

__all__ = [
    "CONTRACTS",
    "EDL",
    "Effect",
    "IMPACT_EFFECT_TYPES",
    "JudgeReport",
    "SCHEMA_VERSION",
    "SchemaValidationError",
    "Scores",
    "Segment",
    "StoryPlan",
    "VISUAL_EFFECT_TYPES",
    "assert_valid",
    "block_errors",
    "check_schema_version",
    "is_valid",
    "json_schema_for",
    "load_schema",
    "model_for",
    "production_ready_rule",
    "validate",
    "validate_document",
    "write_schemas",
]


def json_schema_for(model):
    from .compile import json_schema_for as _impl

    return _impl(model)


def write_schemas(out_dir=None):
    from .compile import write_schemas as _impl

    return _impl(out_dir)
