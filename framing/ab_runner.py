"""
RelatiV Dynamic Framing: Phase 6 - A/B Evaluation Suite (Section 8 of spec-0.1).
Automates variant evaluation, metrics computation across fixtures,
config hashing, and side-by-side comparison rendering.
"""

from __future__ import annotations

import argparse
import copy
import json
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

from .config import load_config, compute_config_hash
from .run import run_pipeline


EXPERIMENT_VARIANTS: Dict[str, Dict[str, Dict[str, Any]]] = {
    # AB3: Best camera smoothing (M6, overshoot)
    "AB3_smoothing": {
        "variant_A": {"camera": {"smoothing": "gaussian", "gaussian_sigma_s": 0.25}},
        "variant_B": {"camera": {"smoothing": "savgol", "gaussian_sigma_s": 0.25}},
        "variant_C": {"camera": {"smoothing": "one_euro", "gaussian_sigma_s": 0.25}},
    },
    # AB5: Layout hysteresis (M3, M4 switches/min)
    "AB5_hysteresis": {
        "variant_A": {"layout": {"min_hold_s": 2.0, "single_enter_hold_s": 3.0}},
        "variant_B": {"layout": {"min_hold_s": 1.5, "single_enter_hold_s": 2.0}},
        "variant_C": {"layout": {"min_hold_s": 3.0, "single_enter_hold_s": 4.0}},
    },
    # AB6: Impact zoom scale (M9, retention)
    "AB6_zoom_scale": {
        "variant_A": {"zoom": {"max_scale": 1.12}},
        "variant_B": {"zoom": {"max_scale": 1.00}},  # no zoom
        "variant_C": {"zoom": {"max_scale": 1.06}},  # subtle zoom
    },
    # AB8: Active speaker emphasis in stack
    "AB8_stack_emphasis": {
        "variant_A": {"stack": {"emphasis": "none"}},
        "variant_B": {"stack": {"emphasis": "dim_inactive"}},
    },
    # AB9: Impact word source (LLM words only vs loudness only vs both)
    "AB9_impact_source": {
        "variant_A": {"zoom": {"loudness_peaks": False, "mode": "words_only"}},
        "variant_B": {"zoom": {"loudness_peaks": True, "mode": "loudness_only"}},
        "variant_C": {"zoom": {"loudness_peaks": True, "mode": "both"}},
    },
    # AB10: Fallback look
    "AB10_fallback_look": {
        "variant_A": {"fallback": {"style": "blur_fit"}},
        "variant_B": {"fallback": {"style": "center_crop"}},
    },
}


def deep_merge(base: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively merges dictionary overrides into a base dictionary."""
    merged = copy.deepcopy(base)
    for k, v in overrides.items():
        if isinstance(v, dict) and k in merged and isinstance(merged[k], dict):
            merged[k] = deep_merge(merged[k], v)
        else:
            merged[k] = copy.deepcopy(v)
    return merged


def create_ab_split_video(
    video_a_path: str | Path,
    video_b_path: str | Path,
    out_path: str | Path,
    label_a: str = "A (Control)",
    label_b: str = "B (Variant)",
) -> Path:
    """
    Creates a side-by-side comparison video (1080x1920 each, combined to 2160x1920)
    for blinded human preference evaluation (Section 8.2).
    """
    cap_a = cv2.VideoCapture(str(video_a_path))
    cap_b = cv2.VideoCapture(str(video_b_path))
    fps = cap_a.get(cv2.CAP_PROP_FPS) or 30.0

    out_p = Path(out_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_p), fourcc, fps, (2160, 1920))

    try:
        while True:
            ret_a, frame_a = cap_a.read()
            ret_b, frame_b = cap_b.read()
            if not ret_a or not ret_b or frame_a is None or frame_b is None:
                break

            # Draw labels
            cv2.putText(frame_a, label_a, (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.8, (0, 255, 255), 4)
            cv2.putText(frame_b, label_b, (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.8, (0, 255, 255), 4)

            # Horizontal split (Side-by-side)
            split_frame = np.hstack([frame_a, frame_b])
            writer.write(split_frame)
    finally:
        cap_a.release()
        cap_b.release()
        writer.release()

    return out_p


def run_ab_experiment(
    experiment_id: str,
    fixtures: List[Path],
    base_config_path: Path,
    workdir: Path,
) -> Dict[str, Any]:
    """
    Executes all arms of a given experiment across the specified fixtures,
    evaluating metrics and compiling a comparative score matrix.
    """
    if experiment_id not in EXPERIMENT_VARIANTS:
        raise ValueError(f"Unknown experiment: {experiment_id}. Available: {list(EXPERIMENT_VARIANTS.keys())}")

    base_cfg = load_config(base_config_path)
    arms = EXPERIMENT_VARIANTS[experiment_id]
    results: Dict[str, Any] = {
        "experiment_id": experiment_id,
        "arms": {},
        "summary": {},
    }

    for arm_name, overrides in arms.items():
        arm_cfg = deep_merge(base_cfg, overrides)
        # Update config hash
        arm_cfg["_meta"] = {
            "config_hash": compute_config_hash(arm_cfg),
            "experiment": experiment_id,
            "arm": arm_name,
        }

        arm_dir = workdir / experiment_id / arm_name
        arm_dir.mkdir(parents=True, exist_ok=True)

        arm_cfg_file = arm_dir / "config.yaml"
        import yaml
        with open(arm_cfg_file, "w") as f:
            yaml.dump(arm_cfg, f)

        arm_fixture_metrics: Dict[str, Any] = {}

        for fix in fixtures:
            fix_id = fix.stem
            fix_work = arm_dir / fix_id
            fix_work.mkdir(parents=True, exist_ok=True)
            out_mp4 = fix_work / f"{fix_id}_{arm_name}.mp4"

            qa = run_pipeline(
                clip_path=fix,
                output_path=out_mp4,
                workdir=fix_work,
                config_path=arm_cfg_file,
            )
            arm_fixture_metrics[fix_id] = {
                "status": qa.get("status"),
                "switches_per_min": qa.get("switches_per_minute"),
                "short_states": qa.get("short_state_violations"),
                "fallback_pct": qa.get("fallback_pct"),
                "realtime_factor": qa.get("realtime_factor"),
                "metrics": qa.get("metrics", {}),
            }

        results["arms"][arm_name] = {
            "overrides": overrides,
            "config_hash": arm_cfg["_meta"]["config_hash"],
            "fixture_metrics": arm_fixture_metrics,
        }

    # Save results artifact
    res_path = workdir / experiment_id / "ab_results.json"
    with open(res_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    return results
