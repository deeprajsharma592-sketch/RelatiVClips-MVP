"""
Moment detector — the single signal source for the pipeline.

Replaces the old "download audio → run energy peaks → run hook detector" path
with a smarter, caption-first, audio-only-for-librosa flow.

Priority (cost-ordered, cheapest first):
  1. YouTube captions (free) → detect moments from word density + pauses
  2. Audio download → librosa peaks + valleys (only if captions fail)
  3. Whisper transcription of the WHOLE audio (last resort, expensive)

A "moment" is a candidate 10-25s window that might be a good clip. The
LLM is given a ranked list of moments and picks 2-5 to actually cut.

What gets detected (regardless of source):
  - HIGH-ENERGY peaks (loud shout, applause, emphasis)
  - LOW-ENERGY valleys (awkward silence, dramatic pause, awkward laugh)
  - The valley→peak PAIR is often the real hook ("I lost everything..."
    (valley, quiet) "...and then I made 10 Cr" (peak, loud))

For captions, the proxy for "energy" is word density:
  - High density (many words per second) ≈ peak (excited, fast talker)
  - Long pause between captions ≈ valley (dramatic beat, awkward silence)

The LLM doesn't need the full transcript. It only needs the candidate
moments with their signal type, score, and a short snippet (a few words
of context, NOT the whole transcript).
"""
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple
import logging
import re
from pathlib import Path

from ..taste.icl import Moment  # canonical type — defined in taste/icl.py

from ..utils.config import (
    TEMP_DIR,
    YTDLP_PATH,
    COOKIES_PATH,
    PEAK_THRESHOLD_MULTIPLIER,
    TARGET_SAMPLE_RATE,
)
from . import audio_analysis
from .transcript_fetcher import (
    _try_ytdlp_transcript,
    _download_audio,
)

log = logging.getLogger(__name__)


@dataclass
class Moment:
    """One candidate 10-25s window that might be a good clip.

    Carries BOTH text and audio context so the LLM can verify clips:
      - text snippet (8-20 words) for content
      - signal_type for audio characterisation (peak/valley/steep_peak/...)
      - audio_features dict with raw energy + transition values
      - source (caption_peak | audio_steep_peak | merged_text_audio | ...)
    """
    index: int
    start: float
    end: float
    signal_type: str  # "peak" | "valley" | "density" | "silence" | "steep_peak" | "steep_valley"
    score: float
    snippet: str = ""           # 8-20 words of text context
    source: str = ""            # "caption_peak" | "audio_steep_peak" | "merged_text_audio" | ...
    story_position: float = 0.0 # 0.0 (start) - 1.0 (end)
    audio_features: Dict = field(default_factory=dict)
    # e.g. {"relative_rise": 2.4, "peak_s": 142.3, "relative_drop": 0.3,
    #       "trough_s": 87.1, "mean_energy": 0.04, "peak_energy": 0.18}

    def to_prompt_line(self) -> str:
        """Format for the ICL prompt — terse, single line, includes both
        text snippet and audio descriptor so the LLM can verify."""
        dur = self.end - self.start
        snip = (self.snippet[:80] + "…") if len(self.snippet) > 80 else self.snippet
        pos_pct = int(self.story_position * 100)
        af = self.audio_features or {}

        # Build audio descriptor (e.g. "AUDIO: peak +2.4× at 142.3s")
        audio_desc = ""
        if self.signal_type in ("steep_peak", "peak") and "relative_rise" in af:
            audio_desc = f"AUDIO: {self.signal_type} +{af['relative_rise']:.2f}× mean energy"
        elif self.signal_type in ("steep_valley", "valley") and "relative_drop" in af:
            audio_desc = f"AUDIO: {self.signal_type} -{af['relative_drop']:.2f}× mean energy (quiet beat)"
        elif self.signal_type == "density":
            audio_desc = "AUDIO: fast speech density"
        elif self.signal_type == "silence":
            audio_desc = "AUDIO: long silence / beat"

        return (
            f"[{self.index}] t={self.start:.1f}-{self.end:.1f}s ({dur:.0f}s, "
            f"{self.signal_type}, score={self.score:.2f}, pos={pos_pct}%) "
            f"{audio_desc} | TEXT: {snip!r}"
        )


# ---------------------------------------------------------------------------
# Caption-based moment detection (FREE path)
# ---------------------------------------------------------------------------


