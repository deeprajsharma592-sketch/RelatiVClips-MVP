from __future__ import annotations

from typing import Iterable

SLOTS = {
    "low": (540, 1190, 0.0, 1.0),
    "mid_low": (540, 1037, 0.3, 1.0),
    "high": (540, 461, 0.6, 1.0),
    "mid": (540, 806, 1.2, 1.0),
    "left_low": (310, 1190, 0.5, 0.85),
    "right_low": (770, 1190, 0.5, 0.85),
    "left_high": (310, 461, 0.5, 0.85),
    "right_high": (770, 461, 0.5, 0.85),
}


def _union(boxes: Iterable[list[float] | None]) -> list[float] | None:
    valid = [b for b in boxes if b and len(b) == 4]
    if not valid:
        return None
    return [min(b[0] for b in valid), min(b[1] for b in valid), max(b[2] for b in valid), max(b[3] for b in valid)]


def _overlap(rect: list[float], box: list[float] | None) -> float:
    if not box:
        return 0.0
    x1, y1 = max(rect[0], box[0]), max(rect[1], box[1])
    x2, y2 = min(rect[2], box[2]), min(rect[3], box[3])
    area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    denom = max(1.0, (rect[2] - rect[0]) * (rect[3] - rect[1]))
    return area / denom


def choose_layout(groups: list[dict], subject_track: list[dict] | None, preset: str) -> list[dict]:
    track = subject_track or []
    order = list(SLOTS)
    if preset == "stack":
        order = ["low", "mid_low", "left_low", "right_low", "left_high", "right_high", "high", "mid"]
    if preset == "hookcard":
        order = ["high", "left_high", "right_high", "low", "mid_low", "mid"]
    previous = None
    last_switch = -99.0
    layouts = []
    for index, group in enumerate(groups):
        samples = [s for s in track if group["start"] <= float(s.get("t", -1)) <= group["end"]]
        face = _union([s.get("face_box") for s in samples])
        body = _union([s.get("person_box") for s in samples])
        width, height = group.get("block_size", (820, 180))
        scored = []
        for name in order:
            x, y, penalty, scale = SLOTS[name]
            w, h = width * scale, height * scale
            rect = [x - w / 2, y - h / 2, x + w / 2, y + h / 2]
            face_overlap, body_overlap = _overlap(rect, face), _overlap(rect, body)
            scored.append((face_overlap > 0.02, face_overlap * 10 + body_overlap + penalty, face_overlap, name, x, y, scale))
        allowed = [row for row in scored if not row[0]]
        best = min(allowed or scored, key=lambda row: (row[1], row[2]))
        if previous:
            old = next((row for row in scored if row[3] == previous), None)
            if old and not old[0] and (group["start"] - last_switch < 1.2 or old[1] <= best[1] + 0.5):
                best = old
        if best[3] != previous:
            last_switch = group["start"]
        previous = best[3]
        layouts.append({"group_id": index, "slot": best[3], "x": best[4], "y": best[5], "scale": best[6], "face_overlap": round(best[2], 4)})
    return layouts
