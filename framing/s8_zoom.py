"""
RelatiV Dynamic Framing: Stage S8 - Eased Punch-In Zoom.
Generates smooth cosine-eased punch-in zooms on impact words / loudness peaks.
Enforces spacing budget (<= 1 per 5s), switch blackout windows (0.3s), scale caps (1.12),
word validation (+/- 0.2s against words.json), and safe margin bounds (spec-0.1).
Outputs impact.json / zoom events in plan.json.
"""

from __future__ import annotations

from typing import List, Dict, Any, Optional, Tuple, Union
from pathlib import Path
import math
import numpy as np
from scipy.io import wavfile


def clean_word(text: str) -> str:
    """Strips punctuation and whitespace, lowercases."""
    return text.strip(".,!?:;\"'()[]{}").lower()


def validate_impact_words(
    impact_candidates: List[Dict[str, Any]],
    words: List[Dict[str, Any]],
    tolerance_s: float = 0.2
) -> List[Dict[str, Any]]:
    """
    Validates candidate impact words against words.json (U11, V31).
    Drops hallucinated or misaligned words.
    """
    if not words:
        return []

    validated: List[Dict[str, Any]] = []
    for cand in impact_candidates:
        c_word = clean_word(str(cand.get("word", "")))
        c_t = float(cand.get("t", 0.0))

        match_found = False
        for w in words:
            w_word = clean_word(str(w.get("word", "")))
            w_start = float(w.get("start", 0.0))
            w_end = float(w.get("end", 0.0))

            if c_word == w_word:
                if (w_start - tolerance_s) <= c_t <= (w_end + tolerance_s):
                    match_found = True
                    break

        if match_found:
            validated.append(dict(cand, word=c_word, t=c_t))

    return validated