def _caption_moments_from_transcript(
    transcript: dict,
    video_duration_s: float,
) -> List[Moment]:
    """
    Detect candidate moments from YouTube captions alone — NO audio download.

    Signal 1: WORD DENSITY peaks — moments where many words are crammed into
              a short window. Proxy for "excited speech, fast talker, emphasis."

    Signal 2: PAUSE valleys — gaps between caption blocks. Proxy for "dramatic
              pause, awkward silence, beat before a reveal."

    Returns top 15-20 candidate moments, ranked by score.
    """
    segs = transcript.get("segments", [])
    if not segs or len(segs) < 2:
        return []

    # Compute word density per second for each segment
    densities: List[Tuple[float, float, float, int]] = []
    # tuple: (start, end, words_per_sec, word_count)
    for s in segs:
        dur = max(0.001, float(s.get("end", 0)) - float(s.get("start", 0)))
        words = len((s.get("text") or "").split())
        if words == 0:
            continue
        densities.append((float(s["start"]), float(s["end"]), words / dur, words))

    if not densities:
        return []

    # Compute mean density for thresholds
    density_values = [d[2] for d in densities]
    mean_density = sum(density_values) / len(density_values)
    peak_threshold = mean_density * 1.5  # 1.5x mean = "fast"
    valley_threshold = mean_density * 0.4  # <40% of mean = "slow / drag"

    moments: List[Moment] = []

    # Detect density peaks: cluster of high-density segments
    in_peak = False
    peak_start = 0.0
    peak_end = 0.0
    peak_words: List[str] = []
    for s in segs:
        dur = max(0.001, float(s.get("end", 0)) - float(s.get("start", 0)))
        words = len((s.get("text") or "").split())
        density = words / dur if dur > 0 else 0
        is_dense = density >= peak_threshold
        if is_dense:
            if not in_peak:
                in_peak = True
                peak_start = float(s["start"])
            peak_end = float(s["end"])
            peak_words.extend((s.get("text") or "").split())
        else:
            if in_peak:
                # End of peak region
                if peak_end - peak_start >= 2.0 and len(peak_words) >= 4:
                    snippet = " ".join(peak_words[:12])
                    moments.append(Moment(
                        index=0,  # filled in later
                        start=peak_start,
                        end=peak_end,
                        signal_type="density",
                        score=min(1.0, (peak_end - peak_start) / 15.0 * 0.7 + 0.3),
                        snippet=snippet,
                        source="caption_density",
                        story_position=peak_start / max(1.0, video_duration_s),
                    ))
                in_peak = False
                peak_words = []
    if in_peak and peak_end - peak_start >= 2.0 and peak_words:
        snippet = " ".join(peak_words[:12])
        moments.append(Moment(
            index=0,
            start=peak_start,
            end=peak_end,
            signal_type="density",
            score=min(1.0, (peak_end - peak_start) / 15.0 * 0.7 + 0.3),
            snippet=snippet,
            source="caption_density",
            story_position=peak_start / max(1.0, video_duration_s),
        ))

    # Detect pause valleys: gaps >= 1.5s between caption blocks
    for i in range(1, len(segs)):
        prev_end = float(segs[i - 1].get("end", 0))
        cur_start = float(segs[i].get("start", 0))
        gap = cur_start - prev_end
        if gap >= 1.5:
            # The valley is the gap; the clip window is ±4s around it
            clip_start = max(0, prev_end - 1.0)
            clip_end = cur_start + 4.0
            # Use surrounding text as the snippet
            before_text = (segs[i - 1].get("text") or "").strip()
            after_text = (segs[i].get("text") or "").strip()
            snippet = f"{before_text[-30:].strip()} …[pause]… {after_text[:30].strip()}".strip()
            if not snippet:
                snippet = "[dramatic pause]"
            moments.append(Moment(
                index=0,
                start=clip_start,
                end=clip_end,
                signal_type="silence",
                score=min(1.0, gap / 4.0 * 0.6 + 0.4),
                snippet=snippet,
                source="caption_pause",
                story_position=prev_end / max(1.0, video_duration_s),
            ))

    # Sort by score, take top 20
    moments.sort(key=lambda m: m.score, reverse=True)
    top = moments[:20]
    # Re-index
    for i, m in enumerate(top, 1):
        m.index = i
    return top


