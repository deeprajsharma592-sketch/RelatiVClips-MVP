"""
RelatiV Dynamic Framing: Stage S3 - Face Detection, Tracking & Landmarks.
Uses YuNet (cv2.FaceDetectorYN) for face detection, Kalman/IoU tracker for association,
and MediaPipe FaceMesh for Mouth Aspect Ratio (MAR) extraction.
Outputs tracks.json to workdir.
"""

from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import math
import json
import cv2
import numpy as np
import mediapipe as mp

from .config import compute_config_hash, get_library_versions


class Track:
    def __init__(self, track_id: int, init_box: List[float], init_t: float, init_score: float, init_mar: float):
        self.track_id = track_id
        self.box = list(init_box)  # [x, y, w, h]
        self.cx = init_box[0] + init_box[2] / 2.0
        self.cy = init_box[1] + init_box[3] / 2.0
        self.w = init_box[2]
        self.h = init_box[3]
        self.vx = 0.0
        self.vy = 0.0
        self.last_seen_t = init_t
        self.start_t = init_t
        self.samples: List[Dict[str, Any]] = [
            {"t": round(init_t, 4), "box": [round(v, 2) for v in init_box], "score": round(init_score, 3), "mar": round(init_mar, 4)}
        ]

    def predict(self, dt: float):
        self.cx += self.vx * dt
        self.cy += self.vy * dt
        self.box = [self.cx - self.w / 2.0, self.cy - self.h / 2.0, self.w, self.h]

    def update(self, det_box: List[float], t: float, score: float, mar: float, dt: float):
        det_cx = det_box[0] + det_box[2] / 2.0
        det_cy = det_box[1] + det_box[3] / 2.0

        if dt > 0:
            inst_vx = (det_cx - self.cx) / dt
            inst_vy = (det_cy - self.cy) / dt
            self.vx = 0.7 * self.vx + 0.3 * inst_vx
            self.vy = 0.7 * self.vy + 0.3 * inst_vy

        self.cx = det_cx
        self.cy = det_cy
        self.w = det_box[2]
        self.h = det_box[3]
        self.box = list(det_box)
        self.last_seen_t = t
        self.samples.append({
            "t": round(t, 4),
            "box": [round(v, 2) for v in det_box],
            "score": round(score, 3),
            "mar": round(mar, 4)
        })

    def hold(self, t: float):
        # Sample held position during gap
        self.samples.append({
            "t": round(t, 4),
            "box": [round(v, 2) for v in self.box],
            "score": 0.0,
            "mar": 0.0
        })


def compute_iou(boxA: List[float], boxB: List[float]) -> float:
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[0] + boxA[2], boxB[0] + boxB[2])
    yB = min(boxA[1] + boxA[3], boxB[1] + boxB[3])

    inter_w = max(0.0, xB - xA)
    inter_h = max(0.0, yB - yA)
    inter_area = inter_w * inter_h

    areaA = boxA[2] * boxA[3]
    areaB = boxB[2] * boxB[3]
    union_area = areaA + areaB - inter_area
    if union_area <= 0:
        return 0.0
    return inter_area / union_area


def compute_mar_from_crop(face_crop: np.ndarray, face_mesh: Any) -> float:
    """Computes mouth aspect ratio (MAR) from inner lip landmarks (13, 14) and corners (78, 308)."""
    if face_crop is None or face_crop.shape[0] < 10 or face_crop.shape[1] < 10:
        return 0.0

    rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb)
    if not results.multi_face_landmarks:
        return 0.0

    landmarks = results.multi_face_landmarks[0].landmark
    h, w = face_crop.shape[:2]

    p13 = (landmarks[13].x * w, landmarks[13].y * h)
    p14 = (landmarks[14].x * w, landmarks[14].y * h)
    p78 = (landmarks[78].x * w, landmarks[78].y * h)
    p308 = (landmarks[308].x * w, landmarks[308].y * h)

    inner_lip_gap = math.hypot(p13[0] - p14[0], p13[1] - p14[1])
    mouth_width = math.hypot(p78[0] - p308[0], p78[1] - p308[1])

    if mouth_width < 1e-3:
        return 0.0
    return float(inner_lip_gap / mouth_width)


