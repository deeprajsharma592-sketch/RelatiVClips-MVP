"""
RelatiV Dynamic Framing: Stage S5 - Speaker Turns.
Merges short gaps between same-speaker intervals, marks backchannels (short interjections),
and detects turn overlaps.
Outputs turns.json to workdir.
"""

from pathlib import Path
from typing import List, Dict, Any, Tuple
import json

from .config import compute_config_hash, get_library_versions


def compute_turns(
    speech_intervals: List[Dict[str, Any]],
    workdir: Path,
    config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Computes merged speaker turns, backchannels, and overlaps from speech intervals.
    Writes turns.json to workdir and returns the list of turns.
    """
    workdir = Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    turns_cfg = config.get("turns", {})
    merge_gap_s = float(turns_cfg.get("merge_gap_s", 0.4))
    backchannel_max_s = float(turns_cfg.get("backchannel_max_s", 0.6))

    # Filter out pure silence and unknown if needed, or keep valid speaker turns
    valid_intervals = [
        dict(i) for i in speech_intervals
        if i.get("speaker") not in ["silence", "unknown"]
    ]

    # 1. Merge same-speaker intervals separated by less than merge_gap_s
    merged_turns: List[Dict[str, Any]] = []
    for intv in valid_intervals:
        if not merged_turns:
            merged_turns.append(intv)
            continue

        prev = merged_turns[-1]
        if prev["speaker"] == intv["speaker"] and (intv["start_s"] - prev["end_s"]) <= merge_gap_s:
            prev["end_s"] = max(prev["end_s"], intv["end_s"])
            prev["confidence"] = round((prev.get("confidence", 0.8) + intv.get("confidence", 0.8)) / 2.0, 3)
        else:
            merged_turns.append(intv)

    # 2. Mark backchannels and overlaps
    turns_output: List[Dict[str, Any]] = []
    for idx, turn in enumerate(merged_turns):
        dur = round(turn["end_s"] - turn["start_s"], 4)
        is_backchannel = False

        # If turn duration <= backchannel_max_s and flanked by another speaker
        if dur <= backchannel_max_s:
            prev_spk = merged_turns[idx - 1]["speaker"] if idx > 0 else None
            next_spk = merged_turns[idx + 1]["speaker"] if idx < len(merged_turns) - 1 else None
            curr_spk = turn["speaker"]

            if (prev_spk and prev_spk != curr_spk) or (next_spk and next_spk != curr_spk):
                is_backchannel = True

        # Check for overlap with adjacent turns
        is_overlap = False
        if idx > 0:
            prev = merged_turns[idx - 1]
            overlap_dur = prev["end_s"] - turn["start_s"]
            if overlap_dur > 0.5:
                is_overlap = True

        turns_output.append({
            "turn_id": idx,
            "speaker": turn["speaker"],
            "start_s": round(turn["start_s"], 4),
            "end_s": round(turn["end_s"], 4),
            "duration_s": dur,
            "is_backchannel": is_backchannel,
            "is_overlap": is_overlap,
            "confidence": turn.get("confidence", 0.8)
        })

    output_payload = {
        "_meta": {
            "config_hash": compute_config_hash(config),
            "versions": get_library_versions(),
        },
        "turns": turns_output
    }

    turns_file = workdir / "turns.json"
    with open(turns_file, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2)

    return turns_output
