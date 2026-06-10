import cv2
import numpy as np
from typing import List, Tuple, Optional
from pathlib import Path
from ..utils.config import CROP_WIDTH, CROP_HEIGHT

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
    _face_model = None
except ImportError:
    YOLO_AVAILABLE = False
    _face_model = None


def _get_face_model():
    global _face_model
    if _face_model is None and YOLO_AVAILABLE:
        model_path = Path(__file__).parent.parent / "models" / "yolov10n-face.pt"
        try:
            _face_model = YOLO(str(model_path))
        except Exception:
            try:
                from ultralytics.utils import downloads
                model_path = downloads.attempt_download_asset("yolov10n-face.pt")
                _face_model = YOLO(str(model_path))
            except Exception:
                _face_model = YOLO("yolov10n.pt")
    return _face_model


def detect_face_x_coordinate(
    frame: np.ndarray,
    min_confidence: float = 0.3
) -> Optional[float]:
    model = _get_face_model()
    if model is None:
        return None

    results = model(frame, conf=min_confidence, verbose=False)
    if not results or len(results) == 0:
        return None

    boxes = results[0].boxes
    if boxes is None or len(boxes) == 0:
        return None

    best = None
    best_conf = 0
    for i, box in enumerate(boxes):
        conf = float(box.conf[0])
        if conf > best_conf:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            center_x = (x1 + x2) / 2
            best = center_x
            best_conf = conf

    return best


def detect_face_adaptive(
    frame: np.ndarray,
    video_width: int,
    attempt_multi_pass: bool = True
) -> Tuple[Optional[float], dict]:
    detection_stats = {"attempts": [], "model_used": None, "confidence_used": None}

    strategies = [
        {"confidence": 0.35},
        {"confidence": 0.25},
        {"confidence": 0.15},
    ]

    for strategy in strategies:
        face_x = detect_face_x_coordinate(
            frame,
            min_confidence=strategy["confidence"]
        )

        detection_stats["attempts"].append({
            "confidence": strategy["confidence"],
            "found": face_x is not None
        })

        if face_x is not None:
            detection_stats["confidence_used"] = strategy["confidence"]
            return face_x, detection_stats

    return None, detection_stats


def extract_frame_at_timestamp(video_path: str, timestamp: float) -> np.ndarray:
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
    ret, frame = cap.read()
    cap.release()
    if ret:
        return frame
    return None


def calculate_crop_offset(face_x: float, video_width: int) -> int:
    if face_x is None:
        return video_width // 2
    crop_center = face_x
    crop_x = int(crop_center - (CROP_WIDTH / 2))
    max_offset = max(0, video_width - CROP_WIDTH)
    crop_x = max(0, min(crop_x, max_offset))
    return crop_x


def apply_ema_smoothing(current_value: float, previous_value: float, alpha: float = 0.3) -> float:
    if previous_value is None:
        return current_value
    return alpha * current_value + (1 - alpha) * previous_value


def track_face_smooth(video_path: str, start_time: float, end_time: float, num_samples: int = 10, alpha: float = 0.3) -> dict:
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    video_duration = cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps if fps > 0 else 0

    target_fps = 2.5
    step = max(1, int(fps / target_fps)) if fps > 0 else 1

    frame_positions = []
    frame_count = 0
    face_detected_count = 0

    cap.set(cv2.CAP_PROP_POS_MSEC, start_time * 1000)

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        current_time = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
        if current_time > end_time:
            break

        if frame_count % step == 0:
            face_x, stats = detect_face_adaptive(frame, video_width)

            if face_x is not None:
                frame_positions.append({"time": current_time, "x": face_x})
                face_detected_count += 1

        frame_count += 1

    cap.release()

    if not frame_positions:
        x_offset = calculate_crop_offset(video_width / 2, video_width)
        return {"x_offset": x_offset, "face_detected": False, "smoothing_enabled": False, "frame_positions": []}

    smoothed_positions = []
    prev_smoothed = None
    for pos in frame_positions:
        smoothed_x = apply_ema_smoothing(pos["x"], prev_smoothed, alpha)
        smoothed_positions.append({"time": pos["time"], "raw_x": pos["x"], "smoothed_x": smoothed_x})
        prev_smoothed = smoothed_x

    avg_smoothed = sum(p["smoothed_x"] for p in smoothed_positions) / len(smoothed_positions)
    x_offset = calculate_crop_offset(avg_smoothed, video_width)

    return {
        "x_offset": x_offset,
        "face_detected": True,
        "smoothing_enabled": True,
        "alpha": alpha,
        "frame_positions": smoothed_positions,
        "video_width": video_width,
    }


def get_face_detection_for_clip(video_path: str, start_time: float, end_time: float, progress_callback=None) -> dict:
    if progress_callback:
        progress_callback("Detecting faces with YOLOv10...")

    cap = cv2.VideoCapture(video_path)
    video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    fps = cap.get(cv2.CAP_PROP_FPS)
    video_duration = frame_count / fps if fps > 0 else 0
    cap.release()

    if start_time > video_duration and video_duration > 0:
        start_time = 0
        end_time = min(video_duration, end_time - start_time)

    clip_duration = end_time - start_time
    if clip_duration <= 0:
        start_time = 0
        end_time = video_duration

    return track_face_smooth(video_path, start_time, end_time, num_samples=15, alpha=0.25)


def get_batch_face_data(video_path: str, clips: List[dict], progress_callback=None) -> List[dict]:
    results = []
    for i, clip in enumerate(clips):
        if progress_callback:
            progress_callback(f"Detecting face for clip {i+1}/{len(clips)}...")
        face_data = get_face_detection_for_clip(video_path, clip["start"], clip["end"], progress_callback)
        clip["x_offset"] = face_data["x_offset"]
        clip["face_detected"] = face_data["face_detected"]
        results.append(clip)
    return results
