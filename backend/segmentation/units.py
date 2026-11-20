"""
Narrative Units Segmentation.
Segments a transcript into coherent micro-story narrative units based on:
1. Sentence boundaries (faster-whisper word timestamps or punctuated segment text)
2. Natural pauses >= 0.7s
3. Speaker turns
4. Scene cuts
5. Topic shifts (cosine distance / token overlap drops between sliding windows)

Rules:
- A clip may ONLY start and end on a unit boundary.
- NEVER cut mid-sentence or mid-word.
- Adds 150-300ms audio padding before first word and after last word.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
import re
import numpy as np

from ..utils.config import (
    NARRATIVE_PADDING_START_S,
    NARRATIVE_PADDING_END_S,
    PAUSE_BOUNDARY_THRESHOLD_S,
)


@dataclass
class WordTiming:
    word: str
    start: float
    end: float
    probability: float = 1.0


@dataclass
class NarrativeUnit:
    index: int
    start: float
    end: float
    text: str
    speaker: Optional[str] = None
    words: List[WordTiming] = field(default_factory=list)
    boundary_type: str = "sentence"  # "sentence" | "pause" | "speaker_turn" | "topic_shift" | "scene_cut"

    @property
    def padded_start(self) -> float:
        """Add 150-300ms breath padding before the first spoken syllable."""
        return max(0.0, self.start - NARRATIVE_PADDING_START_S)

    @property
    def padded_end(self) -> float:
        """Add 150-300ms room tone breath padding after the last spoken syllable."""
        return self.end + NARRATIVE_PADDING_END_S

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


def _split_into_sentences(text: str) -> List[str]:
    """Split text into sentences respecting abbreviations and decimals."""
    if not text:
        return []
    # Match sentences ending with . ! ? followed by space or end
    pattern = r'(?<=[.!?])\s+(?=[A-Z0-9"\'\b])'
    sentences = [s.strip() for s in re.split(pattern, text) if s.strip()]
    return sentences if sentences else [text.strip()]


def _compute_topic_shift_scores(sentences: List[str], window_size: int = 3) -> List[float]:
    """
    Compute token overlap similarity between sliding windows to identify topic shifts.
    A sharp drop in similarity marks a narrative topic shift.
    """
    if len(sentences) <= 1:
        return [0.0] * len(sentences)

    def _token_set(text: str) -> set:
        words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
        # Filter out common stop words
        stopwords = {
            "the", "and", "that", "this", "with", "from", "have", "they", "will", "what",
            "there", "been", "more", "when", "some", "just", "like", "know", "think", "about",
        }
        return {w for w in words if w not in stopwords}

    token_sets = [_token_set(s) for s in sentences]
    similarity_drops: List[float] = [0.0]

    for i in range(1, len(sentences)):
        # Window before
        w_before = set().union(*token_sets[max(0, i - window_size):i])
        # Window after
        w_after = set().union(*token_sets[i:min(len(sentences), i + window_size)])

        if not w_before or not w_after:
            similarity_drops.append(0.0)
            continue

        jaccard = len(w_before & w_after) / len(w_before | w_after)
        # Drop score: 1.0 - jaccard
        similarity_drops.append(round(1.0 - jaccard, 3))

    return similarity_drops


def build_narrative_units(
    transcript: Dict[str, Any],
    scene_cuts: Optional[List[float]] = None,
    pause_threshold_s: float = PAUSE_BOUNDARY_THRESHOLD_S,
) -> List[NarrativeUnit]:
    """
    Build structural narrative units from word and segment timestamps.
    Enforces that every unit starts and ends cleanly without chopping words or thoughts.
    """
    segments = transcript.get("segments") or []
    if not segments:
        return []

    # Check if word-level timestamps are present (from faster-whisper with word_timestamps=True)
    has_words = any("words" in s and s["words"] for s in segments)

    raw_sentences: List[Dict[str, Any]] = []

    if has_words:
        current_sentence_words: List[WordTiming] = []
        current_speaker: Optional[str] = None

        for seg in segments:
            speaker = seg.get("speaker")
            words_data = seg.get("words") or []

            for w in words_data:
                word_txt = w.get("word", "").strip()
                if not word_txt:
                    continue
                w_start = float(w.get("start", 0.0))
                w_end = float(w.get("end", w_start + 0.1))
                prob = float(w.get("probability", 1.0))
                timing = WordTiming(word=word_txt, start=w_start, end=w_end, probability=prob)

                # Check pause before word >= pause_threshold_s
                if current_sentence_words:
                    prev_end = current_sentence_words[-1].end
                    pause_gap = w_start - prev_end
                    if pause_gap >= pause_threshold_s:
                        # Cut boundary due to natural silence/pause
                        s_text = " ".join(item.word for item in current_sentence_words)
                        raw_sentences.append({
                            "start": current_sentence_words[0].start,
                            "end": current_sentence_words[-1].end,
                            "text": s_text,
                            "speaker": current_speaker,
                            "words": current_sentence_words,
                            "boundary_type": "pause",
                        })
                        current_sentence_words = []

                # Check speaker turn
                if current_sentence_words and speaker is not None and current_speaker is not None and speaker != current_speaker:
                    s_text = " ".join(item.word for item in current_sentence_words)
                    raw_sentences.append({
                        "start": current_sentence_words[0].start,
                        "end": current_sentence_words[-1].end,
                        "text": s_text,
                        "speaker": current_speaker,
                        "words": current_sentence_words,
                        "boundary_type": "speaker_turn",
                    })
                    current_sentence_words = []

                current_speaker = speaker
                current_sentence_words.append(timing)

                # Check sentence terminal punctuation
                if any(word_txt.endswith(term) for term in [".", "!", "?", "...", "—"]):
                    s_text = " ".join(item.word for item in current_sentence_words)
                    raw_sentences.append({
                        "start": current_sentence_words[0].start,
                        "end": current_sentence_words[-1].end,
                        "text": s_text,
                        "speaker": current_speaker,
                        "words": current_sentence_words,
                        "boundary_type": "sentence",
                    })
                    current_sentence_words = []

        if current_sentence_words:
            s_text = " ".join(item.word for item in current_sentence_words)
            raw_sentences.append({
                "start": current_sentence_words[0].start,
                "end": current_sentence_words[-1].end,
                "text": s_text,
                "speaker": current_speaker,
                "words": current_sentence_words,
                "boundary_type": "sentence",
            })
    else:
        # Segment-level path (split text by sentences and interpolate timing)
        prev_seg_end: Optional[float] = None
        for seg in segments:
            s_start = float(seg.get("start", 0.0))
            s_end = float(seg.get("end", s_start + 1.0))
            text = str(seg.get("text", "")).strip()
            speaker = seg.get("speaker")
            if not text:
                continue

            # Check pause gap between segments >= 0.7s
            is_pause = (prev_seg_end is not None and (s_start - prev_seg_end) >= pause_threshold_s)
            prev_seg_end = s_end

            sentences = _split_into_sentences(text)
            if len(sentences) == 1:
                boundary = "pause" if is_pause else "sentence"
                raw_sentences.append({
                    "start": s_start,
                    "end": s_end,
                    "text": sentences[0],
                    "speaker": speaker,
                    "words": [],
                    "boundary_type": boundary,
                })
            else:
                total_len = sum(len(s) for s in sentences) or 1
                curr_s = s_start
                for idx, sent in enumerate(sentences):
                    frac = len(sent) / total_len
                    sent_dur = (s_end - s_start) * frac
                    sent_e = curr_s + sent_dur
                    raw_sentences.append({
                        "start": round(curr_s, 3),
                        "end": round(sent_e, 3),
                        "text": sent,
                        "speaker": speaker,
                        "words": [],
                        "boundary_type": "sentence",
                    })
                    curr_s = sent_e

    if not raw_sentences:
        return []

    # Detect topic shifts across sentences
    all_sentence_texts = [item["text"] for item in raw_sentences]
    topic_shift_scores = _compute_topic_shift_scores(all_sentence_texts, window_size=3)

    # Convert to NarrativeUnit list
    units: List[NarrativeUnit] = []
    scene_cuts_set = sorted(scene_cuts or [])

    for i, item in enumerate(raw_sentences):
        b_type = item["boundary_type"]

        # Check if topic shift > 0.85
        if i < len(topic_shift_scores) and topic_shift_scores[i] >= 0.85 and b_type == "sentence":
            b_type = "topic_shift"

        # Check if a scene cut aligns within 0.5s of start
        if scene_cuts_set:
            s_time = item["start"]
            for cut in scene_cuts_set:
                if abs(cut - s_time) <= 0.5:
                    b_type = "scene_cut"
                    break

        units.append(NarrativeUnit(
            index=i,
            start=round(item["start"], 3),
            end=round(item["end"], 3),
            text=item["text"],
            speaker=item.get("speaker"),
            words=item.get("words", []),
            boundary_type=b_type,
        ))

    return units
