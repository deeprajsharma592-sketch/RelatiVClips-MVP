"""
Narrative archetype detection — rules-based, zero tokens.

Why this matters:
  Different content types have different hook/retention mechanics.
  Treating a story like a tutorial, or a reaction like a lecture,
  produces generic clips. Detecting the archetype lets us
  (a) pick the right scoring weights,
  (b) pick the right cut structure (setup→payoff, hook→step→result, ...),
  (c) write archetype-specific hook templates.

Cost: $0. Runs on every transcript. ~1ms.

Six archetypes we ship:
  - story       : personal narrative / anecdote / "this happened to me"
  - tutorial    : "how to" / step-by-step / instructional
  - listicle    : "5 things" / "top 10" / numbered content
  - reaction    : responding to something / commentary on external content
  - debate      : "why X is wrong" / "actually..." / contrarian take
  - lecture     : educational / definitional / "the reason is..."

If confidence is low for all six, we fall back to "general" and use
the union of all archetype hooks.
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, List, Tuple


# --- Lexical markers per archetype -------------------------------------------
# These are intentionally common words; we score by relative frequency,
# not by presence, so a 2000-word transcript and a 200-word one are comparable.

_ARCHETYPE_MARKERS: Dict[str, Dict[str, List[str]]] = {
    "story": {
        "past_tense": [
            "happened", "realized", "remember", "ago",
            "yesterday", "last week", "last year", "last month", "one time",
            "back then", "years ago", "months ago", "the other day",
        ],
        "narrative": [
            "me", "my", "we", "us", "our", "myself",
            "then", "after", "before", "while", "suddenly", "eventually",
            "first", "next", "finally", "in the end",
        ],
        "emotion": [
            "scared", "shocked", "happy", "sad", "angry", "surprised",
            "couldn't believe", "never", "ever", "imagine",
        ],
    },
    "tutorial": {
        "imperative": [
            "click", "tap", "go to", "open", "select", "choose", "press",
            "type", "add", "remove", "delete", "save", "copy", "paste",
            "download", "install", "set up", "configure", "enable", "turn on",
            "turn off", "scroll", "swipe", "tap on",
        ],
        "process": [
            "step", "first", "second", "third", "next", "then", "after that",
            "now", "once", "when", "if you", "make sure", "you need to",
            "you can", "you should", "you have to",
        ],
        "structure": [
            "how to", "tutorial", "guide", "step-by-step", "walkthrough",
            "learn", "teach", "show you", "let me show", "here's how",
        ],
    },
    "listicle": {
        "numbers": [
            "one", "two", "three", "four", "five", "six", "seven", "eight",
            "nine", "ten", "first", "second", "third", "fourth", "fifth",
        ],
        "framing": [
            "things", "ways", "reasons", "tips", "tricks", "hacks",
            "mistakes", "lessons", "rules", "secrets", "facts",
            "top", "best", "worst", "most", "least",
        ],
        "counting": [
            "number", "tip", "reason", "item", "point", "step",
        ],
    },
    "reaction": {
        "exclamations": [
            "oh my god", "omg", "what the", "wtf", "no way", "are you serious",
            "no!", "yes!", "wow", "holy", "literally", "actually",
            "i can't", "insane", "crazy", "lmao", "lmfao", "bro",
            "stop it", "i'm dead", "i'm crying", "i can't even", "bro what",
        ],
        "responding": [
            "look at", "watch this", "did you see", "see this", "i saw",
            "i'm watching", "i just saw", "they said", "he said", "she said",
            "this person", "this guy", "this video", "this tweet",
            "i'm sorry", "i'm not", "wait what", "what just", "no she didn't",
        ],
        "opinion": [
            "i love", "i hate", "i'm obsessed", "i can't stand",
            "my favorite", "my least favorite", "the worst", "the best",
            "i'm sorry but", "i need to talk", "let me talk",
        ],
    },
    "debate": {
        "claim": [
            "actually", "no,", "well actually", "wrong", "incorrect",
            "that's not", "this isn't", "they're wrong", "people think",
            "everyone thinks", "most people", "many people", "the truth is",
        ],
        "evidence": [
            "study", "research", "data", "evidence", "proof", "statistics",
            "according to", "scientists", "experts", "paper", "source",
        ],
        "contrarian": [
            "unpopular opinion", "hot take", "controversial", "truth",
            "lie", "myth", "misconception", "you're", "you're not",
            "stop", "don't", "never do", "always do",
        ],
    },
    "lecture": {
        "definitional": [
            "is defined as", "refers to", "means", "is the", "are the",
            "concept of", "principle of", "theory of", "law of",
        ],
        "causal": [
            "because", "therefore", "thus", "hence", "as a result",
            "leads to", "causes", "results in", "due to", "since",
        ],
        "academic": [
            "historically", "originally", "in the past", "in general",
            "specifically", "for example", "for instance", "consider",
            "imagine", "suppose", "let me explain", "let me tell you",
        ],
    },
}

# Hook templates per archetype — used in the post-check / fallback path
# when LLM output is weak. Each is a 6-7 word first-3-seconds line.
_ARCHETYPE_HOOK_TEMPLATES: Dict[str, List[str]] = {
    "story": [
        "I couldn't believe what happened next",
        "This changed everything for me",
        "Nobody told me this would happen",
        "The moment I realized I was wrong",
        "Here's what actually went down",
        "Let me tell you a story",
    ],
    "tutorial": [
        "Here's the trick nobody tells you",
        "Do this before anything else",
        "Stop doing this immediately",
        "Three steps to nail this",
        "Watch this once and you're set",
        "The fastest way to do X",
    ],
    "listicle": [
        "Here are the three that matter",
        "Number one will surprise you",
        "The best one is at the end",
        "Most people miss number two",
        "Save this before you forget",
        "These three changed the game",
    ],
    "reaction": [
        "I was not ready for this",
        "This actually broke me",
        "Wait — did that just happen?",
        "I need to talk about this",
        "Okay but WHY is this so good",
        "Stop what you're doing and watch",
    ],
    "debate": [
        "Everyone is wrong about this",
        "Here's what nobody tells you",
        "This popular take is false",
        "You're being lied to",
        "The truth about this is wild",
        "I'm going to get hate for this",
    ],
    "lecture": [
        "Here's something they don't teach",
        "This is how it actually works",
        "The real reason behind this",
        "Most people misunderstand this",
        "Let me break this down for you",
        "This explains everything else",
    ],
    "general": [
        "Watch this part right here",
        "This is the moment that matters",
        "Here's what you came for",
        "Pay attention to this beat",
        "This part is everything",
    ],
}

# Mid-clip rehook templates (used at 7-9s in a 15-20s clip to keep retention)
_REHOOK_TEMPLATES: Dict[str, List[str]] = {
    "story": [
        "but then it got worse",
        "what happened next shocked me",
        "and that's when things went sideways",
        "I had no idea what was coming",
    ],
    "tutorial": [
        "but here's the part most people miss",
        "now watch this carefully",
        "and this is where it clicks",
        "the next step is the real trick",
    ],
    "listicle": [
        "but number two is the real one",
        "the next one is even better",
        "and this is just getting started",
        "wait for the last one",
    ],
    "reaction": [
        "I was not ready for this part",
        "and then they did WHAT",
        "no way this is real",
        "wait — what just happened",
    ],
    "debate": [
        "and here's where everyone is wrong",
        "the data actually shows the opposite",
        "but the real reason is darker",
        "this is why people get it wrong",
    ],
    "lecture": [
        "and this is where it gets interesting",
        "the second part is the key",
        "now connect this to the bigger picture",
        "this is the principle that changes everything",
    ],
    "general": [
        "but wait — it gets better",
        "here's where it gets interesting",
        "stay with me on this part",
        "and that's not even the best part",
    ],
}


@dataclass
class ArchetypeResult:
    """Result of archetype detection."""
    primary: str                                  # the dominant archetype
    confidence: float                             # 0.0-1.0
    distribution: Dict[str, float] = field(default_factory=dict)
    # raw counts for debugging
    raw_counts: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "primary": self.primary,
            "confidence": round(self.confidence, 3),
            "distribution": {k: round(v, 3) for k, v in self.distribution.items()},
        }


def _tokenize(text: str) -> List[str]:
    """Lowercase word tokens, alpha-only, length >= 2."""
    return re.findall(r"\b[a-z][a-z'\-]{1,}\b", text.lower())


def _count_phrases(text_lower: str, phrases: List[str]) -> int:
    """Count total occurrences of any phrase in text (substring match)."""
    total = 0
    for p in phrases:
        # Use word boundary for single words, plain substring for multi-word
        if " " in p or "'" in p or "-" in p:
            total += len(re.findall(re.escape(p), text_lower))
        else:
            total += len(re.findall(rf"\b{re.escape(p)}\b", text_lower))
    return total


def detect_archetype(transcript: Dict) -> ArchetypeResult:
    """
    Detect the narrative archetype from a transcript dict.

    The transcript is expected to have a 'segments' list (from YouTube
    captions or Whisper). Each segment has 'text'. We can also accept
    a flat 'text' field.

    Algorithm:
      1. Concatenate all text into one string.
      2. For each archetype, count weighted marker matches across
         marker categories.
      3. Normalise by word count to make transcripts comparable.
      4. Pick the archetype with the highest normalised score.
      5. Confidence = (top - second) / (top + 1e-6), clamped to [0, 1].
    """
    if not transcript:
        return ArchetypeResult(primary="general", confidence=0.0)

    # Extract text
    segments = transcript.get("segments") or []
    if segments and isinstance(segments[0], dict):
        text_parts = [s.get("text", "") for s in segments if s.get("text")]
    else:
        # Maybe a list of strings or a flat text field
        text_parts = [transcript.get("text", "")] if isinstance(transcript.get("text"), str) else []

    if not text_parts:
        return ArchetypeResult(primary="general", confidence=0.0)

    full_text = " ".join(text_parts)
    text_lower = full_text.lower()
    n_words = max(1, len(_tokenize(full_text)))

    # Score each archetype
    raw_counts: Dict[str, int] = {}
    norm_scores: Dict[str, float] = {}

    for arch, marker_groups in _ARCHETYPE_MARKERS.items():
        total = 0
        for group, phrases in marker_groups.items():
            # Weight by group importance: 'narrative'/'process'/'framing'
            # etc. are stronger signals than individual words.
            weight = 1.0
            if group in ("narrative", "process", "framing", "counting",
                         "definitional", "causal", "structure", "evidence"):
                weight = 1.5
            elif group in ("contrarian", "responding", "imperative"):
                weight = 1.2
            total += weight * _count_phrases(text_lower, phrases)
        raw_counts[arch] = int(total)
        # Normalise by sqrt of word count (sub-linear so long transcripts
        # don't dominate — 200 words vs 2000 words should still resolve).
        norm_scores[arch] = total / (n_words ** 0.5)

    # Sort by normalised score
    sorted_archs = sorted(norm_scores.items(), key=lambda x: x[1], reverse=True)
    if not sorted_archs or sorted_archs[0][1] < 0.05:
        # No signal at all → general
        return ArchetypeResult(
            primary="general",
            confidence=0.0,
            distribution={k: v for k, v in norm_scores.items()},
            raw_counts=raw_counts,
        )

    top_name, top_score = sorted_archs[0]
    second_score = sorted_archs[1][1] if len(sorted_archs) > 1 else 0.0

    # Confidence: relative margin between top and second
    if top_score > 0:
        confidence = max(0.0, min(1.0, (top_score - second_score) / (top_score + 1e-6)))
    else:
        confidence = 0.0

    # Build distribution (% of total signal)
    total_signal = sum(norm_scores.values()) + 1e-9
    distribution = {k: v / total_signal for k, v in norm_scores.items()}

    return ArchetypeResult(
        primary=top_name,
        confidence=confidence,
        distribution=distribution,
        raw_counts=raw_counts,
    )


def get_hook_templates(archetype: str) -> List[str]:
    """Get 6-7 word first-3-seconds hook templates for an archetype."""
    return _ARCHETYPE_HOOK_TEMPLATES.get(archetype, _ARCHETYPE_HOOK_TEMPLATES["general"])


def get_rehook_templates(archetype: str) -> List[str]:
    """Get mid-clip rehook templates (7-9s position) for an archetype."""
    return _REHOOK_TEMPLATES.get(archetype, _REHOOK_TEMPLATES["general"])


def archetype_specific_guidance(archetype: str) -> str:
    """
    Return archetype-specific prompt guidance for the LLM.

    This is the 'few-shot template' the LLM uses to know what kind of
    story beat to look for in this content.
    """
    guidance = {
        "story": (
            "ARCHETYPE: STORY (personal narrative). "
            "Look for: a moment of change, a conflict that resolved, a 'I didn't expect' beat. "
            "Best clips: setup → twist → emotional landing. "
            "Hook = the moment of change ('And then I saw...'). "
            "Retention = 'what happened next' + the emotional reveal."
        ),
        "tutorial": (
            "ARCHETYPE: TUTORIAL (how-to). "
            "Look for: a step being executed, a result appearing, a 'watch this' demo. "
            "Best clips: action → result → 'so you can...' payoff. "
            "Hook = the surprising first step or a result preview. "
            "Retention = the visible transformation + 'and then you...' bridge."
        ),
        "listicle": (
            "ARCHETYPE: LISTICLE (ranked/numbered). "
            "Look for: a number being said, an item being introduced, "
            "'number one/two/three'. "
            "Best clips: count → item → why it matters. "
            "Hook = 'number one will...'. "
            "Retention = 'but number two is the real one' bridge."
        ),
        "reaction": (
            "ARCHETYPE: REACTION (responding to content). "
            "Look for: an exclamation, a 'wait what' beat, a re-watch moment. "
            "Best clips: setup → reaction → punchline. "
            "Hook = the strong emotion word ('I can't', 'No way', 'Wait'). "
            "Retention = the explanation of WHY they're reacting."
        ),
        "debate": (
            "ARCHETYPE: DEBATE (contrarian/argument). "
            "Look for: a claim being made, evidence cited, a 'actually' beat. "
            "Best clips: claim → evidence → 'and that's why'. "
            "Hook = the contrarian claim itself. "
            "Retention = the surprising evidence + 'most people don't realise'."
        ),
        "lecture": (
            "ARCHETYPE: LECTURE (educational). "
            "Look for: a definition, a cause→effect, an 'and this means' beat. "
            "Best clips: concept → mechanism → implication. "
            "Hook = the surprising definition or counter-intuitive principle. "
            "Retention = the 'so what' that makes it relevant."
        ),
        "general": (
            "ARCHETYPE: GENERAL (mixed/unclear). "
            "Look for: any moment with strong emotion, surprise, or a clear change. "
            "Hook = a curiosity-gap question or bold statement. "
            "Retention = a 'but here's the thing' bridge."
        ),
    }
    return guidance.get(archetype, guidance["general"])


# --- Self-test -------------------------------------------------------------
if __name__ == "__main__":
    samples = {
        "story": (
            "I was walking home yesterday and I couldn't believe what I saw. "
            "There was a guy just standing there in the middle of the road. "
            "I stopped and asked him if he was okay. He said he had been there "
            "for three hours. I was shocked. Then he told me the whole story. "
            "After all that, I realized something I had never understood before."
        ),
        "tutorial": (
            "First, click on the settings tab. Then, go to advanced. "
            "Now, scroll down until you see the API key section. "
            "Copy the key and paste it into the config file. "
            "Make sure you save the file before you reload the app. "
            "If you follow these steps, your integration will work."
        ),
        "listicle": (
            "Here are the top five reasons your videos are not getting views. "
            "Number one, your hook is weak. Number two, you have no payoff. "
            "Number three, your audio is bad. Number four, you skip the rehook. "
            "Number five, you don't post at the right time. "
            "Save this list and apply each one."
        ),
        "reaction": (
            "Oh my god, I was not ready for this. Look at what they did. "
            "I can't believe this person actually said that. Are you serious? "
            "I was watching this thinking it was normal and then BOOM. "
            "No way. I had to rewind it three times. This is insane."
        ),
        "debate": (
            "Actually, you're wrong about that. The data clearly shows "
            "the opposite. According to a 2024 study, this method is way more "
            "effective. Everyone thinks X is true but the research says Y. "
            "This is an unpopular opinion, I know, but hear me out. "
            "The reason this myth persists is because of bad statistics."
        ),
        "lecture": (
            "Gravity is defined as the force that pulls objects toward each other. "
            "The reason this matters is because it explains orbits. "
            "For example, the Earth orbits the sun because of gravity. "
            "Consider what would happen if gravity suddenly stopped. "
            "Therefore, gravity is a fundamental concept in physics."
        ),
    }
    print("Archetype self-test:")
    for label, text in samples.items():
        r = detect_archetype({"text": text})
        match = "✓" if r.primary == label else "✗"
        print(f"  {match} '{label}' → detected as '{r.primary}' "
              f"(conf={r.confidence:.2f})")
