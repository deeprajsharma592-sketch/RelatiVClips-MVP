"""
High-Engagement Snapshot Capturer for RelatiV

Extracts key frames (snapshots) from video segments for vision analysis.
These snapshots are used to:
1. Analyze visual content quality with vision models
2. Select frames that best represent each clip
3. Generate thumbnails for final output

The pipeline:
1. Identify high-engagement timestamps from audio analysis
2. Extract frames at those moments
3. Optionally run vision model analysis
4. Return best frames for each clip candidate
"""

import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple
from pathlib import Path
from datetime import datetime
import json
from ..utils.config import TEMP_DIR


class SnapshotConfig:
    NUM_SNAPSHOTS_PER_CLIP = 3
    MAX_FRAME_AGE_SECONDS = 5.0
    PREFERRED_FPS = 2.5
    MIN_FACE_SIZE_RATIO = 0.1
    OUTPUT_SIZE = (720, 1280)
    JPEG_QUALITY = 90


def extract_snapshots_at_timestamps(
    video_path: str,
    timestamps: List[float],
    output_dir: Optional[Path] = None,
    task_id: str = "default"
) -> List[Dict]:
    """
    Extract video frames at specified timestamps.
    
    Args:
        video_path: Path to video file
        timestamps: List of timestamps to capture frames at
        output_dir: Directory to save frames (default: TEMP_DIR/vision_snapshots)
        task_id: Task identifier for naming
        
    Returns:
        List of dicts with snapshot info: {frame_path, timestamp, frame_idx}
    """
    if output_dir is None:
        output_dir = TEMP_DIR / "vision_snapshots"
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[Snapshot] ERROR: Cannot open video {video_path}")
        return []
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    video_duration = total_frames / fps if fps > 0 else 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    print(f"[Snapshot] Video: {width}x{height}, {fps:.1f}fps, {video_duration:.1f}s")
    
    snapshots = []
    
    for i, timestamp in enumerate(sorted(timestamps)):
        timestamp = min(timestamp, video_duration - 0.1)
        
        cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
        ret, frame = cap.read()
        
        if ret and frame is not None:
            frame_path = output_dir / f"snapshot_{task_id}_{i}_{timestamp:.2f}s.jpg"
            cv2.imwrite(str(frame_path), frame, [cv2.IMWRITE_JPEG_QUALITY, SnapshotConfig.JPEG_QUALITY])
            
            snapshots.append({
                "frame_path": str(frame_path),
                "timestamp": round(timestamp, 2),
                "frame_idx": i,
                "video_path": video_path,
                "success": True
            })
            print(f"  [Snapshot] Captured frame at {timestamp:.2f}s -> {frame_path.name}")
        else:
            print(f"  [Snapshot] Failed to capture frame at {timestamp:.2f}s")
            snapshots.append({
                "timestamp": round(timestamp, 2),
                "frame_idx": i,
                "frame_path": None,
                "success": False
            })
    
    cap.release()
    return snapshots


def extract_snapshots_from_energy_peaks(
    video_path: str,
    energy_peaks: List[dict],
    output_dir: Optional[Path] = None,
    task_id: str = "default",
    top_n: int = 5
) -> List[Dict]:
    """
    Extract snapshots at the highest energy moments.
    
    Args:
        video_path: Path to video file
        energy_peaks: List of {timestamp, energy_score, relative_to_mean} from audio_analysis
        output_dir: Directory to save frames
        task_id: Task identifier
        top_n: Number of top energy peaks to capture
        
    Returns:
        List of snapshot dicts
    """
    top_peaks = sorted(energy_peaks, key=lambda x: x.get("energy_score", 0), reverse=True)[:top_n]
    
    timestamps = [peak["timestamp"] for peak in top_peaks]
    
    snapshots = extract_snapshots_at_timestamps(video_path, timestamps, output_dir, task_id)
    
    for i, (snap, peak) in enumerate(zip(snapshots, top_peaks)):
        snap["energy_score"] = peak.get("energy_score")
        snap["relative_energy"] = peak.get("relative_to_mean", 1.0)
    
    return snapshots


def extract_snapshots_for_clip(
    video_path: str,
    clip_start: float,
    clip_end: float,
    output_dir: Optional[Path] = None,
    task_id: str = "default",
    clip_idx: int = 0,
    num_snapshots: int = 3
) -> List[Dict]:
    """
    Extract evenly-spaced snapshots from a video clip.
    
    Useful for selecting the best representative frame for each clip.
    
    Args:
        video_path: Path to video file
        clip_start: Clip start time
        clip_end: Clip end time
        output_dir: Directory for output frames
        task_id: Task identifier
        clip_idx: Which clip this is (for naming)
        num_snapshots: Number of frames to extract
        
    Returns:
        List of snapshot dicts with frames evenly spaced within the clip
    """
    clip_duration = clip_end - clip_start
    
    if clip_duration < 1.0:
        timestamps = [(clip_start + clip_end) / 2]
    else:
        step = clip_duration / (num_snapshots + 1)
        timestamps = [clip_start + step * (i + 1) for i in range(num_snapshots)]
    
    snapshots = extract_snapshots_at_timestamps(video_path, timestamps, output_dir, f"{task_id}_clip{clip_idx}")
    
    for i, snap in enumerate(snapshots):
        snap["clip_start"] = clip_start
        snap["clip_end"] = clip_end
        snap["clip_idx"] = clip_idx
        snap["position_in_clip"] = i + 1
    
    return snapshots