def detect_and_track_faces(
    norm_video_path: Path,
    shots: List[Dict[str, Any]],
    workdir: Path,
    config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Performs face detection with YuNet and tracking with MAR computation per shot.
    Outputs tracks.json to workdir.
    """
    workdir = Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    face_cfg = config.get("face_detection", {})
    detect_fps = float(face_cfg.get("detect_fps", 8.0))
    detect_width = int(face_cfg.get("detect_width", 640))
    score_threshold = float(face_cfg.get("score_threshold", 0.7))
    min_face_height_frac = float(face_cfg.get("min_face_height_frac", 0.08))
    min_track_persistence_s = float(face_cfg.get("min_track_persistence_s", 0.5))
    max_gap_s = float(face_cfg.get("max_gap_s", 1.0))
    iou_threshold = float(face_cfg.get("iou_threshold", 0.3))

    cap = cv2.VideoCapture(str(norm_video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video {norm_video_path}")

    src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    # Initialize YuNet detector
    model_path = Path(__file__).parent / "models" / "face_detection_yunet_2023mar.onnx"
    scale_factor = src_w / float(detect_width)
    detect_h = int(round(src_h / scale_factor))

    detector = cv2.FaceDetectorYN.create(
        str(model_path), "", (detect_width, detect_h), score_threshold=score_threshold
    )

    # Initialize MediaPipe FaceMesh
    face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5
    )

    step_frames = max(1, int(round(video_fps / detect_fps)))
    min_face_h_px = min_face_height_frac * src_h

    all_tracks_output: List[Dict[str, Any]] = []
    global_track_counter = 0

    try:
        # Process shot by shot (Never track across shot boundaries)
        for shot in shots:
            shot_id = shot["shot_id"]
            start_f = shot["start_frame"]
            end_f = shot["end_frame"]

            active_tracks: List[Track] = []
            completed_tracks: List[Track] = []

            cap.set(cv2.CAP_PROP_POS_FRAMES, start_f)
            curr_frame = start_f

            while curr_frame < end_f:
                ret, frame = cap.read()
                if not ret:
                    break

                if (curr_frame - start_f) % step_frames == 0:
                    curr_t = curr_frame / video_fps
                    dt = step_frames / video_fps

                    # Resize for detector
                    small = cv2.resize(frame, (detect_width, detect_h))
                    detector.setInputSize((detect_width, detect_h))
                    _, detections = detector.detect(small)

                    cand_boxes = []
                    cand_scores = []
                    cand_mars = []

                    if detections is not None:
                        for det in detections:
                            score = float(det[14])
                            if score < score_threshold:
                                continue
                            # Scale coordinates back to original frame
                            bx = float(det[0] * scale_factor)
                            by = float(det[1] * scale_factor)
                            bw = float(det[2] * scale_factor)
                            bh = float(det[3] * scale_factor)

                            if bh < min_face_h_px:
                                continue

                            # Crop face for MAR computation
                            pad_x = 0.1 * bw
                            pad_y = 0.1 * bh
                            x1 = max(0, int(bx - pad_x))
                            y1 = max(0, int(by - pad_y))
                            x2 = min(src_w, int(bx + bw + pad_x))
                            y2 = min(src_h, int(by + bh + pad_y))

                            face_crop = frame[y1:y2, x1:x2]
                            mar = compute_mar_from_crop(face_crop, face_mesh)

                            cand_boxes.append([bx, by, bw, bh])
                            cand_scores.append(score)
                            cand_mars.append(mar)

                    # Predict existing tracks
                    for trk in active_tracks:
                        trk.predict(dt)

                    # Match detections to active tracks via IoU
                    matched_det_indices = set()
                    matched_trk_indices = set()

                    if active_tracks and cand_boxes:
                        iou_matrix = np.zeros((len(active_tracks), len(cand_boxes)))
                        for ti, trk in enumerate(active_tracks):
                            for di, box in enumerate(cand_boxes):
                                iou_matrix[ti, di] = compute_iou(trk.box, box)

                        # Greedy matching by highest IoU
                        while True:
                            ti, di = np.unravel_index(np.argmax(iou_matrix), iou_matrix.shape)
                            max_iou = iou_matrix[ti, di]
                            if max_iou < iou_threshold:
                                break
                            matched_trk_indices.add(ti)
                            matched_det_indices.add(di)
                            active_tracks[ti].update(cand_boxes[di], curr_t, cand_scores[di], cand_mars[di], dt)
                            iou_matrix[ti, :] = -1
                            iou_matrix[:, di] = -1

                    # Handle unmatched active tracks
                    surviving_tracks = []
                    for ti, trk in enumerate(active_tracks):
                        if ti not in matched_trk_indices:
                            gap = curr_t - trk.last_seen_t
                            if gap <= max_gap_s:
                                trk.hold(curr_t)
                                surviving_tracks.append(trk)
                            else:
                                completed_tracks.append(trk)
                        else:
                            surviving_tracks.append(trk)
                    active_tracks = surviving_tracks

                    # Handle unmatched detections (new tracks)
                    for di, box in enumerate(cand_boxes):
                        if di not in matched_det_indices:
                            new_trk = Track(global_track_counter, box, curr_t, cand_scores[di], cand_mars[di])
                            global_track_counter += 1
                            active_tracks.append(new_trk)

                curr_frame += 1

            completed_tracks.extend(active_tracks)

            # Filter out tracks with duration < min_track_persistence_s
            stable_tracks: List[Track] = []
            for trk in completed_tracks:
                duration = trk.last_seen_t - trk.start_t
                if duration >= min_track_persistence_s:
                    stable_tracks.append(trk)

            # Assign panel order by mean horizontal position (leftmost = P1, next = P2)
            track_mean_xs = []
            for trk in stable_tracks:
                mean_x = np.mean([s["box"][0] + s["box"][2] / 2.0 for s in trk.samples])
                track_mean_xs.append((mean_x, trk))

            track_mean_xs.sort(key=lambda item: item[0])

            for order_idx, (_, trk) in enumerate(track_mean_xs):
                panel_label = f"P{order_idx + 1}"
                all_tracks_output.append({
                    "track_id": trk.track_id,
                    "shot_id": shot_id,
                    "panel_label": panel_label,
                    "start_s": round(trk.start_t, 4),
                    "end_s": round(trk.last_seen_t, 4),
                    "samples": trk.samples
                })

    finally:
        cap.release()
        face_mesh.close()

    output_payload = {
        "_meta": {
            "config_hash": compute_config_hash(config),
            "versions": get_library_versions(),
        },
        "tracks": all_tracks_output
    }

    out_file = workdir / "tracks.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2)

    return all_tracks_output
