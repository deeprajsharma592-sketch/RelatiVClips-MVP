"""
RelatiV Dynamic Framing: Stage S4 - Speech and Speaker Attribution.
Integrates Silero VAD, mouth activity normalization, audio-video lag search (cross-correlation),
and speaker attribution with hysteresis and minimum holds.
Outputs speech.json to workdir.
"""

from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import json
import math
import numpy as np
import torch

from .config import compute_config_hash, get_library_versions


def estimate_av_offset(
    vad_mask: np.ndarray,
    total_mouth_activity: np.ndarray,
    fps: float,
    max_search_ms: float = 300.0,
) -> float:
    """
    Estimates audio-video offset by cross-correlating VAD mask and total mouth activity.
    Positive lag means video lags behind audio.
    Returns lag in milliseconds.
    """
    max_lag_frames = int(round((max_search_ms / 1000.0) * fps))
    if max_lag_frames <= 0 or len(vad_mask) < 2 * max_lag_frames:
        return 0.0

    # Ensure zero-mean centered signals for Pearson cross-correlation
    vad = vad_mask - np.mean(vad_mask)
    mouth = total_mouth_activity - np.mean(total_mouth_activity)

    vad_norm = np.linalg.norm(vad)
    mouth_norm = np.linalg.norm(mouth)
    if vad_norm < 1e-4 or mouth_norm < 1e-4:
        return 0.0

    lags = np.arange(-max_lag_frames, max_lag_frames + 1)
    corrs = np.zeros(len(lags))

    n = len(vad)
    for idx, lag in enumerate(lags):
        if lag >= 0:
            # mouth is shifted right by lag: mouth[lag:] aligns with vad[:n-lag]
            v = vad[:n - lag] if lag > 0 else vad
            m = mouth[lag:]
        else:
            # lag < 0: vad[-lag:] aligns with mouth[:n+lag]
            v = vad[-lag:]
            m = mouth[:n + lag]

        if len(v) > 0 and len(m) > 0:
            corrs[idx] = np.sum(v * m)

    best_idx = int(np.argmax(corrs))
    best_lag_frames = lags[best_idx]
    best_corr = corrs[best_idx]

    # Check if correlation peak is distinct from baseline
    mean_corr = np.mean(corrs)
    std_corr = np.std(corrs)
    if std_corr > 1e-5 and (best_corr - mean_corr) > 1.2 * std_corr:
        lag_ms = (best_lag_frames / fps) * 1000.0
        return float(round(lag_ms, 2))
    return 0.0


def attribute_speaker(
    track_activities: Dict[str, float],
    vad_active: bool,
    current_speaker: str,
    switch_margin: float = 1.3,
    activity_floor: float = 0.25,
) -> str:
    """
    Attributes active speaker from normalized mouth activities given VAD presence.
    Returns: "P1", "P2", ..., "offscreen", or "unknown"
    """
    if not vad_active:
        return "silence"

    if not track_activities:
        return "offscreen"

    # Find track with highest normalized activity
    sorted_tracks = sorted(track_activities.items(), key=lambda item: item[1], reverse=True)
    best_track, best_act = sorted_tracks[0]

    if best_act < activity_floor:
        return "offscreen"

    # Apply switch margin hysteresis
    if current_speaker in track_activities and current_speaker != best_track:
        curr_act = track_activities[current_speaker]
        if curr_act >= activity_floor and best_act < switch_margin * curr_act:
            return current_speaker

    return best_track


def compute_rolling_activity(mar_series: np.ndarray, window_size: int) -> np.ndarray:
    """Computes rolling standard deviation of MAR over window."""
    n = len(mar_series)
    activity = np.zeros(n, dtype=np.float64)
    half = window_size // 2

    for i in range(n):
        i_start = max(0, i - half)
        i_end = min(n, i + half + 1)
        segment = mar_series[i_start:i_end]
        if len(segment) > 1:
            activity[i] = np.std(segment)
        else:
            activity[i] = 0.0
    return activity