# Words/phrases that strongly suggest a "compelling story moment"
STORY_INTENSIFIERS = {
    # Strong emotions / reactions
    "insane", "crazy", "nuts", "unbelievable", "shocking", "incredible",
    "literally", "absolutely", "totally", "completely", "actually",
    "honestly", "seriously", "obviously", "clearly", "evidently",
    # Story beats
    "realized", "realize", "discovered", "discover", "found", "find",
    "happened", "happens", "remember", "forgot", "thought", "knew",
    "secret", "truth", "actually", "honestly", "turns out", "guess what",
    # Punch / takeaway
    "never", "always", "forever", "worst", "best", "only", "must",
    "should", "need to", "have to", "gotta", "want to",
    # Money / numbers
    "thousand", "million", "billion", "dollars", "bucks", "rich",
    "broke", "poor", "free", "cost",
    # Contrast / reveal
    "but", "however", "yet", "except", "instead", "actually",
    "wait", "hold on", "stop", "no way", "are you serious",
}

# Words that mark "I have a story" / first-person
FIRST_PERSON = {"i", "i'm", "i've", "i'll", "i'd", "me", "my", "mine",
                "we", "we're", "we've", "we'll", "us", "our", "ours"}


def _content_signal_score(text: str) -> tuple[float, list[str]]:
    """Score a caption segment for STORY-CONTENT signals.

    Returns (score 0-1, list of reasons). Looks for:
      - numbers (digits, "thousand", "million")
      - intensifiers from STORY_INTENSIFIERS
      - first-person pronouns
      - question marks (curiosity hook)
      - exclamations (emotion)
      - capitalized words (often proper nouns, names, brands)
    """
    if not text:
        return 0.0, []
    text_l = text.lower()
    words = text_l.split()
    reasons: list[str] = []

    score = 0.0

    # Numbers
    has_number = any(ch.isdigit() for ch in text)
    if has_number:
        score += 0.25
        reasons.append("has number")

    # Money keywords
    money_words = {"thousand", "million", "billion", "dollars", "bucks", "$", "€", "£"}
    if any(w in text_l for w in money_words):
        score += 0.2
        reasons.append("money reference")

    # Intensifiers
    int_count = sum(1 for w in words if w in STORY_INTENSIFIERS)
    if int_count:
        score += min(0.3, int_count * 0.1)
        reasons.append(f"{int_count} intensifier(s)")

    # First-person
    fp_count = sum(1 for w in words if w in FIRST_PERSON)
    if fp_count:
        score += min(0.2, fp_count * 0.07)
        reasons.append(f"{fp_count} 1st-person")

    # Questions (curiosity hook)
    if "?" in text:
        score += 0.15
        reasons.append("question")

    # Exclamations
    if "!" in text:
        score += 0.1
        reasons.append("exclamation")

    # Capitalized words (proper nouns, names, brands — 2+ caps mid-sentence)
    cap_words = [w for w in text.split() if len(w) > 2 and w[0].isupper()]
    if len(cap_words) >= 2:
        score += 0.1
        reasons.append(f"{len(cap_words)} proper noun(s)")

    # Quote marks (someone is being quoted — punchline / reveal)
    if '"' in text or '"' in text or '"' in text:
        score += 0.15
        reasons.append("quote")

    return min(1.0, score), reasons


