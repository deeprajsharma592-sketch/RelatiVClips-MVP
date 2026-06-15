"""
8-feature retention scoring — zero LLM tokens.

Each feature produces a 0-1 score for a 10-25s clip window. The composite
retention score is a weighted sum, with weights chosen per-archetype
(e.g. 'exclamation' matters more for reaction; 'step' matters more for tutorial).

Features (all 0-1 normalised):
  1. energy_peak         — does this window contain a loud beat?
                           Strong for: drama, emphasis, surprise
  2. energy_valley       — does it contain a silence/quiet break?
                           Strong for: curiosity gap, dramatic pause
  3. speech_rate         — is speech unusually fast here?
                           Strong for: excitement, urgency, "and then"
  4. first_person        — first-person pronoun density
                           Strong for: personal story, relatable
  5. numbers             — quantity / number mention
                           Strong for: listicle, "3 reasons", specific claims
  6. power_words         — curiosity / emotion vocabulary
                           Strong for: hooks, contrarian
  7. question            — open question / curiosity gap
                           Strong for: open loops, retention
  8. cut_density         — visual scene changes in this window (ffprobe)
                           Strong for: motion, pattern interrupt

Why this is good enough without LLM:
  Each feature is a real, measurable signal of attention/retention.
  The LLM gets the *precomputed* scores in its prompt and just decides
  copy. We don't ask the LLM to "find a hook" — we tell it where the
  candidate hooks are and let it pick + write.
"""
from __future__ import annotations

import math
import re
import subprocess
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


# --- Lexicons ---------------------------------------------------------------

# Curiosity / emotion / power words. Common, but high-signal when dense.
POWER_WORDS = {
    # Curiosity gap
    "secret", "secrets", "truth", "lie", "lies", "myth", "myths",
    "hidden", "nobody", "no one", "they", "actually", "really",
    "exposed", "revealed", "discovered", "missing", "wrong",
    # Emotion
    "crazy", "insane", "unbelievable", "shocking", "shocked",
    "amazing", "incredible", "terrible", "horrible", "brilliant",
    "genius", "stupid", "dumb", "smart", "best", "worst",
    # Intensifiers
    "never", "always", "every", "only", "most", "least",
    "impossible", "guaranteed", "instantly", "immediately",
    "before", "after", "until", "first", "last", "final",
    # Numbers-as-words
    "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "hundred", "thousand", "million", "billion",
}

# Power phrases (multi-word) — even higher signal
POWER_PHRASES = [
    "you won't believe", "wait for it", "plot twist", "no way",
    "are you serious", "are you kidding", "what the",
    "the truth is", "the truth about", "nobody tells you",
    "here's why", "here's how", "watch this", "watch what",
    "let me show you", "let me explain", "the real reason",
    "what happened next", "and then", "little known", "fun fact",
]

FIRST_PERSON = {
    "i", "me", "my", "mine", "myself", "we", "us", "our", "ours", "ourselves",
}

QUESTION_STARTERS = {
    "what", "why", "how", "when", "where", "who", "which", "whose",
    "is", "are", "was", "were", "do", "does", "did", "can", "could",
    "will", "would", "should", "have", "has", "had",
}


@dataclass
class RetentionFeatures:
    """All 8 features for a single clip window."""
    energy_peak: float = 0.0       # 1.0 = strong peak in this window
    energy_valley: float = 0.0     # 1.0 = strong silence in this window
    speech_rate: float = 0.0       # 1.0 = unusually fast speech
    first_person: float = 0.0      # 1.0 = lots of "I/me/my"
    numbers: float = 0.0           # 1.0 = numbers / listicle markers
    power_words: float = 0.0       # 1.0 = curiosity/emotion vocab
    question: float = 0.0          # 1.0 = open question present
    cut_density: float = 0.0       # 1.0 = many visual cuts

    # Per-feature raw counts (for debugging / LLM context)
    raw: Dict[str, float] = field(default_factory=dict)

    def composite(self, weights: Optional[Dict[str, float]] = None) -> float:
        """Weighted sum of features, clamped to [0, 1]."""
        w = weights or DEFAULT_WEIGHTS
        s = 0.0
        for feat, weight in w.items():
            v = getattr(self, feat, 0.0)
            s += weight * v
        return max(0.0, min(1.0, s))