def run_silero_vad(
    wav_path: Optional[Path],
    total_frames: int,
    fps: float,
    threshold: float = 0.5,
    min_speech_s: float = 0.25,
    min_silence_s: float = 0.3,
) -> np.ndarray:
    """Runs Silero VAD on audio WAV and returns boolean frame mask."""
    vad_mask = np.zeros(total_frames, dtype=np.float64)
    if wav_path is None or not Path(wav_path).exists():
        return vad_mask

    try:
        import scipy.io.wavfile as wavfile
        sr, audio_data = wavfile.read(str(wav_path))
        if audio_data.ndim > 1:
            audio_data = audio_data.mean(axis=1)

        if audio_data.dtype == np.int16:
            audio_float = audio_data.astype(np.float32) / 32768.0
        elif audio_data.dtype == np.int32:
            audio_float = audio_data.astype(np.float32) / 2147483648.0
        else:
            audio_float = audio_data.astype(np.float32)

        wav_tensor = torch.from_numpy(audio_float)

        model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            onnx=False,
            trust_repo=True
        )
        get_speech_timestamps, _, _, _, _ = utils

        min_speech_ms = int(min_speech_s * 1000)
        min_silence_ms = int(min_silence_s * 1000)

        speech_timestamps = get_speech_timestamps(
            wav_tensor,
            model,
            sampling_rate=sr,
            threshold=threshold,
            min_speech_duration_ms=min_speech_ms,
            min_silence_duration_ms=min_silence_ms,
        )

        for ts in speech_timestamps:
            start_s = ts["start"] / float(sr)
            end_s = ts["end"] / float(sr)
            f_start = max(0, int(round(start_s * fps)))
            f_end = min(total_frames, int(round(end_s * fps)))
            vad_mask[f_start:f_end] = 1.0

    except Exception as e:
        print(f"[Warning] Silero VAD failed: {e}")

    return vad_mask