def _content_signal_moments(
    transcript: dict,
    video_duration_s: float,
    min_score: float = 0.25,
) -> List[Moment]:
    """Find candidate moments based on STORY CONTENT signals, not just
    word density. Looks for segments with high content-score (numbers,
    intensifiers, first-person, questions, quotes) and clusters adjacent
    high-scoring segments into 10-20s windows.

    This complements _caption_moments_from_transcript (density/pause) for
    the common case of uniform-speed auto-captions where density peaks
    don't fire.
    """
    segs = transcript.get("segments", [])
    if not segs or len(segs) < 2:
        return []

    # Score each segment
    scored: list[tuple[int, float, list[str]]] = []
    for i, s in enumerate(segs):
        text = (s.get("text") or "").strip()
        if not text:
            continue
        score, reasons = _content_signal_score(text)
        if score >= min_score:
            scored.append((i, score, reasons))

    if not scored:
        return []

    # Cluster adjacent high-scoring segments (within 3s of each other)
    clusters: list[list[tuple[int, float, list[str]]]] = []
    current: list[tuple[int, float, list[str]]] = []
    last_end = 0.0
    for i, sc, rs in scored:
        seg = segs[i]
        start = float(seg.get("start", 0))
        end = float(seg.get("end", 0))
        if not current or start - last_end <= 3.0:
            current.append((i, sc, rs))
        else:
            clusters.append(current)
            current = [(i, sc, rs)]
        last_end = end
    if current:
        clusters.append(current)

    moments: list[Moment] = []
    for cluster in clusters:
        if len(cluster) < 1:
            continue
        first_i = cluster[0][0]
        last_i = cluster[-1][0]
        start = float(segs[first_i].get("start", 0))
        end = float(segs[last_i].get("end", 0))
        # Build snippet from cluster text
        texts = [(segs[i].get("text") or "").strip() for i, _, _ in cluster]
        snippet = " ".join(texts)[:100]
        # Score = mean of cluster scores, boosted by cluster size
        mean_score = sum(sc for _, sc, _ in cluster) / len(cluster)
        cluster_bonus = min(0.2, (len(cluster) - 1) * 0.05)
        all_reasons = sorted({r for _, _, rs in cluster for r in rs})
        final_score = min(1.0, mean_score + cluster_bonus)
        # Pad window to 10-20s
        win_dur = end - start
        if win_dur < 10:
            pad = (10 - win_dur) / 2
            start = max(0, start - pad)
            end = end + pad
        elif win_dur > 25:
            # Keep last 20s of the cluster
            end = start + 20
        reasons_str = ",".join(all_reasons[:3])
        moments.append(Moment(
            index=0,
            start=round(start, 2),
            end=round(end, 2),
            signal_type="content",
            score=final_score,
            snippet=snippet or f"[content: {reasons_str}]",
            source="caption_content",
            story_position=start / max(1.0, video_duration_s),
            audio_features={"content_signals": all_reasons[:5]},
        ))

    moments.sort(key=lambda m: m.score, reverse=True)
    return moments[:15]


def _pad_with_temporal_candidates(
    moments: List["Moment"],
    video_duration_s: float,
    target_count: int = 3,
) -> List["Moment"]:
    """Ensure we always have at least `target_count` candidate moments.

    If caption-based detection returned fewer (which happens for videos with
    monotonous pacing — no density peaks, no long pauses), divide the video
    into N equal temporal segments and add a "temporal" candidate at the
    center of each segment that doesn't already contain a real moment.

    The padded candidates have low score (0.4) so they never outrank real
    density/silence peaks, but they guarantee the LLM/fallback always has
    enough material to pick from. Result: always NUM_CLIPS_YOUTUBE clips
    instead of 0-1 when captions are monotonous.
    """
    if len(moments) >= target_count or video_duration_s < 30.0:
        return moments

    seg_dur = video_duration_s / target_count
    used_segs = set()
    for m in moments:
        used_segs.add(int(m.start / seg_dur))

    padded = list(moments)
    for i in range(target_count):
        if i in used_segs:
            continue
        # Center of segment, with a 15s window (the standard clip length)
        center = (i + 0.5) * seg_dur
        start = max(0.0, center - 7.5)
        end = min(video_duration_s, center + 7.5)
        padded.append(Moment(
            index=0,  # re-indexed later
            start=round(start, 2),
            end=round(end, 2),
            signal_type="temporal",
            score=0.4,  # below real peaks (0.6+) but above noise
            snippet=f"[temporal segment {i+1}/{target_count} — {start:.0f}s to {end:.0f}s]",
            source="temporal_padding",
            story_position=center / max(1.0, video_duration_s),
        ))

    # Re-sort by score, re-index, keep top 20
    padded.sort(key=lambda m: m.score, reverse=True)
    top = padded[:20]
    for i, m in enumerate(top, 1):
        m.index = i
    return top


# ---------------------------------------------------------------------------
# Audio-based moment detection (FALLBACK path — only if captions fail)
# ---------------------------------------------------------------------------


