"""Strict JSON-Schema validation with messages an LLM can repair from.

``validate(obj, schema)`` returns a list of human-readable strings, each of the
form ``effects[2].start: must be >= 0 (got -0.5)``. The list is safe to paste
verbatim into a repair turn, and it is what the composer/editor/judge all use.

Supported schema keywords are exactly the ones this repo generates or writes by
hand: type, properties, required, additionalProperties, items, enum, const,
minimum, maximum, exclusiveMinimum, exclusiveMaximum, minLength, maxLength,
pattern, minItems, maxItems, $ref (#/$defs/...), anyOf, oneOf.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from .models import SCHEMA_VERSION, model_for

ROOT = Path(__file__).resolve().parent.parent
JSON_SCHEMA_DIR = ROOT / "schemas" / "json"

_JSON_TYPES: dict[str, tuple[type, ...]] = {
    "object": (dict,),
    "array": (list,),
    "string": (str,),
    "boolean": (bool,),
    "null": (type(None),),
}


class SchemaValidationError(ValueError):
    """Raised by :func:`assert_valid`; carries the individual error strings."""

    def __init__(self, errors: Sequence[str], schema_name: str = "schema"):
        self.errors = list(errors)
        self.schema_name = schema_name
        super().__init__(f"{schema_name} validation failed:\n" + "\n".join(f"- {e}" for e in self.errors))

    def as_feedback(self) -> str:
        return "\n".join(f"- {e}" for e in self.errors)


def _type_ok(value: Any, expected: str) -> bool:
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected in _JSON_TYPES:
        return isinstance(value, _JSON_TYPES[expected])
    return True


def _type_of(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def _show(value: Any, limit: int = 60) -> str:
    try:
        text = json.dumps(value, default=str, ensure_ascii=False)
    except Exception:  # pragma: no cover - defensive
        text = repr(value)
    if len(text) > limit:
        text = text[: limit - 1] + "…"
    return text


def child_path(path: str, key: str | int) -> str:
    if isinstance(key, int):
        return f"{path}[{key}]"
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
        return f"{path}.{key}"
    return f"{path}[{json.dumps(key)}]"


def _resolve_ref(ref: str, root: Mapping[str, Any]) -> Mapping[str, Any]:
    if not ref.startswith("#/"):
        raise KeyError(f"unsupported $ref '{ref}' (only local refs are supported)")
    node: Any = root
    for part in ref[2:].split("/"):
        part = part.replace("~1", "/").replace("~0", "~")
        node = node[part]
    return node


def _validate(
    value: Any,
    schema: Mapping[str, Any],
    path: str,
    root: Mapping[str, Any],
    errors: list[str],
) -> None:
    if "$ref" in schema:
        _validate(value, _resolve_ref(schema["$ref"], root), path, root, errors)
        return

    for combinator in ("anyOf", "oneOf"):
        options = schema.get(combinator)
        if not options:
            continue
        branch_errors: list[list[str]] = []
        for option in options:
            sub: list[str] = []
            _validate(value, option, path, root, sub)
            if not sub:
                branch_errors = []
                break
            branch_errors.append(sub)
        else:
            # No branch matched: report the branch that got closest (fewest errors).
            best = min(branch_errors, key=len) if branch_errors else []
            errors.extend(best or [f"{path}: does not match any allowed shape"])
        return

    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: must be {_show(schema['const'])} (got {_show(value)})")
        return

    if "enum" in schema and value not in schema["enum"]:
        allowed = ", ".join(_show(v) for v in schema["enum"])
        errors.append(f"{path}: must be one of [{allowed}] (got {_show(value)})")
        return

    expected = schema.get("type")
    if expected is not None:
        types = [expected] if isinstance(expected, str) else list(expected)
        if not any(_type_ok(value, t) for t in types):
            errors.append(f"{path}: must be of type {'|'.join(types)} (got {_type_of(value)})")
            return

    if isinstance(value, str):
        min_len = schema.get("minLength")
        max_len = schema.get("maxLength")
        if min_len is not None and len(value) < min_len:
            errors.append(f"{path}: must be at least {min_len} characters (got {len(value)})")
        if max_len is not None and len(value) > max_len:
            errors.append(f"{path}: must be at most {max_len} characters (got {len(value)})")
        pattern = schema.get("pattern")
        if pattern and not re.search(pattern, value):
            errors.append(f"{path}: must match pattern {pattern} (got {_show(value)})")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        _check_number(value, schema, path, errors)

    if isinstance(value, list):
        _check_list(value, schema, path, root, errors)

    if isinstance(value, dict):
        _check_object(value, schema, path, root, errors)


def _check_number(value: float, schema: Mapping[str, Any], path: str, errors: list[str]) -> None:
    checks = (
        ("minimum", lambda v, b: v >= b, ">="),
        ("maximum", lambda v, b: v <= b, "<="),
        ("exclusiveMinimum", lambda v, b: v > b, ">"),
        ("exclusiveMaximum", lambda v, b: v < b, "<"),
    )
    for key, ok, symbol in checks:
        if key in schema and not ok(value, schema[key]):
            errors.append(f"{path}: must be {symbol} {schema[key]} (got {value})")


def _check_list(
    value: list, schema: Mapping[str, Any], path: str, root: Mapping[str, Any], errors: list[str]
) -> None:
    if "minItems" in schema and len(value) < schema["minItems"]:
        errors.append(f"{path}: must contain at least {schema['minItems']} items (got {len(value)})")
    if "maxItems" in schema and len(value) > schema["maxItems"]:
        errors.append(f"{path}: must contain at most {schema['maxItems']} items (got {len(value)})")
    item_schema = schema.get("items")
    if isinstance(item_schema, Mapping):
        for i, item in enumerate(value):
            _validate(item, item_schema, child_path(path, i), root, errors)


def _check_object(
    value: dict, schema: Mapping[str, Any], path: str, root: Mapping[str, Any], errors: list[str]
) -> None:
    props = schema.get("properties") or {}
    for name in schema.get("required", []):
        if name not in value:
            errors.append(f"{path}.{name}: required field is missing")

    for name, sub_schema in props.items():
        if name in value and isinstance(sub_schema, Mapping):
            _validate(value[name], sub_schema, child_path(path, name), root, errors)

    additional = schema.get("additionalProperties", True)
    for name in value:
        if name in props:
            continue
        if additional is False:
            known = ", ".join(sorted(props)) or "(none)"
            errors.append(
                f"{child_path(path, name)}: unknown field '{name}'; allowed fields are {known}"
            )
        elif isinstance(additional, Mapping):
            _validate(value[name], additional, child_path(path, name), root, errors)


# --------------------------------------------------------------------------- #
# Semantic checks that JSON Schema cannot express
# --------------------------------------------------------------------------- #


def _story_plan_semantics(obj: Any) -> list[str]:
    errors: list[str] = []
    segments = obj.get("segments")
    if not isinstance(segments, list):
        return errors
    duration = obj.get("duration_s")
    prev_end: float | None = None
    for i, seg in enumerate(segments):
        if not isinstance(seg, Mapping):
            continue
        start, end = seg.get("start"), seg.get("end")
        if isinstance(start, (int, float)) and isinstance(end, (int, float)):
            if end <= start:
                errors.append(f"segments[{i}].end: must be greater than start ({start})")
            if prev_end is not None and start + 1e-6 < prev_end:
                errors.append(
                    f"segments[{i}].start: {start} overlaps the previous segment (ends at {prev_end}); "
                    "segments must be ordered and non-overlapping"
                )
            if isinstance(duration, (int, float)) and end > duration + 1e-6:
                errors.append(f"segments[{i}].end: {end} is past duration_s ({duration})")
            prev_end = end
    for i, cb in enumerate(obj.get("callbacks") or []):
        if isinstance(cb, Mapping):
            a, b = cb.get("from_ts"), cb.get("to_ts")
            if isinstance(a, (int, float)) and isinstance(b, (int, float)) and b <= a:
                errors.append(f"callbacks[{i}].to_ts: must be greater than from_ts ({a})")
    return errors


def _edl_semantics(obj: Any) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    for i, eff in enumerate(obj.get("effects") or []):
        if not isinstance(eff, Mapping):
            continue
        eff_id = eff.get("id")
        if isinstance(eff_id, str):
            if eff_id in seen:
                errors.append(f"effects[{i}].id: '{eff_id}' is duplicated; ids must be unique")
            seen.add(eff_id)
        start, end = eff.get("start"), eff.get("end")
        if isinstance(start, (int, float)) and isinstance(end, (int, float)) and end <= start:
            errors.append(f"effects[{i}].end: must be greater than start ({start})")
        rationale = eff.get("rationale")
        if isinstance(rationale, str) and len(rationale.strip()) < 5:
            errors.append(
                f"effects[{i}].rationale: too short; name the word or moment this effect lands on"
            )
    return errors


def _judge_semantics(obj: Any) -> list[str]:
    errors: list[str] = []
    scores = obj.get("scores")
    if isinstance(scores, Mapping) and isinstance(obj.get("production_ready"), bool):
        nums = [v for v in scores.values() if isinstance(v, int) and not isinstance(v, bool)]
        if len(nums) == 5:
            expected = scores.get("hook", 0) >= 7 and scores.get("arc", 0) >= 7 and min(nums) >= 5
            if obj["production_ready"] != expected:
                errors.append(
                    "production_ready: must be true only when hook >= 7, arc >= 7 and no score < 5 "
                    f"(scores are {json.dumps(scores, sort_keys=True)}; expected {expected})"
                )
    return errors


_SEMANTIC_CHECKS = {
    "StoryPlan": _story_plan_semantics,
    "EDL": _edl_semantics,
    "JudgeReport": _judge_semantics,
}


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #


def schema_path(name: str) -> Path:
    from .compile import schema_file_name

    return JSON_SCHEMA_DIR / schema_file_name(name)


def load_schema(name: str) -> dict[str, Any]:
    """Load a contract schema by name, compiling it first if it is missing."""
    path = schema_path(name)
    if not path.exists():
        from .compile import write_schemas

        write_schemas()
    return json.loads(path.read_text(encoding="utf-8"))


def _coerce_schema(schema: str | Mapping[str, Any] | type) -> tuple[Mapping[str, Any], str]:
    if isinstance(schema, str):
        model = model_for(schema)  # raises for unknown names
        return load_schema(model.__name__), model.__name__
    if isinstance(schema, Mapping):
        name = str(schema.get("title") or "schema")
        return schema, name
    if isinstance(schema, type):
        from .compile import json_schema_for

        return json_schema_for(schema), schema.__name__
    raise TypeError(f"unsupported schema {schema!r}")


def validate(obj: Any, schema: str | Mapping[str, Any] | type) -> list[str]:
    """Validate ``obj`` and return human-readable errors (empty list == valid)."""
    resolved, name = _coerce_schema(schema)
    errors: list[str] = []
    _validate(obj, resolved, "$", resolved, errors)
    semantic = _SEMANTIC_CHECKS.get(name)
    if semantic and isinstance(obj, Mapping):
        for message in semantic(obj):
            if message not in errors:
                errors.append(message)
    return errors


def is_valid(obj: Any, schema: str | Mapping[str, Any] | type) -> bool:
    return not validate(obj, schema)


def assert_valid(obj: Any, schema: str | Mapping[str, Any] | type) -> None:
    resolved, name = _coerce_schema(schema)
    errors = validate(obj, resolved)
    if errors:
        raise SchemaValidationError(errors, name)


def check_schema_version(obj: Mapping[str, Any]) -> list[str]:
    """Reject documents written against a different contract version."""
    found = obj.get("schema_version")
    if found != SCHEMA_VERSION:
        return [
            f"schema_version: must be '{SCHEMA_VERSION}' (got {_show(found)}); "
            "regenerate the document against the current contract"
        ]
    return []


def validate_document(obj: Any, schema: str) -> list[str]:
    """Validate a contract document including its ``schema_version`` pin."""
    errors = validate(obj, schema)
    if isinstance(obj, Mapping):
        errors.extend(check_schema_version(obj))
    return errors


def block_errors(params: Mapping[str, Any], block_schema: Mapping[str, Any]) -> list[str]:
    """Validate one effect's ``params`` against a block param schema."""
    return validate(dict(params), block_schema)


def iter_errors(errors: Iterable[str]) -> str:
    return "\n".join(f"- {e}" for e in errors)