def attribute_speech_pipeline(
    wav_path: Optional[Path],
    tracks_data: List[Dict[str, Any]],
    total_frames: int,
    fps: float,
    workdir: Path,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Full S4 pipeline executing VAD, mouth activity normalization, lag compensation,
    and frame-by-frame speaker attribution.
    """
    workdir = Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    spk_cfg = config.get("speaker", {})
    vad_threshold = float(spk_cfg.get("vad_threshold", 0.5))
    min_speech_s = float(spk_cfg.get("min_speech_s", 0.25))
    min_silence_s = float(spk_cfg.get("min_silence_s", 0.3))
    mouth_window_s = float(spk_cfg.get("mouth_window_s", 0.4))
    switch_margin = float(spk_cfg.get("switch_margin", 1.3))
    unknown_hold_s = float(spk_cfg.get("unknown_hold_s", 1.5))
    av_offset_search_ms = float(spk_cfg.get("av_offset_search_ms", 300.0))
    activity_floor = float(spk_cfg.get("activity_floor", 0.25))

    # 1. Silero VAD
    vad_mask = run_silero_vad(
        wav_path=wav_path,
        total_frames=total_frames,
        fps=fps,
        threshold=vad_threshold,
        min_speech_s=min_speech_s,
        min_silence_s=min_silence_s,
    )

    # 2. Extract and interpolate MAR per track
    window_frames = max(3, int(round(mouth_window_s * fps)))
    track_normalized_acts: Dict[str, np.ndarray] = {}
    total_mouth = np.zeros(total_frames, dtype=np.float64)

    for trk in tracks_data:
        label = trk.get("panel_label", f"P{trk.get('track_id', 0) + 1}")
        samples = trk.get("samples", [])
        if not samples:
            continue

        raw_mar = np.zeros(total_frames, dtype=np.float64)
        sample_times = np.array([s["t"] for s in samples])
        sample_mars = np.array([s["mar"] for s in samples])

        # Smooth linear interpolation across frames to prevent flat plateau artifacts
        t_grid = np.arange(total_frames) / fps
        raw_mar = np.interp(t_grid, sample_times, sample_mars)

        # Rolling std of MAR
        activity = compute_rolling_activity(raw_mar, window_frames)
        # Noise floor (0.003) reliably rejects motionless faces (std ~0.0016) while keeping speaking (std >= 0.005)
        noise_floor = 0.003
        speaking_vals = activity[activity >= noise_floor]
        baseline = float(np.median(speaking_vals)) if len(speaking_vals) > 0 else 0.02
        baseline = max(0.015, baseline)
        norm_activity = np.where(activity >= noise_floor, activity / baseline, 0.0)

        track_normalized_acts[label] = norm_activity
        total_mouth += activity

    # 3. Audio/Video Offset Estimation
    detected_lag_ms = estimate_av_offset(
        vad_mask=vad_mask,
        total_mouth_activity=total_mouth,
        fps=fps,
        max_search_ms=av_offset_search_ms,
    )
    lag_frames = int(round((detected_lag_ms / 1000.0) * fps))

    # 4. Attribution frame by frame
    frame_labels = []
    current_speaker = "unknown"
    last_known_speaker = "unknown"
    unknown_frames_count = 0
    unknown_hold_frames = int(round(unknown_hold_s * fps))
    min_hold_frames = int(round(0.4 * fps))
    hold_counter = 0

    for f in range(total_frames):
        # Align video mouth activity with audio VAD using estimated lag
        f_aligned = min(total_frames - 1, max(0, f + lag_frames))
        vad_on = bool(vad_mask[f] > 0.5)

        acts = {
            label: float(track_normalized_acts[label][f_aligned])
            for label in track_normalized_acts
        }

        if not vad_on:
            # When audio is silent, frame is silence
            final_spk = "silence"
            conf = 0.9
            hold_counter = 0
            unknown_frames_count = 0
        else:
            candidate = attribute_speaker(
                track_activities=acts,
                vad_active=True,
                current_speaker=current_speaker,
                switch_margin=switch_margin,
                activity_floor=activity_floor,
            )

            # Minimum hold of 0.4s after a speaker switch
            if hold_counter > 0:
                hold_counter -= 1
                spk_to_assign = current_speaker
            else:
                if candidate != current_speaker:
                    current_speaker = candidate
                    hold_counter = min_hold_frames
                spk_to_assign = current_speaker

            # Rule 6: unknown is held at the previous speaker for up to unknown_hold_s
            if spk_to_assign == "unknown":
                unknown_frames_count += 1
                if unknown_frames_count <= unknown_hold_frames and last_known_speaker not in ["unknown", "silence"]:
                    final_spk = last_known_speaker
                else:
                    final_spk = "unknown"
            else:
                unknown_frames_count = 0
                last_known_speaker = spk_to_assign
                final_spk = spk_to_assign

            # Confidence metric
            if final_spk in acts:
                conf = min(1.0, max(0.5, acts[final_spk] / 2.0))
            elif final_spk == "offscreen":
                conf = 0.8
            else:
                conf = 0.5

        frame_labels.append({
            "frame_idx": f,
            "t": round(f / fps, 4),
            "speaker": final_spk,
            "confidence": round(conf, 3),
        })

    # Compress into intervals
    intervals = []
    if frame_labels:
        curr_int = {
            "speaker": frame_labels[0]["speaker"],
            "start_s": frame_labels[0]["t"],
            "end_s": frame_labels[0]["t"],
            "confidence": frame_labels[0]["confidence"],
        }
        for item in frame_labels[1:]:
            if item["speaker"] == curr_int["speaker"]:
                curr_int["end_s"] = item["t"]
                curr_int["confidence"] = round((curr_int["confidence"] + item["confidence"]) / 2.0, 3)
            else:
                intervals.append(curr_int)
                curr_int = {
                    "speaker": item["speaker"],
                    "start_s": item["t"],
                    "end_s": item["t"],
                    "confidence": item["confidence"],
                }
        intervals.append(curr_int)

    output_payload = {
        "_meta": {
            "config_hash": compute_config_hash(config),
            "versions": get_library_versions(),
        },
        "av_offset_ms": detected_lag_ms,
        "intervals": intervals,
        "frames": frame_labels,
    }

    speech_file = workdir / "speech.json"
    with open(speech_file, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2)

    return output_payload
