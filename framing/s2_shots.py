"""
RelatiV Dynamic Framing: Stage S2 - Shot Boundary Detection.
Uses PySceneDetect ContentDetector to detect shot boundaries.
Outputs shots.json to workdir.
"""

from pathlib import Path
from typing import List, Dict, Any
import json
import scenedetect
from scenedetect import open_video, SceneManager, ContentDetector

from .config import compute_config_hash, get_library_versions


def detect_shots(
    norm_video_path: Path,
    workdir: Path,
    config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Detects scene/shot boundaries using PySceneDetect ContentDetector.
    Writes shots.json to workdir and returns the list of shots.
    """
    workdir = Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    shots_cfg = config.get("shots", {})
    threshold = float(shots_cfg.get("threshold", 27.0))
    min_scene_len_s = float(shots_cfg.get("min_scene_len_s", 0.5))

    video = open_video(str(norm_video_path))
    fps = video.frame_rate
    total_frames = video.duration.get_frames()
    total_seconds = float(video.duration.get_seconds())

    min_scene_frames = max(1, int(round(min_scene_len_s * fps)))

    scene_manager = SceneManager()
    scene_manager.add_detector(
        ContentDetector(threshold=threshold, min_scene_len=min_scene_frames)
    )

    scene_manager.detect_scenes(video=video)
    scene_list = scene_manager.get_scene_list()

    shots_data = []
    if not scene_list:
        shots_data.append({
            "shot_id": 0,
            "start_s": 0.0,
            "end_s": round(total_seconds, 4),
            "start_frame": 0,
            "end_frame": total_frames
        })
    else:
        for idx, (start_time, end_time) in enumerate(scene_list):
            shots_data.append({
                "shot_id": idx,
                "start_s": round(float(start_time.get_seconds()), 4),
                "end_s": round(float(end_time.get_seconds()), 4),
                "start_frame": start_time.get_frames(),
                "end_frame": end_time.get_frames()
            })

    output_payload = {
        "_meta": {
            "config_hash": compute_config_hash(config),
            "versions": get_library_versions(),
        },
        "shots": shots_data
    }

    out_file = workdir / "shots.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2)

    return shots_data
