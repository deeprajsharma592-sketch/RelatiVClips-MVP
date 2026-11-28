"""Environment and path configuration for the RelatiV edit engine.

Every knob is an env var so the same code runs locally, in CI with mocks, and
against a different model provider without edits. Nothing here talks to the
network; ``llm_config`` only resolves names and keys.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Mapping

REPO_ROOT = Path(__file__).resolve().parent

_TRUE = {"1", "true", "yes", "on"}


def load_dotenv(path: Path | None = None) -> None:
    """Minimal .env loader for the keys this engine owns.

    We deliberately do not load the whole repo ``.env``: it holds the product's
    database and payment secrets, which the edit engine never needs. Only
    ``EDIT_*`` and provider keys are read, and real env vars always win.
    """
    env_path = path or REPO_ROOT / ".env"
    if not env_path.exists():
        return
    allowed_prefixes = ("EDIT_", "DEEPSEEK_", "OPENROUTER_", "ANTHROPIC_")
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key.startswith(allowed_prefixes):
            continue
        value = value.split(" #", 1)[0].strip().strip('"').strip("'")
        if value:
            os.environ.setdefault(key, value)


def env(name: str, default: str = "") -> str:
    load_dotenv()
    return os.environ.get(name, default).strip()


def env_first(*names: str, default: str = "") -> str:
    for name in names:
        value = env(name)
        if value:
            return value
    return default


def env_bool(name: str, default: bool = False) -> bool:
    raw = env(name)
    if not raw:
        return default
    return raw.lower() in _TRUE


def env_int(name: str, default: int) -> int:
    try:
        return int(env(name) or default)
    except ValueError:
        return default


def env_float(name: str, default: float) -> float:
    try:
        return float(env(name) or default)
    except ValueError:
        return default


@dataclass(frozen=True)
class LLMConfig:
    """One OpenAI-compatible chat endpoint."""

    stage: str
    base_url: str
    api_key: str
    model: str
    timeout_s: float = 120.0
    max_tokens: int = 4096
    temperature: float = 0.7

    @property
    def endpoint(self) -> str:
        base = self.base_url.rstrip("/")
        if base.endswith("/chat/completions"):
            return base
        return f"{base}/chat/completions"

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.base_url and self.model)


def llm_config(stage: str = "editor") -> LLMConfig:
    """Resolve the endpoint for ``editor`` or ``judge``.

    Editor defaults to DeepSeek; judge defaults to an OpenRouter-hosted vision
    model. Both are plain OpenAI-compatible base URLs, so a different provider
    (vLLM, Together, Fireworks, a local llama.cpp server) is a config change.
    """
    if stage == "judge":
        base = env_first(
            "EDIT_JUDGE_BASE_URL", "OPENROUTER_BASE_URL", default="https://openrouter.ai/api/v1"
        )
        key = env_first("EDIT_JUDGE_API_KEY", "OPENROUTER_API_KEY", "ANTHROPIC_API_KEY")
        model = env_first("EDIT_JUDGE_MODEL", default="anthropic/claude-haiku-5.5")
        timeout = env_float("EDIT_JUDGE_TIMEOUT_S", 120.0)
        max_tokens = env_int("EDIT_JUDGE_MAX_TOKENS", 1500)
        temperature = env_float("EDIT_JUDGE_TEMPERATURE", 0.0)
    else:
        base = env_first(
            "EDIT_LLM_BASE_URL", "DEEPSEEK_BASE_URL", default="https://api.deepseek.com"
        )
        key = env_first("EDIT_LLM_API_KEY", "DEEPSEEK_API_KEY", "OPENROUTER_API_KEY")
        # deepseek-flash is DeepSeek-V4.1-Flash; deepseek-chat/reasoner retired 2026-07-24.
        model = env_first("EDIT_LLM_MODEL", "DEEPSEEK_MODEL", default="deepseek-flash")
        timeout = env_float("EDIT_LLM_TIMEOUT_S", 120.0)
        max_tokens = env_int("EDIT_LLM_MAX_TOKENS", 4096)
        temperature = env_float("EDIT_LLM_TEMPERATURE", 0.7)
    return LLMConfig(
        stage=stage,
        base_url=base,
        api_key=key,
        model=model,
        timeout_s=timeout,
        max_tokens=max_tokens,
        temperature=temperature,
    )


def mock_mode(stage: str = "editor") -> bool:
    """Mock when asked, or when the stage has no key (so tests never hit the wire)."""
    if env_bool("EDIT_MOCK", False):
        return True
    if env_bool(f"EDIT_{stage.upper()}_MOCK", False):
        return True
    return not llm_config(stage).configured


@dataclass(frozen=True)
class Settings:
    repo_root: Path = REPO_ROOT
    data_dir: Path = REPO_ROOT / "data"
    renders_dir: Path = REPO_ROOT / "data" / "renders"
    fixtures_dir: Path = REPO_ROOT / "data" / "fixtures"
    assets_dir: Path = REPO_ROOT / "data" / "assets"
    niches_dir: Path = REPO_ROOT / "niches"
    db_url: str = ""
    hyperframes_cli: tuple[str, ...] = ()
    fps: int = 30
    render_workers: int = 1
    default_variants: int = 6
    max_render_workers: int = 2
    extra: Mapping[str, str] = field(default_factory=dict)

    def ensure_dirs(self) -> None:
        for path in (self.data_dir, self.renders_dir, self.fixtures_dir, self.assets_dir):
            path.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def settings() -> Settings:
    load_dotenv()
    cli_raw = env("EDIT_HYPERFRAMES_CLI", default="")
    if cli_raw:
        cli = tuple(cli_raw.split())
    else:
        pinned = env("EDIT_HYPERFRAMES_VERSION", default="0.9.104")
        cli = ("npx", "-y", f"hyperframes@{pinned}")
    db_url = env("EDIT_DB_URL") or f"sqlite:///{(REPO_ROOT / 'data' / 'edit_engine.db').as_posix()}"
    return Settings(
        repo_root=REPO_ROOT,
        data_dir=Path(env("EDIT_DATA_DIR") or REPO_ROOT / "data"),
        renders_dir=Path(env("EDIT_RENDERS_DIR") or REPO_ROOT / "data" / "renders"),
        fixtures_dir=Path(env("EDIT_FIXTURES_DIR") or REPO_ROOT / "data" / "fixtures"),
        assets_dir=Path(env("EDIT_ASSETS_DIR") or REPO_ROOT / "data" / "assets"),
        niches_dir=Path(env("EDIT_NICHES_DIR") or REPO_ROOT / "niches"),
        db_url=db_url,
        hyperframes_cli=cli,
        fps=env_int("EDIT_FPS", 30),
        render_workers=env_int("EDIT_RENDER_WORKERS", 1),
        default_variants=env_int("EDIT_DEFAULT_VARIANTS", 6),
        max_render_workers=env_int("EDIT_MAX_RENDER_WORKERS", 2),
    )


def reset_settings_cache() -> None:
    """Tests change env vars between cases; call this after monkeypatching."""
    settings.cache_clear()
