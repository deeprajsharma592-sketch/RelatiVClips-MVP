"""Generate ``schemas/json/*.schema.json`` from the pydantic contracts.

Run ``python -m schemas.compile`` after every model change; the editor prompt's
block/contract catalog and the validator both read these files, so a stale file
is a stale contract.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import CONTRACTS, SCHEMA_VERSION, StrictModel

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "schemas" / "json"

_FILE_NAMES = {
    "StoryPlan": "story_plan.schema.json",
    "EDL": "edl.schema.json",
    "JudgeReport": "judge_report.schema.json",
}


def schema_file_name(name: str) -> str:
    return _FILE_NAMES[name]


def json_schema_for(model: type[StrictModel]) -> dict[str, Any]:
    schema = model.model_json_schema(mode="validation")
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    schema["title"] = model.__name__
    schema["description"] = (model.__doc__ or "").strip().splitlines()[0] if model.__doc__ else ""
    _pin_schema_version(schema)
    return schema


def _pin_schema_version(schema: dict[str, Any]) -> None:
    """``schema_version`` is optional in Python (defaulted) but required on the wire."""
    props = schema.get("properties", {})
    if "schema_version" not in props:
        return
    props["schema_version"] = {
        "type": "string",
        "const": SCHEMA_VERSION,
        "description": f"Contract version. Must be '{SCHEMA_VERSION}'.",
    }
    required = schema.setdefault("required", [])
    if "schema_version" not in required:
        required.append("schema_version")
    # Pydantic keeps the Python default; on the wire there is no default.
    props["schema_version"].pop("default", None)


def write_schemas(out_dir: Path | None = None) -> dict[str, Path]:
    target = out_dir or OUT_DIR
    target.mkdir(parents=True, exist_ok=True)
    written: dict[str, Path] = {}
    for name, model in CONTRACTS.items():
        path = target / schema_file_name(name)
        path.write_text(
            json.dumps(json_schema_for(model), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        written[name] = path
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "contracts": {name: schema_file_name(name) for name in CONTRACTS},
    }
    (target / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return written


def main() -> None:
    written = write_schemas()
    for name, path in written.items():
        print(f"{name:12s} -> {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
