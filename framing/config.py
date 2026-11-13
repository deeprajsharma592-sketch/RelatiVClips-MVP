"""
Config loader and validator for RelatiV Dynamic Framing (spec-0.1).
Computes SHA256 config hash and captures environment library versions.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional
import yaml


def get_binary_paths() -> Dict[str, str]:
    """Find ffmpeg and ffprobe, checking venv bin, static-ffmpeg, and PATH."""
    venv_bin = Path(__file__).resolve().parent.parent / ".venv_framing" / "bin"
    ffmpeg_cand = str(venv_bin / "ffmpeg")
    ffprobe_cand = str(venv_bin / "ffprobe")

    ffmpeg_bin = ffmpeg_cand if os.path.exists(ffmpeg_cand) else shutil.which("ffmpeg") or "ffmpeg"
    ffprobe_bin = ffprobe_cand if os.path.exists(ffprobe_cand) else shutil.which("ffprobe") or "ffprobe"

    return {
        "ffmpeg": ffmpeg_bin,
        "ffprobe": ffprobe_bin,
    }


def get_library_versions() -> Dict[str, str]:
    """Capture pinned library versions for artifact reproducibility (Rule 9)."""
    versions: Dict[str, str] = {}

    # Python packages
    try:
        import numpy
        versions["numpy"] = numpy.__version__
    except Exception:
        versions["numpy"] = "unknown"

    try:
        import cv2
        versions["opencv"] = cv2.__version__
    except Exception:
        versions["opencv"] = "unknown"

    try:
        import torch
        versions["torch"] = torch.__version__
    except Exception:
        versions["torch"] = "unknown"

    try:
        import mediapipe
        versions["mediapipe"] = mediapipe.__version__
    except Exception:
        versions["mediapipe"] = "unknown"

    try:
        import scenedetect
        versions["scenedetect"] = scenedetect.__version__
    except Exception:
        versions["scenedetect"] = "unknown"

    try:
        import yaml
        versions["pyyaml"] = getattr(yaml, "__version__", "unknown")
    except Exception:
        versions["pyyaml"] = "unknown"

    # FFmpeg version
    bins = get_binary_paths()
    try:
        out = subprocess.run([bins["ffmpeg"], "-version"], capture_output=True, text=True, timeout=5)
        first_line = out.stdout.splitlines()[0] if out.stdout else "unknown"
        versions["ffmpeg"] = first_line.strip()
    except Exception as e:
        versions["ffmpeg"] = f"error: {e}"

    return versions


def compute_config_hash(cfg: Dict[str, Any]) -> str:
    """Compute deterministic SHA256 of the configuration."""
    canonical_json = json.dumps(cfg, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def load_config(config_path: Optional[str | Path] = None) -> Dict[str, Any]:
    """Load, validate, and compute hash for config.yaml."""
    if config_path is None:
        config_path = Path(__file__).resolve().parent / "config.yaml"
    else:
        config_path = Path(config_path)

    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    if not isinstance(cfg, dict):
        raise ValueError(f"Invalid YAML config format in {config_path}")

    # Validate mandatory sections
    required_sections = ["output", "normalize", "shots", "faces", "speaker", "turns", "layout", "camera", "zoom", "fallback", "render"]
    for sec in required_sections:
        if sec not in cfg:
            raise ValueError(f"Missing required config section: '{sec}' in {config_path}")

    cfg_hash = compute_config_hash(cfg)
    cfg["_meta"] = {
        "config_hash": cfg_hash,
        "config_path": str(config_path),
        "versions": get_library_versions(),
    }

    return cfg
