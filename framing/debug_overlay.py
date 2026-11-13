"""
Debug Overlay mode for RelatiV Dynamic Framing (spec-0.1, Rule 10).
Draws face boxes, track IDs, speaker state, layout state, and crop rects on frames.
"""

from __future__ import annotations

import cv2
import numpy as np
from typing import Any, Dict, List, Optional, Tuple


def draw_debug_overlay(
    frame: np.ndarray,
    frame_idx: int,
    t_sec: float,
    layout_state: str,
    active_speaker: str,
    zoom_scale: float,
    face_boxes: Optional[List[Dict[str, Any]]] = None,
    crop_boxes: Optional[List[Tuple[float, float, float, float]]] = None,
) -> np.ndarray:
    """
    Draw informative HUD and bounding visualizers on video frame.
    All coordinates in frame's pixel dimensions.
    """
    out_frame = frame.copy()
    h, w = out_frame.shape[:2]

    # 1. Draw Crop Rectangles (Cyan for primary crops)
    if crop_boxes:
        for idx, (x1, y1, x2, y2) in enumerate(crop_boxes):
            color = (255, 200, 0) if idx == 0 else (0, 200, 255)  # BGR
            pt1 = (int(round(x1)), int(round(y1)))
            pt2 = (int(round(x2)), int(round(y2)))
            cv2.rectangle(out_frame, pt1, pt2, color, 3)
            label = f"CROP P{idx+1} (9:{16 if layout_state == 'SINGLE' else 8})"
            cv2.putText(
                out_frame, label,
                (pt1[0] + 10, pt1[1] + 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2, cv2.LINE_AA,
            )

    # 2. Draw Detected Face Boxes & Track IDs
    if face_boxes:
        for face in face_boxes:
            box = face.get("box", [0, 0, 0, 0])  # [x, y, w, h]
            track_id = face.get("track_id", "?")
            is_speaker = (str(track_id) == str(active_speaker))

            fx, fy, fw, fh = map(int, box)
            color = (0, 255, 0) if is_speaker else (0, 165, 255)  # Green for active speaker

            cv2.rectangle(out_frame, (fx, fy), (fx + fw, fy + fh), color, 2)
            face_label = f"ID: {track_id} {'[SPEAKER]' if is_speaker else ''}"
            cv2.putText(
                out_frame, face_label,
                (fx, max(20, fy - 10)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA,
            )

    # 3. Draw Global HUD Overlay (top-left)
    hud_lines = [
        f"TIME: {t_sec:05.2f}s (frame {frame_idx})",
        f"LAYOUT: {layout_state}",
        f"SPEAKER: {active_speaker}",
        f"ZOOM: {zoom_scale:.2f}x",
    ]

    hud_bg_w = 340
    hud_bg_h = 30 + len(hud_lines) * 26
    # Semitransparent dark HUD badge
    overlay = out_frame.copy()
    cv2.rectangle(overlay, (15, 15), (15 + hud_bg_w, 15 + hud_bg_h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.75, out_frame, 0.25, 0, out_frame)
    cv2.rectangle(out_frame, (15, 15), (15 + hud_bg_w, 15 + hud_bg_h), (80, 80, 80), 1)

    y_pos = 42
    for line in hud_lines:
        cv2.putText(
            out_frame, line,
            (28, y_pos),
            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2, cv2.LINE_AA,
        )
        y_pos += 26

    return out_frame
