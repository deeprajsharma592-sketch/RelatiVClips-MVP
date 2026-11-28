"""Shared pytest fixtures for the edit engine.

The repo is a product, not just this engine: tests never touch the product's
DATABASE_URL, never call a model API, and write renders under data/renders or
a tmp dir.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import engine_config  # noqa: E402
import schemas.db as db  # noqa: E402

FIXTURES = ROOT / "data" / "fixtures"


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch, tmp_path):
    """Point every test at a throwaway sqlite DB and force mock mode."""
    monkeypatch.setenv("EDIT_MOCK", "1")
    monkeypatch.setenv("EDIT_DB_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("EDIT_RENDERS_DIR", str(tmp_path / "renders"))
    monkeypatch.delenv("EDIT_LLM_API_KEY", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("EDIT_JUDGE_API_KEY", raising=False)
    engine_config.reset_settings_cache()
    db.reset_engine_cache()
    yield
    engine_config.reset_settings_cache()
    db.reset_engine_cache()


@pytest.fixture
def sample_clip() -> Path:
    path = FIXTURES / "sample_5s.mp4"
    if not path.exists():
        pytest.skip("run python scripts/make_fixtures.py first")
    return path


@pytest.fixture
def transcript() -> dict:
    return json.loads((FIXTURES / "transcript_sample.json").read_text())


@pytest.fixture
def story_plan() -> dict:
    return json.loads((FIXTURES / "story_plan_demo_01.json").read_text())


@pytest.fixture
def all_blocks_edl() -> dict:
    return json.loads((FIXTURES / "edl_all_blocks.json").read_text())


@pytest.fixture
def db_session():
    db.init_db()
    with db.session_scope() as session:
        yield session