# Default weights. Story/listicle weight first_person + power_words;
# tutorial weights numbers + step markers; etc. Default is balanced.
DEFAULT_WEIGHTS: Dict[str, float] = {
    "energy_peak": 0.15,
    "energy_valley": 0.10,
    "speech_rate": 0.10,
    "first_person": 0.10,
    "numbers": 0.15,
    "power_words": 0.20,
    "question": 0.10,
    "cut_density": 0.10,
}

# Archetype-specific weight overrides
ARCHETYPE_WEIGHTS: Dict[str, Dict[str, float]] = {
    "story": {
        "energy_peak": 0.10, "energy_valley": 0.15, "speech_rate": 0.10,
        "first_person": 0.25, "numbers": 0.05, "power_words": 0.15,
        "question": 0.10, "cut_density": 0.10,
    },
    "tutorial": {
        "energy_peak": 0.10, "energy_valley": 0.05, "speech_rate": 0.10,
        "first_person": 0.05, "numbers": 0.30, "power_words": 0.10,
        "question": 0.10, "cut_density": 0.20,
    },
    "listicle": {
        "energy_peak": 0.10, "energy_valley": 0.05, "speech_rate": 0.10,
        "first_person": 0.05, "numbers": 0.40, "power_words": 0.15,
        "question": 0.05, "cut_density": 0.10,
    },
    "reaction": {
        "energy_peak": 0.25, "energy_valley": 0.10, "speech_rate": 0.20,
        "first_person": 0.10, "numbers": 0.05, "power_words": 0.20,
        "question": 0.05, "cut_density": 0.05,
    },
    "debate": {
        "energy_peak": 0.10, "energy_valley": 0.10, "speech_rate": 0.10,
        "first_person": 0.10, "numbers": 0.10, "power_words": 0.30,
        "question": 0.10, "cut_density": 0.10,
    },
    "lecture": {
        "energy_peak": 0.05, "energy_valley": 0.05, "speech_rate": 0.05,
        "first_person": 0.05, "numbers": 0.20, "power_words": 0.20,
        "question": 0.20, "cut_density": 0.20,
    },
    "general": DEFAULT_WEIGHTS,
}


# --- Text-feature extractors ------------------------------------------------

def _text_in_window(transcript: Dict, start: float, end: float) -> str:
    """Concatenate all transcript text whose [start, end] overlaps the window."""
    parts: List[str] = []
    for seg in transcript.get("segments") or []:
        s = float(seg.get("start", 0))
        e = float(seg.get("end", 0))
        if e < start or s > end:
            continue
        t = (seg.get("text") or "").strip()
        if t:
            parts.append(t)
    return " ".join(parts)


def _words(text: str) -> List[str]:
    """Lowercase alpha tokens."""
    return re.findall(r"\b[a-z][a-z'\-]{1,}\b", text.lower())


def _feature_first_person(text: str) -> float:
    if not text:
        return 0.0
    words = _words(text)
    if not words:
        return 0.0
    fp = sum(1 for w in words if w in FIRST_PERSON)
    # Density per 100 words; saturate at 12%
    density = fp / len(words)
    return max(0.0, min(1.0, density / 0.12))


