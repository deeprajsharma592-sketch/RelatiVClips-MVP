"""Edit safety rules, enforced in code rather than in the prompt.

Interpretation note (the brief's rule is ambiguous, so it is pinned down here):

* "no two visual effects overlapping within 300ms" applies to **impact** effects
  (shake, motion_blur, popup, zoom) - the punctuation of an edit. Two impacts may
  not start within 300ms of each other, and two camera moves (shake/zoom/
  motion_blur) may not overlap in time at all, because both would drive the same
  transform.
* ``caption_style`` and ``sfx`` are continuous layers, not punctuation. They are
  not counted against the 3-per-10s or 2-in-the-hook limits, but two caption
  blocks may not overlap (they would double-print the transcript).
* "hook window may contain at most 2 effects" means at most 2 impact effects
  starting in [0, 2s).

Every violation is returned as an error, never silently fixed. The messages name
effect ids and timestamps so the editor can repair them verbatim.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping, Sequence

IMPACT_TYPES = ("shake", "motion_blur", "popup", "zoom")
CAMERA_TYPES = ("shake", "motion_blur", "zoom")

ONSET_SPACING_S = 0.30
DENSITY_WINDOW_S = 10.0
DENSITY_MAX = 3
HOOK_WINDOW_S = 2.0
HOOK_MAX = 2
MIN_EFFECT_S = 0.10


def _window(effect: Mapping[str, Any]) -> tuple[float, float, str, str]:
    return (
        float(effect.get("start", 0.0)),
        float(effect.get("end", 0.0)),
        str(effect.get("id", "?")),
        str(effect.get("type", "?")),
    )


def _fmt(value: float) -> str:
    return f"{value:.2f}s"


def _overlaps(a: tuple[float, float], b: tuple[float, float], gap: float = 0.0) -> bool:
    return a[0] < b[1] + gap and b[0] < a[1] + gap


def check_edl(
    edl: Mapping[str, Any],
    *,
    duration_s: float | None = None,
    transcript: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None = None,
) -> list[str]:
    """Return human-readable safety violations (empty list == safe to render)."""
    errors: list[str] = []
    effects = [e for e in (edl.get("effects") or []) if isinstance(e, Mapping)]
    if not effects:
        return errors

    windows = {id(e): _window(e) for e in effects}

    # R1 - windows must be real, inside the clip, and long enough to see.
    for effect in effects:
        start, end, eff_id, eff_type = windows[id(effect)]
        if end <= start:
            errors.append(f"{eff_id}: end ({end}) must be after start ({start})")
            continue
        if end - start < MIN_EFFECT_S:
            errors.append(
                f"{eff_id}: {eff_type} lasts {_fmt(end - start)}; effects under "
                f"{MIN_EFFECT_S}s are a flicker - extend it or drop it"
            )
        if start < 0:
            errors.append(f"{eff_id}: start ({start}) is before the clip")
        if duration_s is not None and end > duration_s + 0.05:
            errors.append(
                f"{eff_id}: ends at {_fmt(end)}, past the clip duration {_fmt(duration_s)}"
            )

    if duration_s is not None:
        for caption in [e for e in effects if e.get("type") == "caption_style"]:
            if (caption.get("params") or {}).get("words"):
                errors.append(
                    f"{caption.get('id')}: caption params must not carry 'words'; "
                    "the composer fills word timings from the transcript"
                )

    # R2 - one camera move at a time (they share the source transform).
    cameras = [e for e in effects if e.get("type") in CAMERA_TYPES]
    for i, a in enumerate(cameras):
        for b in cameras[i + 1 :]:
            wa, wb = windows[id(a)], windows[id(b)]
            if _overlaps(wa[:2], wb[:2], gap=0.02):
                errors.append(
                    f"{wa[2]} ({wa[3]} {_fmt(wa[0])}-{_fmt(wa[1])}) overlaps "
                    f"{wb[2]} ({wb[3]} {_fmt(wb[0])}-{_fmt(wb[1])}): only one camera move "
                    "(shake/zoom/motion_blur) may run at a time"
                )

    # R3 - impacts may not stack their onsets inside 300ms.
    impacts = sorted(
        [e for e in effects if e.get("type") in IMPACT_TYPES],
        key=lambda e: float(e.get("start", 0.0)),
    )
    for i, a in enumerate(impacts):
        sa = windows[id(a)][0]
        for b in impacts[i + 1 :]:
            sb = windows[id(b)][0]
            if sb - sa >= ONSET_SPACING_S:
                break
            errors.append(
                f"{windows[id(a)][2]} at {_fmt(sa)} and {windows[id(b)][2]} at {_fmt(sb)} start "
                f"within {int(ONSET_SPACING_S * 1000)}ms; give each effect room to land"
            )

    # R4 - at most 3 impact effects in any 10s window.
    for i, anchor in enumerate(impacts):
        start = windows[id(anchor)][0]
        in_window = [e for e in impacts if 0 <= windows[id(e)][0] - start < DENSITY_WINDOW_S]
        if len(in_window) > DENSITY_MAX:
            ids = ", ".join(windows[id(e)][2] for e in in_window)
            errors.append(
                f"{len(in_window)} impact effects ({ids}) start inside the 10s window "
                f"from {_fmt(start)}; the cap is {DENSITY_MAX} - fewer effects beat more"
            )

    # R5 - hook window (0-2s) gets at most 2 impacts.
    hook = [e for e in impacts if windows[id(e)][0] < HOOK_WINDOW_S]
    if len(hook) > HOOK_MAX:
        ids = ", ".join(windows[id(e)][2] for e in hook)
        errors.append(
            f"{len(hook)} impact effects ({ids}) start inside the 0-2s hook window; the cap "
            f"is {HOOK_MAX} - pick the strongest two"
        )

    # R6 - captions may not overlap: it double-prints the transcript.
    captions = [e for e in effects if e.get("type") == "caption_style"]
    for i, a in enumerate(captions):
        for b in captions[i + 1 :]:
            wa, wb = windows[id(a)], windows[id(b)]
            if _overlaps(wa[:2], wb[:2]):
                errors.append(
                    f"caption blocks {wa[2]} and {wb[2]} overlap in time; merge them into one "
                    "caption effect covering the whole span"
                )

    # R7 - popups must not sit on top of the caption band.
    for popup in [e for e in effects if e.get("type") == "popup"]:
        position = str((popup.get("params") or {}).get("position", "top-right"))
        if position.startswith("top"):
            continue
        p_start, p_end, p_id, _ = windows[id(popup)]
        for caption in captions:
            c_start, c_end, c_id, _ = windows[id(caption)]
            if _overlaps((p_start, p_end), (c_start, c_end)):
                errors.append(
                    f"{p_id}: popup at '{position}' overlaps captions {c_id} "
                    f"({_fmt(c_start)}-{_fmt(c_end)}); move it to a top corner or drop it"
                )

    return errors


def impact_effects(effects: Iterable[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    return [e for e in effects if e.get("type") in IMPACT_TYPES]


def summarize(edl: Mapping[str, Any]) -> dict[str, Any]:
    effects = [e for e in (edl.get("effects") or []) if isinstance(e, Mapping)]
    by_type: dict[str, int] = {}
    for effect in effects:
        by_type[str(effect.get("type"))] = by_type.get(str(effect.get("type")), 0) + 1
    return {
        "total": len(effects),
        "by_type": by_type,
        "impacts": len(impact_effects(effects)),
    }