def _audio_moments_from_file(
    audio_path: str,
    video_duration_s: float,
) -> List[Moment]:
    """
    Detect candidate moments from audio alone — peaks, valleys, AND steep
    transitions. Used when YouTube captions are unavailable.

    All four signal types are returned, ranked by score, deduped by
    window overlap (higher score wins). The LLM/fallback picks from
    the unified list.
    """
    result = audio_analysis.analyze_audio_peaks_and_valleys(audio_path)
    moments: List[Moment] = []

    # Top 8 sustained peaks
    for i, p in enumerate(result.get("peaks", [])[:8], 1):
        start = max(0, p["timestamp"] - 5.0)
        end = min(video_duration_s, start + 15.0)
        moments.append(Moment(
            index=i,
            start=round(start, 2),
            end=round(end, 2),
            signal_type="peak",
            score=min(1.0, p["relative_to_mean"] / 3.0),
            snippet="[audio peak — loud sustained moment]",
            source="audio_peak",
            story_position=start / max(1.0, video_duration_s),
            audio_features={
                "peak_s": float(p["timestamp"]),
                "relative_rise": float(p["relative_to_mean"]),
                "energy_score": float(p.get("energy_score", 0)),
            },
        ))

    # Top 5 sustained valleys
    for j, v in enumerate(result.get("valleys", [])[:5], 100):
        moments.append(Moment(
            index=j,
            start=v["start"],
            end=v["end"],
            signal_type="valley",
            score=v["score"],
            snippet=f"[audio valley — {v['duration_s']:.1f}s pause, depth={v['depth']:.2f}]",
            source="audio_valley",
            story_position=v["start"] / max(1.0, video_duration_s),
            audio_features={
                "trough_s": float((v["start"] + v["end"]) / 2),
                "relative_drop": float(v.get("depth", 0)),
                "duration_s": float(v.get("duration_s", 0)),
            },
        ))

    # Top 8 STEEP PEAKS — sudden loud transitions
    for k, sp in enumerate(result.get("steep_peaks", [])[:8], 200):
        moments.append(Moment(
            index=k,
            start=sp["start"],
            end=sp["end"],
            signal_type="steep_peak",
            score=sp["score"],
            snippet=f"[STEEP PEAK — sudden loud at {sp['peak_s']:.1f}s, +{sp['relative_rise']:.2f}× mean energy]",
            source="audio_steep_peak",
            story_position=sp["start"] / max(1.0, video_duration_s),
            audio_features={
                "peak_s": float(sp["peak_s"]),
                "relative_rise": float(sp["relative_rise"]),
            },
        ))

    # Top 8 STEEP VALLEYS — sudden quiet transitions (the "wait for it" beats)
    for m, sv in enumerate(result.get("steep_valleys", [])[:8], 300):
        moments.append(Moment(
            index=m,
            start=sv["start"],
            end=sv["end"],
            signal_type="steep_valley",
            score=sv["score"],
            snippet=f"[STEEP VALLEY — sudden quiet at {sv['trough_s']:.1f}s, -{sv['relative_drop']:.2f}× mean energy]",
            source="audio_steep_valley",
            story_position=sv["start"] / max(1.0, video_duration_s),
            audio_features={
                "trough_s": float(sv["trough_s"]),
                "relative_drop": float(sv["relative_drop"]),
            },
        ))

    # Dedupe overlapping moments — keep highest score
    moments = _dedupe_overlapping(moments, overlap_frac=0.5)
    moments.sort(key=lambda m: m.score, reverse=True)

    # Pad with temporal candidates if too few real audio moments
    moments = _pad_with_temporal_candidates(moments, video_duration_s, target_count=3)
    # Re-index
    for i, m in enumerate(moments[:20], 1):
        m.index = i
    return moments[:20]


def _dedupe_overlapping(
    moments: List["Moment"],
    overlap_frac: float = 0.5,
) -> List["Moment"]:
    """Drop moments that overlap >overlap_frac with a higher-scored moment.

    Without this, the LLM gets 4× moments all pointing to the same punchline
    (one from text, one from peak, one from steep_peak, one from valley).

    `overlap_frac` is the fraction of the smaller window that must overlap
    with a higher-scored window for it to be dropped. 0.5 = generous,
    0.3 = strict.
    """
    if not moments:
        return []
    moments = sorted(moments, key=lambda m: m.score, reverse=True)
    kept: List["Moment"] = []
    for m in moments:
        m_dur = max(0.001, m.end - m.start)
        drop = False
        for k in kept:
            k_dur = max(0.001, k.end - k.start)
            # intersection
            inter = max(0.0, min(m.end, k.end) - max(m.start, k.start))
            # smaller of the two
            smaller = min(m_dur, k_dur)
            if inter / smaller >= overlap_frac:
                drop = True
                break
        if not drop:
            kept.append(m)
    return kept