def _feature_numbers(text: str) -> float:
    """Count numeric mentions (digits + number-words)."""
    if not text:
        return 0.0
    # Digits
    digit_count = len(re.findall(r"\b\d+(?:[.,]\d+)?\b", text))
    # Number words (only definite number words, not "one" in "the one thing")
    number_words = {
        "one", "two", "three", "four", "five", "six", "seven",
        "eight", "nine", "ten", "first", "second", "third", "fourth",
        "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
        "hundred", "thousand", "million", "billion",
    }
    words = _words(text)
    nw_count = sum(1 for w in words if w in number_words)
    total = digit_count + nw_count
    # Saturate at 4 mentions per 100 words
    if not words:
        return 0.0
    density = total / (len(words) / 100.0 + 1e-6)
    return max(0.0, min(1.0, density / 4.0))


def _feature_power_words(text: str) -> float:
    if not text:
        return 0.0
    text_lower = text.lower()
    words = _words(text)
    # Single-word matches
    pw = sum(1 for w in words if w in POWER_WORDS)
    # Phrase matches (weighted 2x — they're rarer and stronger)
    phrase_hits = 0
    for phrase in POWER_PHRASES:
        phrase_hits += len(re.findall(re.escape(phrase), text_lower))
    pw += phrase_hits * 2
    if not words:
        return 0.0
    density = pw / (len(words) / 100.0 + 1e-6)
    return max(0.0, min(1.0, density / 5.0))


def _feature_question(text: str) -> float:
    if not text:
        return 0.0
    # Direct: ends with ?
    has_qmark = "?" in text
    if has_qmark:
        return 1.0
    # Indirect: starts with a question word
    text_lower = text.lower().strip()
    if not text_lower:
        return 0.0
    first_word = re.split(r"\s+", text_lower)[0].rstrip(",")
    if first_word in QUESTION_STARTERS:
        return 0.6
    return 0.0


# --- Speech rate ------------------------------------------------------------

def _speech_rate_in_window(transcript: Dict, start: float, end: float) -> float:
    """
    Compute words-per-second in the window. Saturate around 3.0 wps = 1.0.

    Most speech is 2.0-2.5 wps; above 3.0 is fast.
    """
    total_words = 0
    total_dur = 0.0
    for seg in transcript.get("segments") or []:
        s = float(seg.get("start", 0))
        e = float(seg.get("end", 0))
        if e <= start or s >= end:
            continue
        # Clip overlap
        cs = max(s, start)
        ce = min(e, end)
        dur = max(0.0, ce - cs)
        t = (seg.get("text") or "").strip()
        n_words = len(t.split()) if t else 0
        total_words += n_words
        total_dur += dur
    if total_dur < 0.5:
        return 0.0  # not enough speech to score
    wps = total_words / total_dur
    # Map [0, 3.5] wps to [0, 1]
    return max(0.0, min(1.0, wps / 3.5))


# --- Energy / cut density ---------------------------------------------------

def _feature_energy_peak(audio_features: Dict, start: float, end: float) -> float:
    """
    Score 0-1 based on whether a known energy peak falls in this window.
    audio_features is the dict from moment_detector / audio_analysis.
    Expected fields: 'peaks' (list of {timestamp, energy_score}).
    """
    peaks = audio_features.get("peaks") or []
    if not peaks:
        return 0.0
    in_window = [p for p in peaks
                 if start - 0.5 <= float(p.get("timestamp", 0)) <= end + 0.5]
    if not in_window:
        return 0.0
    # Max energy score in window (peaks are 0-1 already)
    return max(float(p.get("energy_score", 0)) for p in in_window)


def _feature_energy_valley(audio_features: Dict, start: float, end: float) -> float:
    """Score 0-1 based on whether a silence/quiet break falls in this window."""
    valleys = audio_features.get("valleys") or audio_features.get("silences") or []
    if not valleys:
        return 0.0
    in_window = [v for v in valleys
                 if start - 0.5 <= float(v.get("timestamp", v.get("start", 0))) <= end + 0.5]
    if not in_window:
        return 0.0
    # The deeper the valley (lower dB), the higher the score
    depths = [abs(float(v.get("depth_db", v.get("depth", 30)))) for v in in_window]
    if not depths:
        return 0.0
    # -40dB = strong silence, 0dB = no silence. Map [-50, 0] to [1, 0].
    avg_depth = sum(depths) / len(depths)
    return max(0.0, min(1.0, avg_depth / 40.0))