def select_best_snapshot(
    snapshots: List[Dict],
    criteria: str = "center"
) -> Optional[Dict]:
    """
    Select the best snapshot from a list based on criteria.
    
    Args:
        snapshots: List of snapshot dicts
        criteria: Selection strategy:
            - "center": Always pick the middle frame
            - "first": Pick the first frame
            - "high_energy": Pick highest energy timestamp (requires energy_score)
            - "random": Random selection
            
    Returns:
        Best snapshot dict or None
    """
    valid_snapshots = [s for s in snapshots if s.get("success") and s.get("frame_path")]
    
    if not valid_snapshots:
        return None
    
    if criteria == "center":
        idx = len(valid_snapshots) // 2
    elif criteria == "first":
        idx = 0
    elif criteria == "high_energy":
        best = max(valid_snapshots, key=lambda x: x.get("energy_score", 0))
        return best
    elif criteria == "random":
        import random
        idx = random.randint(0, len(valid_snapshots) - 1)
    else:
        idx = len(valid_snapshots) // 2
    
    return valid_snapshots[idx] if valid_snapshots else None


def create_thumbnail(
    frame_path: str,
    output_path: Path,
    size: Tuple[int, int] = (320, 640),
    quality: int = 80
) -> Optional[str]:
    """
    Create a thumbnail from a snapshot.
    
    Args:
        frame_path: Source frame path
        output_path: Output thumbnail path
        size: (width, height) tuple
        quality: JPEG quality 0-100
        
    Returns:
        Output path string or None
    """
    try:
        frame = cv2.imread(frame_path)
        if frame is None:
            return None
        
        thumbnail = cv2.resize(frame, size)
        cv2.imwrite(str(output_path), thumbnail, [cv2.IMWRITE_JPEG_QUALITY, quality])
        
        return str(output_path)
    except Exception as e:
        print(f"[Snapshot] Thumbnail error: {e}")
        return None


def get_snapshot_metadata(frame_path: str) -> Dict:
    """
    Get metadata about a snapshot frame.
    
    Args:
        frame_path: Path to frame image
        
    Returns:
        Dict with metadata: {width, height, size_bytes, format}
    """
    try:
        import os
        frame = cv2.imread(frame_path)
        if frame is None:
            return {}
        
        height, width = frame.shape[:2]
        size_bytes = os.path.getsize(frame_path)
        
        return {
            "width": width,
            "height": height,
            "size_bytes": size_bytes,
            "size_kb": round(size_bytes / 1024, 1),
            "aspect_ratio": round(width / height, 2) if height > 0 else 0,
            "format": "JPEG"
        }
    except Exception as e:
        return {"error": str(e)}


def batch_extract_snapshots_for_clips(
    video_path: str,
    clips: List[Dict],
    energy_peaks: List[dict] = None,
    output_dir: Optional[Path] = None,
    task_id: str = "default"
) -> List[Dict]:
    """
    Extract snapshots for multiple clips.
    
    Args:
        video_path: Path to video file
        clips: List of clip dicts with start/end times
        energy_peaks: Optional energy peaks to guide selection
        output_dir: Output directory for snapshots
        task_id: Task identifier
        
    Returns:
        List of clips with added snapshot info
    """
    if output_dir is None:
        output_dir = TEMP_DIR / "vision_snapshots"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    results = []
    
    for i, clip in enumerate(clips):
        clip_snapshots = extract_snapshots_for_clip(
            video_path=video_path,
            clip_start=clip["start"],
            clip_end=clip["end"],
            output_dir=output_dir,
            task_id=task_id,
            clip_idx=i
        )
        
        best_snapshot = select_best_snapshot(clip_snapshots, criteria="center")
        
        clip_result = {
            **clip,
            "snapshots": clip_snapshots,
            "best_snapshot": best_snapshot,
            "best_frame_path": best_snapshot.get("frame_path") if best_snapshot else None
        }
        
        if best_snapshot and best_snapshot.get("frame_path"):
            clip_result["thumbnail_path"] = str(output_dir / f"thumb_{task_id}_clip{i}.jpg")
            create_thumbnail(
                best_snapshot["frame_path"],
                Path(clip_result["thumbnail_path"])
            )
        
        results.append(clip_result)
        print(f"[Snapshot] Clip {i+1}: best frame at {best_snapshot.get('timestamp', 'N/A'):.1f}s" if best_snapshot else f"[Snapshot] Clip {i+1}: no frames")
    
    metadata = {
        "task_id": task_id,
        "video_path": video_path,
        "num_clips": len(clips),
        "num_snapshots_per_clip": SnapshotConfig.NUM_SNAPSHOTS_PER_CLIP,
        "timestamp": datetime.now().isoformat()
    }
    
    metadata_path = output_dir / f"snapshot_metadata_{task_id}.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    
    return results


def cleanup_snapshots(task_id: str, output_dir: Optional[Path] = None):
    """
    Clean up snapshots for a task.
    
    Args:
        task_id: Task identifier
        output_dir: Directory containing snapshots
    """
    if output_dir is None:
        output_dir = TEMP_DIR / "vision_snapshots"
    
    if not output_dir.exists():
        return
    
    for f in output_dir.glob(f"*_{task_id}*"):
        try:
            f.unlink()
        except:
            pass
    
    for f in output_dir.glob(f"thumb_{task_id}*"):
        try:
            f.unlink()
        except:
            pass
    
    metadata_file = output_dir / f"snapshot_metadata_{task_id}.json"
    if metadata_file.exists():
        try:
            metadata_file.unlink()
        except:
            pass
    
    print(f"[Snapshot] Cleaned up snapshots for task {task_id}")