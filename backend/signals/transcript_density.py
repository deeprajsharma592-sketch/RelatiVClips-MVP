"""
Transcript density engagement signal provider (always available).
Measures words/sec, question marks, exclamation marks, and speaker-change rate over time.
"""
from typing import Optional, List, Dict, Any
import numpy as np
from .base import TimeSeries, run_with_silent_fail, log


def _extract_transcript_density_raw(
    transcript: Dict[str, Any],
    duration_s: Optional[float] = None,
    bucket_s: float = 5.0,
) -> Optional[TimeSeries]:
    """Calculate words/sec, punctuation bursts, and speaker transitions."""
    segments = transcript.get("segments") or []
    if not segments:
        return None

    # Determine total duration
    if duration_s is None or duration_s <= 0:
        duration_s = max(float(s.get("end", 0.0)) for s in segments)
    if duration_s <= 0:
        return None

    total_buckets = int(np.ceil(duration_s / bucket_s))
    words_per_bucket = np.zeros(total_buckets, dtype=np.float32)
    questions_per_bucket = np.zeros(total_buckets, dtype=np.float32)
    exclamations_per_bucket = np.zeros(total_buckets, dtype=np.float32)
    speaker_changes_per_bucket = np.zeros(total_buckets, dtype=np.float32)

    last_speaker = None

    for seg in segments:
        s = float(seg.get("start", 0.0))
        e = float(seg.get("end", s + 1.0))
        text = str(seg.get("text", "")).strip()
        words = text.split()
        num_words = len(words)
        num_q = text.count("?")
        num_ex = text.count("!")
        speaker = seg.get("speaker")

        # Speaker change
        is_speaker_change = (speaker is not None and last_speaker is not None and speaker != last_speaker)
        if speaker is not None:
            last_speaker = speaker

        b_start = min(total_buckets - 1, max(0, int(s // bucket_s)))
        b_end = min(total_buckets - 1, max(0, int(e // bucket_s)))

        span_buckets = max(1, b_end - b_start + 1)
        w_per = num_words / span_buckets
        q_per = num_q / span_buckets
        ex_per = num_ex / span_buckets

        for b in range(b_start, b_end + 1):
            words_per_bucket[b] += w_per
            questions_per_bucket[b] += q_per
            exclamations_per_bucket[b] += ex_per
            if is_speaker_change and b == b_start:
                speaker_changes_per_bucket[b] += 1.0

    # Words per second in bucket
    wps = words_per_bucket / bucket_s

    def _norm(arr):
        mx = np.max(arr) if len(arr) > 0 else 0
        mn = np.min(arr) if len(arr) > 0 else 0
        return (arr - mn) / (mx - mn + 1e-8)

    norm_wps = _norm(wps)
    norm_q = _norm(questions_per_bucket)
    norm_ex = _norm(exclamations_per_bucket)
    norm_spk = _norm(speaker_changes_per_bucket)

    # Composite transcript density:
    # 45% speech tempo (words/sec) + 25% questions/inquiry + 20% exclamations/intensity + 10% conversation turnover
    composite = 0.45 * norm_wps + 0.25 * norm_q + 0.20 * norm_ex + 0.10 * norm_spk

    series: TimeSeries = []
    for b in range(total_buckets):
        t_start = b * bucket_s
        t_end = min(duration_s, t_start + bucket_s)
        val = float(composite[b])
        series.append((t_start, t_end, val))

    max_val = max(v for _, _, v in series) if series else 0.0
    if max_val > 0:
        series = [(s, e, round(v / max_val, 4)) for s, e, v in series]

    return series


def extract_transcript_density_signal(
    transcript: Dict[str, Any],
    duration_s: Optional[float] = None,
    bucket_s: float = 5.0,
) -> Optional[TimeSeries]:
    """
    Public entry point for transcript density signal.
    Returns [(t_start, t_end, value)] or None.
    """
    if not transcript:
        return None
    return run_with_silent_fail(
        _extract_transcript_density_raw,
        provider_name="transcript_density",
        transcript=transcript,
        duration_s=duration_s,
        bucket_s=bucket_s,
        timeout_s=8.0,
    )