def _feature_cut_density(video_path: Optional[str], start: float, end: float) -> float:
    """
    Score 0-1 based on visual scene change count in this window.
    Uses ffprobe scene change detection. Saturates at ~1 cut per 3s.
    """
    if not video_path:
        return 0.0
    try:
        # ffprobe scene detection (lavfi filter) — fast, ~50ms per 30s clip
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "frame=pts_time",
                "-of", "csv=p=0",
                "-f", "lavfi",
                f"movie={video_path},select=gt(scene\\,0.3),aselect='between(t\\,{start}\\,{end})'",
            ],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return 0.0
        cut_times = [float(t) for t in result.stdout.strip().split("\n") if t]
        dur = max(0.1, end - start)
        cuts_per_sec = len(cut_times) / dur
        return max(0.0, min(1.0, cuts_per_sec / 0.33))
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
        return 0.0


# --- Main entry point -------------------------------------------------------

def score_window(
    transcript: Dict,
    audio_features: Dict,
    start: float,
    end: float,
    video_path: Optional[str] = None,
    archetype: str = "general",
) -> RetentionFeatures:
    """
    Compute all 8 retention features for a [start, end] window.

    Returns a RetentionFeatures dataclass. Use .composite(weights) to
    get the archetype-weighted score, or .composite() for the default.
    """
    text = _text_in_window(transcript, start, end)
    words = _words(text)

    f = RetentionFeatures()
    f.first_person = _feature_first_person(text)
    f.numbers = _feature_numbers(text)
    f.power_words = _feature_power_words(text)
    f.question = _feature_question(text)
    f.speech_rate = _speech_rate_in_window(transcript, start, end)
    f.energy_peak = _feature_energy_peak(audio_features, start, end)
    f.energy_valley = _feature_energy_valley(audio_features, start, end)
    f.cut_density = _feature_cut_density(video_path, start, end)

    # Raw counts for LLM context
    f.raw = {
        "n_words": len(words),
        "n_question_marks": text.count("?"),
        "n_digits": len(re.findall(r"\b\d+\b", text)),
        "speech_wps": round(f.speech_rate * 3.5, 2),
    }
    return f


def score_many(
    transcript: Dict,
    audio_features: Dict,
    windows: List[Tuple[float, float]],
    video_path: Optional[str] = None,
    archetype: str = "general",
) -> List[RetentionFeatures]:
    """Score a batch of windows with the same audio_features."""
    return [
        score_window(transcript, audio_features, s, e, video_path, archetype)
        for s, e in windows
    ]


# --- Self-test --------------------------------------------------------------

if __name__ == "__main__":
    # Quick self-test with synthetic transcript
    sample = {
        "segments": [
            {"start": 0.0, "end": 3.0,
             "text": "I couldn't believe what happened next. You won't believe it."},
            {"start": 3.0, "end": 6.0,
             "text": "Three reasons why this is the worst mistake everyone makes."},
            {"start": 6.0, "end": 9.0,
             "text": "The secret nobody tells you. And then it got worse."},
        ]
    }
    audio = {
        "peaks": [
            {"timestamp": 1.5, "energy_score": 0.8},
            {"timestamp": 7.0, "energy_score": 0.6},
        ],
        "valleys": [
            {"timestamp": 5.5, "depth_db": 35},
        ],
    }
    f = score_window(sample, audio, 0.0, 9.0, archetype="story")
    print("Story archetype, 0-9s window:")
    for k in ["energy_peak", "energy_valley", "speech_rate", "first_person",
              "numbers", "power_words", "question", "cut_density"]:
        print(f"  {k:18s} = {getattr(f, k):.3f}")
    print(f"  composite (story)  = {f.composite(ARCHETYPE_WEIGHTS['story']):.3f}")
    print(f"  composite (default)= {f.composite():.3f}")