def _merge_text_and_audio_moments(
    text_moments: List["Moment"],
    audio_moments: List["Moment"],
) -> List["Moment"]:
    """Combine text-based and audio-based moment lists, dedupe overlap, boost
    moments detected by BOTH sources (high confidence).

    A moment detected by both text AND audio is far more likely to be a real
    viral moment than one detected by only one source. We boost such moments
    by +0.15 (capped at 1.0) so the LLM/fallback ranks them higher.

    Returns a merged, deduped, sorted list of up to 20 moments.
    """
    if not audio_moments:
        return text_moments
    if not text_moments:
        return audio_moments

    # Tag each moment with which source type it is
    text_set = set(id(m) for m in text_moments)
    audio_set = set(id(m) for m in audio_moments)

    # Detect overlap between text and audio moments (any overlap = "both")
    def _overlaps(m, others):
        for o in others:
            if not (m.end <= o.start or m.start >= o.end):
                return True
        return False

    # Build combined list with dedupe
    all_moments = text_moments + audio_moments
    deduped = _dedupe_overlapping(all_moments, overlap_frac=0.4)

    # Boost moments that have BOTH text and audio support
    boosted: List["Moment"] = []
    for m in deduped:
        m_text = m in text_moments or _overlaps(m, text_moments)
        m_audio = m in audio_moments or _overlaps(m, audio_moments)
        if m_text and m_audio:
            # Both sources confirm this moment — boost
            boosted_m = Moment(
                index=m.index,
                start=m.start,
                end=m.end,
                signal_type=f"text+{m.signal_type}",
                score=min(1.0, m.score + 0.15),
                snippet=m.snippet,
                source="merged_text_audio",
                story_position=m.story_position,
            )
            boosted.append(boosted_m)
        else:
            boosted.append(m)

    boosted.sort(key=lambda m: m.score, reverse=True)
    return boosted[:20]


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def detect_moments(
    source: str,
    task_id: str,
    precomputed_transcript: Optional[dict] = None,
    log: Optional[Callable] = None,
    precomputed_audio_path: Optional[str] = None,
) -> Tuple[List[Moment], dict]:
    """
    Detect candidate moments for the LLM. Returns (moments, info).

    info contains:
      - source: "captions" | "audio" | "merged" | "none"
      - transcript: optional, the transcript used
      - audio_path: optional, the local audio file (if downloaded)
      - duration_s: video duration
      - audio_analysis: raw peaks/valleys (if audio path was used)
    """
    if log is None:
        log = lambda m: None

    info: dict = {"source": "none", "duration_s": 0.0}

    # --- PATH 1: Captions first (free) ---
    transcript = precomputed_transcript
    if not transcript or not transcript.get("segments"):
        log("  Trying YouTube captions first (no audio download)...")
        transcript = _try_ytdlp_transcript(source, task_id, log)
        # Propagate auth errors so the router can surface a clear user message
        if transcript and transcript.get("auth_error"):
            info["auth_error"] = True
    else:
        log(f"  Using precomputed transcript ({len(transcript.get('segments', []))} segments)")

    if transcript and transcript.get("segments"):
        info["source"] = "captions"
        info["transcript"] = transcript
        # Estimate duration from the last caption
        segs = transcript["segments"]
        info["duration_s"] = float(segs[-1].get("end", 0))
        text_moments = _caption_moments_from_transcript(transcript, info["duration_s"])

        # ── ALSO scan for STORY CONTENT signals (numbers, intensifiers,
        # first-person, questions, quotes) — these work for uniform-density
        # content like podcasts and interviews where word density peaks
        # don't fire. Complement the density/pause detector.
        content_moments = _content_signal_moments(transcript, info["duration_s"])
        log(f"  Built {len(text_moments)} density/pause moments + "
            f"{len(content_moments)} content-signal moments")

        # Merge: dedupe overlapping, boost moments detected by BOTH
        # sources (text+density AND content).
        moments = _merge_text_and_audio_moments(text_moments, content_moments)
        moments = _pad_with_temporal_candidates(moments, info["duration_s"], target_count=3)
        log(f"  Built {len(moments)} merged candidate moments")
        # If still too few, try harder with lower content-signal threshold
        if len([m for m in moments if m.signal_type != "temporal"]) < 3:
            more_content = _content_signal_moments(
                transcript, info["duration_s"], min_score=0.15,
            )
            if more_content:
                moments = _merge_text_and_audio_moments(moments, more_content)
                log(f"  Added {len(more_content)} more low-threshold content moments → {len(moments)} total")

        # ── If we already have an audio file (caller passed precomputed_audio_path),
        # do the audio analysis and MERGE. This is the "nail in the coffin" path:
        # text-only detection + audio-only detection, merged, boosted for overlap.
        if precomputed_audio_path and Path(precomputed_audio_path).exists():
            try:
                log("  Audio already present — running combined analysis for merging...")
                audio_info = audio_analysis.analyze_audio_peaks_and_valleys(precomputed_audio_path)
                audio_moments = _audio_moments_from_file(precomputed_audio_path, info["duration_s"])
                log(f"  Built {len(audio_moments)} audio candidate moments "
                    f"({len(audio_info.get('steep_peaks', []))} steep peaks, "
                    f"{len(audio_info.get('steep_valleys', []))} steep valleys)")
                # Build a synthetic Moment list from the audio analysis so we can merge
                # (without going through the moment_conversion)
                synth_audio_moments: List[Moment] = []
                for sp in audio_info.get("steep_peaks", [])[:8]:
                    synth_audio_moments.append(Moment(
                        index=0,
                        start=sp["start"],
                        end=sp["end"],
                        signal_type="steep_peak",
                        score=sp["score"],
                        snippet=f"[STEEP PEAK at {sp['peak_s']:.1f}s, +{sp['relative_rise']:.2f}×]",
                        source="audio_steep_peak",
                        story_position=sp["start"] / max(1.0, info["duration_s"]),
                    ))
                for sv in audio_info.get("steep_valleys", [])[:8]:
                    synth_audio_moments.append(Moment(
                        index=0,
                        start=sv["start"],
                        end=sv["end"],
                        signal_type="steep_valley",
                        score=sv["score"],
                        snippet=f"[STEEP VALLEY at {sv['trough_s']:.1f}s, -{sv['relative_drop']:.2f}×]",
                        source="audio_steep_valley",
                        story_position=sv["start"] / max(1.0, info["duration_s"]),
                    ))
                for p in audio_info.get("peaks", [])[:5]:
                    synth_audio_moments.append(Moment(
                        index=0,
                        start=max(0, p["timestamp"] - 5.0),
                        end=min(info["duration_s"], p["timestamp"] + 10.0),
                        signal_type="peak",
                        score=min(1.0, p["relative_to_mean"] / 3.0),
                        snippet=f"[PEAK at {p['timestamp']:.1f}s, {p['relative_to_mean']:.2f}×]",
                        source="audio_peak",
                        story_position=p["timestamp"] / max(1.0, info["duration_s"]),
                    ))
                moments = _merge_text_and_audio_moments(text_moments, synth_audio_moments)
                info["source"] = "merged"
                info["audio_analysis"] = audio_info
                log(f"  Merged to {len(moments)} final moments "
                    f"(text + audio, boosted for overlap)")
            except Exception as e:
                log(f"  Audio merge failed, keeping text-only moments: {e}")

        # Re-index
        for i, m in enumerate(moments[:20], 1):
            m.index = i
        return moments, info

    # --- PATH 2: Audio fallback (librosa peaks + valleys + steep) ---
    log("  Captions unavailable — downloading audio for librosa peaks+valleys+steep")
    audio_path = _download_audio(source, task_id, log)
    if not audio_path:
        log("  Audio download also failed — returning empty moments")
        return [], info

    info["source"] = "audio"
    info["audio_path"] = audio_path
    # Use librosa to get the actual duration
    try:
        import librosa
        y, sr = librosa.load(audio_path, sr=TARGET_SAMPLE_RATE, mono=True)
        info["duration_s"] = float(len(y)) / sr
    except Exception:
        info["duration_s"] = 0.0

    moments = _audio_moments_from_file(audio_path, info["duration_s"])
    log(f"  Built {len(moments)} candidate moments from audio (peaks + valleys + steep)")
    return moments, info
