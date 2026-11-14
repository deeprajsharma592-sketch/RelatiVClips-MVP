"""
RelatiV Dynamic Framing: Stage S6 - Layout Planner.
Pure functional state machine for SINGLE, STACK, and FIT_BLUR layouts.
Supports speaker hold hysteresis, backchannel filtering, min hold enforcement,
lead-time scheduling, and word-boundary snapping.
Outputs layout.json to workdir.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
import json

from .config import compute_config_hash, get_library_versions


def snap_time_to_words(t_cut: float, words: List[Dict[str, Any]], lead_s: float = 0.0) -> float:
    """
    If t_cut falls inside a word [w['start'], w['end']], snaps to word boundary.
    Prefers snapping to word start (w['start']) so cuts occur in the breath before the word.
    """
    if not words:
        return t_cut

    for w in words:
        w_s = float(w.get("start", 0.0))
        w_e = float(w.get("end", 0.0))
        # Check if cut lands strictly inside the word with a small margin
        if (w_s + 0.04) < t_cut < (w_e - 0.04):
            # Mid-word cut! Snap to word start
            return max(0.0, w_s - 0.02)

    return t_cut


def plan_layout(
    turns: List[Dict[str, Any]],
    shots: List[Dict[str, Any]],
    stable_tracks: List[str],
    words: Optional[List[Dict[str, Any]]] = None,
    config: Optional[Dict[str, Any]] = None,
    tracks: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Pure logic layout planner.
    States: SINGLE(track), STACK(P1, P2), FIT_BLUR.
    """
    if words is None:
        words = []
    if config is None:
        config = {}

    # Deduplicate stable_tracks preserving order
    unique_tracks = []
    for trk in stable_tracks:
        if trk and trk not in unique_tracks:
            unique_tracks.append(trk)
    stable_tracks = unique_tracks

    layout_cfg = config.get("layout", {})
    min_hold_s = float(layout_cfg.get("min_hold_s", 2.0))
    single_enter_hold_s = float(layout_cfg.get("single_enter_hold_s", 3.0))
    switch_lead_s = float(layout_cfg.get("switch_lead_s", 0.12))
    snap_to_word = bool(layout_cfg.get("snap_to_word_boundary", True))
    unknown_hold_s = float(config.get("speaker", {}).get("unknown_hold_s", 1.5))

    layout_segments: List[Dict[str, Any]] = []

    # If exactly 1 stable face/speaker: whole video is SINGLE(stable_tracks[0])
    if len(stable_tracks) == 1:
        solo_track = stable_tracks[0]
        for shot in shots:
            shot_start = float(shot.get("start_s", shot.get("t_start", 0.0)))
            shot_end = float(shot.get("end_s", shot.get("t_end", 0.0)))
            if shot_end > shot_start:
                layout_segments.append({
                    "t_start": round(shot_start, 4),
                    "t_end": round(shot_end, 4),
                    "state": "SINGLE",
                    "track": solo_track,
                    "tracks": [solo_track]
                })
        return layout_segments

    # Process shot by shot (layout strictly resets at shot boundaries)
    for shot in shots:
        shot_start = float(shot.get("start_s", shot.get("t_start", 0.0)))
        shot_end = float(shot.get("end_s", shot.get("t_end", 0.0)))
        shot_dur = shot_end - shot_start

        if shot_dur <= 0:
            continue

        # Check which faces are present in this specific shot
        shot_faces = []
        if tracks:
            for trk in tracks:
                ts = float(trk.get("start_s", 0.0))
                te = float(trk.get("end_s", 0.0))
                lbl = trk.get("panel_label")
                if te > shot_start and ts < shot_end and lbl:
                    if lbl not in shot_faces:
                        shot_faces.append(lbl)

        # If tracks were provided and shot has only 1 face: never STACK, always SINGLE
        if tracks is not None and len(shot_faces) == 1:
            layout_segments.append({
                "t_start": round(shot_start, 4),
                "t_end": round(shot_end, 4),
                "state": "SINGLE",
                "track": shot_faces[0],
                "tracks": [shot_faces[0]]
            })
            continue

        if tracks is not None and len(shot_faces) == 0:
            layout_segments.append({
                "t_start": round(shot_start, 4),
                "t_end": round(shot_end, 4),
                "state": "FIT_BLUR",
                "tracks": []
            })
            continue

        n_faces = len(stable_tracks)
        if n_faces == 0:
            layout_segments.append({
                "t_start": round(shot_start, 4),
                "t_end": round(shot_end, 4),
                "state": "FIT_BLUR",
                "tracks": []
            })
            continue

        if n_faces == 1:
            layout_segments.append({
                "t_start": round(shot_start, 4),
                "t_end": round(shot_end, 4),
                "state": "SINGLE",
                "track": stable_tracks[0],
                "tracks": [stable_tracks[0]]
            })
            continue

        # Two-face dynamic rules (P1 on top, P2 on bottom)
        # Filter turns falling within this shot
        shot_turns = []
        for t in turns:
            ts = float(t.get("t_start", t.get("start_s", 0.0)))
            te = float(t.get("t_end", t.get("end_s", 0.0)))
            if te > shot_start and ts < shot_end:
                shot_turns.append(dict(t, t_start=max(shot_start, ts), t_end=min(shot_end, te)))

        p1_label = stable_tracks[0]
        p2_label = stable_tracks[1]

        # Initial state at shot start is STACK(P1, P2)
        raw_events: List[Dict[str, Any]] = []
        current_state = "STACK"
        current_track: Optional[str] = None
        last_switch_t = shot_start

        # Build timeline of candidate switch events
        # We track how long a speaker holds continuous non-backchannel floor
        for turn_idx, turn in enumerate(shot_turns):
            spk = turn.get("speaker")
            is_bc = bool(turn.get("is_backchannel", False))
            t_s = float(turn["t_start"])
            t_e = float(turn["t_end"])

            # Rule: Backchannels do not trigger layout changes
            if is_bc:
                continue

            # Rule: Unknown gap < unknown_hold_s holds previous state
            if spk in ["unknown", "silence"]:
                dur = t_e - t_s
                if dur <= unknown_hold_s:
                    continue
                else:
                    # Extended unknown drops to STACK
                    raw_events.append({"t": t_s, "to_state": "STACK", "to_track": None})
                continue

            if spk in [p1_label, p2_label]:
                # If currently in STACK: check if this speaker holds floor for >= single_enter_hold_s
                # Look ahead to see if floor is held
                dur = t_e - t_s
                if dur >= single_enter_hold_s:
                    # Switch to SINGLE(spk) at t_s + single_enter_hold_s
                    trigger_t = t_s + single_enter_hold_s
                    raw_events.append({"t": trigger_t, "to_state": "SINGLE", "to_track": spk})

                # If currently in SINGLE(other): if a different speaker starts non-backchannel turn, switch to STACK
                # Schedule switch_lead_s before the turn
                lead_trigger = t_s - switch_lead_s
                raw_events.append({"t": lead_trigger, "to_state": "STACK", "to_track": None, "for_speaker": spk})

        # Sort raw events by time
        raw_events.sort(key=lambda e: e["t"])

        # Execute state machine enforcing min_hold_s
        timeline: List[Dict[str, Any]] = []
        curr_state = "STACK"
        curr_track: Optional[str] = None
        curr_start = shot_start

        for ev in raw_events:
            ev_t = ev["t"]
            to_st = ev["to_state"]
            to_tr = ev.get("to_track")

            if ev_t <= curr_start:
                continue
            if ev_t >= shot_end:
                break

            # If redundant transition, skip
            if to_st == curr_state and to_tr == curr_track:
                continue

            # Check if this STACK trigger was for switching away from same speaker
            if to_st == "STACK" and ev.get("for_speaker") and curr_state == "SINGLE":
                if ev.get("for_speaker") == curr_track:
                    continue

            # Snap to word boundary if enabled
            if snap_to_word:
                cut_t = snap_time_to_words(ev_t, words)
            else:
                cut_t = ev_t

            # Enforce min_hold_s
            if (cut_t - curr_start) < min_hold_s:
                cut_t = curr_start + min_hold_s

            # Never trigger a cut if remaining time in shot is less than min_hold_s
            if (shot_end - cut_t) < min_hold_s:
                continue

            # Add segment
            timeline.append({
                "t_start": round(curr_start, 4),
                "t_end": round(cut_t, 4),
                "state": curr_state,
                "track": curr_track,
                "tracks": [curr_track] if curr_track else [p1_label, p2_label]
            })

            curr_start = cut_t
            curr_state = to_st
            curr_track = to_tr

        # Final segment to shot end
        timeline.append({
            "t_start": round(curr_start, 4),
            "t_end": round(shot_end, 4),
            "state": curr_state,
            "track": curr_track,
            "tracks": [curr_track] if curr_track else [p1_label, p2_label]
        })

        # Merge any adjacent identical segments
        merged: List[Dict[str, Any]] = []
        for seg in timeline:
            if not merged:
                merged.append(seg)
                continue
            prev = merged[-1]
            if prev["state"] == seg["state"] and prev.get("track") == seg.get("track"):
                prev["t_end"] = seg["t_end"]
            else:
                merged.append(seg)

        # Enforce min_hold_s post-pass (except at shot boundaries)
        # If any internal segment is shorter than min_hold_s, absorb it into previous
        cleaned: List[Dict[str, Any]] = []
        for seg in merged:
            dur = seg["t_end"] - seg["t_start"]
            if dur < min_hold_s and cleaned and seg["t_end"] < shot_end - 1e-3:
                # Absorb into previous segment
                cleaned[-1]["t_end"] = seg["t_end"]
            else:
                cleaned.append(seg)

        layout_segments.extend(cleaned)

    return layout_segments