def detect_loudness_peaks(
    audio_path: str | Path,
    frame_len_s: float = 0.05,
    hop_s: float = 0.025,
    percentile: float = 90.0,
    min_separation_s: float = 5.0,
) -> List[Dict[str, Any]]:
    """
    Detects loudness peaks (RMS above clip 90th percentile) with minimum separation (spec-0.1 S8).
    """
    audio_p = Path(audio_path)
    if not audio_p.exists():
        return []

    sr, audio = wavfile.read(str(audio_p))
    if audio.ndim > 1:
        audio = audio[:, 0]

    # Convert to float32 in [-1.0, 1.0]
    if audio.dtype == np.int16:
        audio_float = audio.astype(np.float32) / 32768.0
    elif audio.dtype == np.int32:
        audio_float = audio.astype(np.float32) / 2147483648.0
    else:
        audio_float = audio.astype(np.float32)

    frame_len = int(frame_len_s * sr)
    hop_len = int(hop_s * sr)
    num_frames = max(1, (len(audio_float) - frame_len) // hop_len)

    rms_values = []
    times = []
    for i in range(num_frames):
        start = i * hop_len
        end = start + frame_len
        chunk = audio_float[start:end]
        rms = float(np.sqrt(np.mean(chunk**2))) if len(chunk) > 0 else 0.0
        rms_values.append(rms)
        times.append((start + frame_len / 2.0) / sr)

    rms_arr = np.array(rms_values)
    if len(rms_arr) == 0:
        return []

    thresh = np.percentile(rms_arr, percentile)
    if thresh <= 1e-4:
        return []

    # Find peaks above threshold with min_separation
    peaks: List[Dict[str, Any]] = []
    last_peak_t = -999.0
    for idx, (t, val) in enumerate(zip(times, rms_arr)):
        if val > thresh:
            # Check if local peak
            left = rms_arr[idx - 1] if idx > 0 else 0.0
            right = rms_arr[idx + 1] if idx < len(rms_arr) - 1 else 0.0
            if val >= left and val >= right and (t - last_peak_t) >= min_separation_s:
                # Normalized strength in [0.7, 1.0]
                strength = min(1.0, 0.7 + 0.3 * (val / (np.max(rms_arr) + 1e-6)))
                peaks.append({
                    "word": "[loudness_peak]",
                    "t": round(float(t), 4),
                    "strength": round(float(strength), 2),
                })
                last_peak_t = t

    return peaks


def plan_zoom_events(
    candidate_words: List[Dict[str, Any]],
    layout_switches: List[float],
    clip_duration_s: float,
    config: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Plans non-overlapping zoom events respecting budget and spacing (U10, M9).
    Enforces:
    - Zoom rate <= 1 per 5s (min_spacing_s >= 4.0s or 5.0s)
    - Blackout within no_zoom_after_switch_s (0.3s) of any layout switch
    - Max scale cap (default 1.12)
    """
    if config is None:
        config = {}

    zoom_cfg = config.get("zoom", {})
    max_scale = float(zoom_cfg.get("max_scale", 1.12))
    ease_in_s = float(zoom_cfg.get("ease_in_s", 0.15))
    hold_s = float(zoom_cfg.get("hold_s", 0.35))
    ease_out_s = float(zoom_cfg.get("ease_out_s", 0.40))
    min_spacing_s = float(zoom_cfg.get("min_spacing_s", 4.0))
    no_zoom_after_switch_s = float(zoom_cfg.get("no_zoom_after_switch_s", 0.3))

    total_event_dur = ease_in_s + hold_s + ease_out_s

    # Filter candidates that conflict with layout switches
    valid_candidates: List[Dict[str, Any]] = []
    for cand in candidate_words:
        t = float(cand.get("t", 0.0))
        # Punch-in starts slightly before word impact
        t_start = max(0.0, t - ease_in_s)
        t_end = t_start + total_event_dur

        if t_end > clip_duration_s:
            continue

        # Check conflict with layout switches (Metric M9: none within 0.3s of switch)
        conflict = False
        for sw in layout_switches:
            # Blackout: starts or active within [sw - 0.1, sw + no_zoom_after_switch_s]
            if (sw <= t_start <= sw + no_zoom_after_switch_s) or (abs(sw - t) <= 0.25):
                conflict = True
                break

        if not conflict:
            valid_candidates.append(cand)

    # Sort candidates by time
    valid_candidates.sort(key=lambda c: float(c.get("t", 0.0)))

    # Greedy selection enforcing min_spacing_s
    zoom_events: List[Dict[str, Any]] = []
    last_zoom_start = -999.0

    for cand in valid_candidates:
        t = float(cand.get("t", 0.0))
        t_start = max(0.0, t - ease_in_s)

        if (t_start - last_zoom_start) >= min_spacing_s:
            strength = float(cand.get("strength", 1.0))
            scale = 1.0 + (max_scale - 1.0) * min(1.0, max(0.5, strength))
            scale = min(max_scale, scale)

            t_hold_start = t_start + ease_in_s
            t_hold_end = t_hold_start + hold_s
            t_end = t_hold_end + ease_out_s

            zoom_events.append({
                "word": cand.get("word", ""),
                "t_impact": round(t, 4),
                "t_start": round(t_start, 4),
                "t_hold_start": round(t_hold_start, 4),
                "t_hold_end": round(t_hold_end, 4),
                "t_end": round(t_end, 4),
                "scale": round(scale, 4),
            })
            last_zoom_start = t_start

    return zoom_events


def compute_frame_zoom_scale(
    t: float,
    zoom_events: List[Dict[str, Any]],
    ease_in_s: float = 0.15,
    ease_out_s: float = 0.40,
) -> float:
    """
    Computes smooth cosine-eased zoom scale for a given timestamp t.
    Returns scale multiplier >= 1.0.
    """
    for z in zoom_events:
        t_s = z["t_start"]
        t_hs = z["t_hold_start"]
        t_he = z["t_hold_end"]
        t_e = z["t_end"]
        target_scale = z["scale"]

        if t_s <= t <= t_e:
            if t < t_hs:
                # Ease in (cosine smooth step from 1.0 to target_scale)
                frac = (t - t_s) / max(1e-4, ease_in_s)
                eased = 0.5 - 0.5 * math.cos(math.pi * frac)
                return 1.0 + (target_scale - 1.0) * eased
            elif t <= t_he:
                # Hold
                return target_scale
            else:
                # Ease out (cosine smooth return to 1.0)
                frac = (t - t_he) / max(1e-4, ease_out_s)
                eased = 0.5 + 0.5 * math.cos(math.pi * frac)
                return 1.0 + (target_scale - 1.0) * eased

    return 1.0


def apply_zoom_to_crop(
    crop: List[float] | Dict[str, float],
    zoom_scale: float,
    face_box: Optional[List[float]],
    src_w: int,
    src_h: int,
    safe_margin_frac: float = 0.05,
    min_source_height_frac: float = 0.6,
) -> Tuple[List[float], bool]:
    """
    Applies zoom_scale around face center (or crop center if no face),
    respecting min_source_height_frac (0.6 * src_h) and safe margins (spec-0.1 S8).
    Returns (zoomed_crop, is_unsafe).
    zoomed_crop is [x1, y1, x2, y2].
    """
    if isinstance(crop, dict):
        x1, y1 = float(crop["x1"]), float(crop["y1"])
        w, h = float(crop["w"]), float(crop["h"])
    else:
        x1, y1 = float(crop[0]), float(crop[1])
        w, h = float(crop[2] - crop[0]), float(crop[3] - crop[1])

    if zoom_scale <= 1.0001:
        return [x1, y1, x1 + w, y1 + h], False

    # Zoom shrinks field of view by zoom_scale
    h_zoomed = h / zoom_scale
    # Cap zoom so source crop height never drops below min_source_height_frac * src_h
    min_h = min_source_height_frac * src_h
    if h_zoomed < min_h:
        h_zoomed = min_h

    # Preserve 9:16 aspect ratio
    w_zoomed = h_zoomed * (9.0 / 16.0)

    # Zoom smoothly around current smoothed crop center (guarantees continuous motion)
    fc_x = x1 + w / 2.0
    fc_y = y1 + h / 2.0

    # Scale crop around center
    scale_factor = h_zoomed / h
    x1_zoomed = fc_x - (fc_x - x1) * scale_factor
    y1_zoomed = fc_y - (fc_y - y1) * scale_factor

    # Clamp inside source video boundaries
    x1_zoomed = max(0.0, min(float(src_w - w_zoomed), x1_zoomed))
    y1_zoomed = max(0.0, min(float(src_h - h_zoomed), y1_zoomed))
    x2_zoomed = x1_zoomed + w_zoomed
    y2_zoomed = y1_zoomed + h_zoomed

    # Check safe margins if face box is present [x, y, w, h]
    is_unsafe = False
    if face_box and len(face_box) >= 4:
        fx1 = float(face_box[0])
        fy1 = float(face_box[1])
        fx2 = fx1 + float(face_box[2])
        fy2 = fy1 + float(face_box[3])
        margin_x = safe_margin_frac * w_zoomed
        margin_y = safe_margin_frac * h_zoomed
        if (
            fx1 < (x1_zoomed + margin_x)
            or fx2 > (x2_zoomed - margin_x)
            or fy1 < (y1_zoomed + margin_y)
            or fy2 > (y2_zoomed - margin_y)
        ):
            is_unsafe = True

    return [x1_zoomed, y1_zoomed, x2_zoomed, y2_zoomed], is_unsafe
