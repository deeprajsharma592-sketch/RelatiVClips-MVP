"""Content-aware layout policy for vertical clip rendering.

The policy intentionally stays deterministic.  Visual analysis can recommend a
scene-preserving layout, while explicit product metadata always wins.  This
keeps a four-clip batch visually varied without allowing the renderer to flip
layouts unpredictably inside an individual clip.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import random
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

import cv2
import numpy as np


CONTEXT_HINTS = {
    "gaming", "gameplay", "irl", "stream", "streamer", "sports",
    "tutorial", "screen", "screencast", "presentation", "education",
}
CONVERSATION_HINTS = {"podcast", "interview", "conversation", "panel"}


@dataclass(frozen=True)
class ContextSignals:
    landscape: bool
    sampled_frames: int
    edge_density: float
    scene_change: float
    face_count: int
    face_coverage: float


@dataclass(frozen=True)
class LayoutDecision:
    mode: str
    context_position: str
    reason: str
    signals: Dict[str, Any]


def batch_context_position(clip_index: int, seed: str = "relativ") -> str:
    """Return a stable, shuffled 2-up/2-down order for each four-clip batch.

    The task seed makes batches look varied while remaining reproducible during
    retries. Every full group still contains two context-top and two
    context-bottom renders.
    """
    index = max(1, int(clip_index)) - 1
    group, slot = divmod(index, 4)
    digest = hashlib.blake2b(f"{seed}:{group}".encode(), digest_size=8).digest()
    rng = random.Random(int.from_bytes(digest, "big"))
    positions = ["top", "top", "bottom", "bottom"]
    rng.shuffle(positions)
    return positions[slot]


def _normalise_hint(content_hint: Optional[str]) -> str:
    return str(content_hint or "").strip().lower().replace("-", "_")


def analyze_visual_context(
    video_path: str | Path,
    tracks: Iterable[Dict[str, Any]],
    sample_count: int = 9,
) -> ContextSignals:
    """Estimate whether losing the landscape canvas would lose information.

    Edge density catches slides, UI, HUDs and large graphic/text layouts. Scene
    change catches active IRL/game footage. Face coverage keeps a normal talking
    head in the simpler portrait crop when it already dominates the frame.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return ContextSignals(False, 0, 0.0, 0.0, 0, 0.0)

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_count = max(1, int(cap.get(cv2.CAP_PROP_FRAME_COUNT)))
    positions = np.linspace(0, frame_count - 1, min(sample_count, frame_count), dtype=int)
    edges = []
    changes = []
    previous = None
    sampled = 0
    for position in positions:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(position))
        ok, frame = cap.read()
        if not ok or frame is None:
            continue
        sampled += 1
        small = cv2.resize(frame, (320, max(1, int(320 * height / max(1, width)))))
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        edge_map = cv2.Canny(gray, 80, 180)
        edges.append(float(np.mean(edge_map > 0)))
        if previous is not None:
            changes.append(float(np.mean(cv2.absdiff(gray, previous))) / 255.0)
        previous = gray
    cap.release()

    track_list = list(tracks)
    face_areas = []
    for track in track_list:
        for sample in track.get("samples", []):
            box = sample.get("box") or []
            if len(box) >= 4 and width > 0 and height > 0:
                face_areas.append(float(box[2] * box[3]) / float(width * height))

    return ContextSignals(
        landscape=width > height * 1.15,
        sampled_frames=sampled,
        edge_density=round(float(np.mean(edges)) if edges else 0.0, 4),
        scene_change=round(float(np.mean(changes)) if changes else 0.0, 4),
        face_count=len({t.get("panel_label") for t in track_list if t.get("panel_label")}),
        face_coverage=round(float(np.median(face_areas)) if face_areas else 0.0, 4),
    )


def choose_layout(
    requested_mode: str,
    context_position: str,
    content_hint: Optional[str],
    signals: ContextSignals,
) -> LayoutDecision:
    requested = str(requested_mode or "auto").strip().lower()
    position = "bottom" if str(context_position).lower() == "bottom" else "top"
    hint = _normalise_hint(content_hint)
    signal_dict = asdict(signals)

    if requested in {"portrait", "context", "conversation", "fit"}:
        return LayoutDecision(requested, position, "explicit layout request", signal_dict)

    # 1. Multi-person conversation / podcast (2+ distinct tracked faces in landscape)
    if signals.landscape and signals.face_count >= 2:
        return LayoutDecision("conversation", position, "two-person conversation", signal_dict)
    if any(token in hint for token in CONVERSATION_HINTS) and signals.face_count >= 2:
        return LayoutDecision("conversation", position, "two-person conversation", signal_dict)

    # 2. Zero faces detected in landscape (gameplay, screencast, b-roll, demo) -> fullframe fit/blur
    if signals.landscape and signals.face_count == 0:
        return LayoutDecision("fit", position, "no face detected — preserving fullframe with blur backdrop", signal_dict)

    # 3. Content explicitly flagged as context (gaming, tutorial, slides)
    if any(token in hint for token in CONTEXT_HINTS) and signals.landscape:
        return LayoutDecision("context", position, f"content hint: {hint}", signal_dict)

    # UI/text-heavy frames tend to exceed ~9% Canny edge coverage. Fast IRL or
    # gameplay footage produces a larger inter-sample luminance delta. Require a
    # persistent face so the second panel has a meaningful tracked subject.
    context_rich = signals.edge_density >= 0.09 or signals.scene_change >= 0.105
    face_is_not_already_dominant = 0 < signals.face_coverage < 0.12
    if signals.landscape and signals.face_count == 1 and context_rich and face_is_not_already_dominant:
        return LayoutDecision("context", position, "visual context would be lost by portrait crop", signal_dict)
    return LayoutDecision("portrait", position, "single-subject portrait crop", signal_dict)