def generate_layout_artifact(
    turns: List[Dict[str, Any]],
    shots: List[Dict[str, Any]],
    tracks: List[Dict[str, Any]],
    words: List[Dict[str, Any]],
    workdir: Path,
    config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Generates layout.json artifact in workdir."""
    workdir = Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    # Aggregate duration per panel label across tracks to filter fleeting detections
    label_durations: Dict[str, float] = {}
    for t in tracks:
        lbl = t.get("panel_label")
        if not lbl:
            continue
        dur = float(t.get("end_s", 0.0)) - float(t.get("start_s", 0.0))
        label_durations[lbl] = label_durations.get(lbl, 0.0) + max(0.0, dur)

    # Minimum duration for a face to be considered a stable conversational subject
    total_clip_dur = max(1.0, sum(float(s.get("end_s", s.get("t_end", 0.0))) - float(s.get("start_s", s.get("t_start", 0.0))) for s in shots)) if shots else 1.0
    min_face_persistence_s = float(config.get("face", {}).get("min_track_persistence_s", 1.5))
    valid_labels = [
        lbl for lbl, dur in sorted(label_durations.items(), key=lambda item: -item[1])
        if dur >= min_face_persistence_s and (dur / total_clip_dur >= 0.15 or dur >= 3.0)
    ]

    # If no labels met the persistence threshold, fallback to top label if any
    if not valid_labels and label_durations:
        valid_labels = [max(label_durations.items(), key=lambda item: item[1])[0]]

    # Stable tracks is strictly unique labels
    stable_track_labels: List[str] = []
    for lbl in valid_labels:
        if lbl not in stable_track_labels:
            stable_track_labels.append(lbl)

    segments = plan_layout(
        turns=turns,
        shots=shots,
        stable_tracks=stable_track_labels,
        words=words,
        config=config,
        tracks=tracks,
    )

    output_payload = {
        "_meta": {
            "config_hash": compute_config_hash(config),
            "versions": get_library_versions(),
        },
        "layout_segments": segments,
    }

    out_file = workdir / "layout.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2)

    return segments
