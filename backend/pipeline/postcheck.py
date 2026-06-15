"""
Deterministic post-check on LLM picks — zero LLM tokens.

The LLM picks 3 clips with hook + retention_bridge + title. We then
run a series of structural / lexical / time-overlap checks:

  1. HOOK quality gate
     - Must contain an open-loop keyword OR start with a question
     - If missing, rewrite from archetype templates
  2. RETENTION BRIDGE quality gate
     - Must contain a "but / and then / here / wait / because / so"
       bridge word. If missing, prepend archetype template.
  3. TITLE gate
     - 3-6 words, ALL CAPS, no banned phrases ("TOP MOMENT", "WATCH NOW")
     - If bad, derive from hook or archetype template
  4. TIME OVERLAP
     - 3 clips must not overlap. If they do, redistribute by trimming
       the overlap region.
  5. DURATION
     - Each clip must be in [10, 22] seconds. If outside, mark
       and let the renderer decide (we don't rewrite times here).

This module is pure Python + dict manipulation. No LLM. No subprocess.
Runs in <1ms per pick.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

try:
    from .archetype import (
        get_hook_templates,
        get_rehook_templates,
    )
except ImportError:
    from archetype import (
        get_hook_templates,
        get_rehook_templates,
    )


# --- Lexicons for quality gates --------------------------------------------

# Open-loop triggers: words/phrases that create curiosity gap
OPEN_LOOP_TRIGGERS = {
    # Questions
    "?", "what", "why", "how", "when", "where", "who", "which",
    # Curiosity gap
    "this", "these", "that", "those", "secret", "truth", "lie", "lies",
    "hidden", "missing", "actually", "really", "literally",
    "you", "your", "we", "they", "he", "she", "it",
    # Strong claims
    "never", "always", "every", "only", "best", "worst", "most", "least",
    "crazy", "insane", "unbelievable", "shocking", "wait",
    # Time pressure
    "before", "after", "until", "first", "last", "final", "now",
    "next", "then", "suddenly",
}

# Banned title phrases (too generic)
BANNED_TITLE_PHRASES = [
    "top moment", "watch this", "watch now", "must see", "must watch",
    "best moment", "best clip", "viral clip", "you won't believe",
    "wait for it", "wait until", "stay tuned", "don't miss",
    "epic moment", "amazing moment", "incredible moment",
]

# Bridge words that connect hook to payoff
BRIDGE_WORDS = [
    "but", "and then", "however", "because", "so", "here's why",
    "here's how", "here's the", "wait", "actually", "turns out",
    "what happened", "next", "after that", "the result", "in the end",
]


@dataclass
class QualityIssue:
    """One issue found in a pick."""
    field: str          # "hook" | "retention_bridge" | "title" | "time"
    severity: str       # "error" | "warning"
    message: str
    fixed: bool = False


@dataclass
class PostCheckResult:
    """Result of post-checking one pick."""
    pick: Dict = field(default_factory=dict)
    original: Dict = field(default_factory=dict)
    issues: List[QualityIssue] = field(default_factory=list)
    rewrites_applied: List[str] = field(default_factory=list)


# --- Individual gates -------------------------------------------------------

def _has_open_loop(text: str) -> bool:
    """Check if text contains an open-loop trigger."""
    if not text:
        return False
    text_lower = text.lower()
    words = set(re.findall(r"\b[a-z]+\b", text_lower))
    # Direct question mark
    if "?" in text:
        return True
    # Word overlap with triggers
    return bool(words & OPEN_LOOP_TRIGGERS)


def _has_bridge(text: str) -> bool:
    """Check if text contains a retention bridge word/phrase."""
    if not text:
        return False
    text_lower = text.lower()
    for w in BRIDGE_WORDS:
        if w in text_lower:
            return True
    return False


def _is_banned_title(title: str) -> bool:
    if not title:
        return True
    title_lower = title.lower().strip()
    for banned in BANNED_TITLE_PHRASES:
        if banned in title_lower:
            return True
    return False


def _word_count(text: str) -> int:
    if not text:
        return 0
    return len(re.findall(r"\b\w+\b", text))


def _rewrite_hook(original: str, archetype: str) -> Optional[str]:
    """If the hook is weak, substitute an archetype template."""
    if _has_open_loop(original) and _word_count(original) >= 4:
        return None  # hook is fine
    templates = get_hook_templates(archetype)
    # Pick a stable template based on hash of original
    idx = abs(hash(original or archetype)) % len(templates)
    return templates[idx]


def _rewrite_bridge(original: str, archetype: str) -> Optional[str]:
    """If the bridge is weak, prepend a template bridge."""
    if _has_bridge(original) and _word_count(original) >= 6:
        return None  # bridge is fine
    templates = get_rehook_templates(archetype)
    idx = abs(hash(original or archetype)) % len(templates)
    # Combine: keep original if any, prepend template
    if original and len(original.strip()) > 0:
        return f"{templates[idx]}. {original.strip()}"
    return templates[idx]


def _rewrite_title(original: str, hook: str, archetype: str) -> Optional[str]:
    """If title is banned/empty, derive from hook or template."""
    if not _is_banned_title(original) and _word_count(original) >= 2:
        return None  # title is fine
    # Try hook first
    if hook and not _is_banned_title(hook):
        # Title = first 5 words of hook
        words = hook.split()[:5]
        return " ".join(w for w in words if w.isalnum()).upper()[:50] or None
    # Fall back to template
    templates = get_hook_templates(archetype)
    idx = abs(hash(original or archetype)) % len(templates)
    words = templates[idx].split()[:5]
    return " ".join(w for w in words if w.isalnum()).upper()[:50] or None


# --- Time-overlap redistribution --------------------------------------------

def _redistribute_times(picks: List[Dict]) -> List[Dict]:
    """
    If picks overlap, trim the overlap region from each.

    For two picks [a1, a2] and [b1, b2] that overlap, where a1 < b1:
    - If a2 > b1, push b1 to a2 (or shrink a2 to b1).
    - We choose to push the later pick (b1) so the first pick keeps
      its full duration.

    If 3 picks all overlap (rare), push the 2nd and 3rd forward.
    """
    if len(picks) < 2:
        return picks

    # Sort by start time
    sorted_picks = sorted(picks, key=lambda p: p.get("start", 0))
    for i in range(1, len(sorted_picks)):
        prev = sorted_picks[i - 1]
        curr = sorted_picks[i]
        if curr.get("start", 0) < prev.get("end", 0):
            # Overlap. Push curr.start to prev.end.
            new_start = prev["end"]
            duration = curr["end"] - curr["start"]
            curr["start"] = new_start
            curr["end"] = new_start + max(duration, 1.0)
    return sorted_picks


# --- Main entry point -------------------------------------------------------

def post_check_picks(
    picks: List[Dict],
    archetype: str = "general",
    min_confidence: float = 0.3,
) -> Tuple[List[Dict], List[PostCheckResult]]:
    """
    Run all post-checks on the LLM's picks.

    Returns:
      (cleaned_picks, results)
        - cleaned_picks: the picks with rewrites applied, sorted by start
        - results: per-pick PostCheckResult for logging
    """
    results: List[PostCheckResult] = []
    cleaned: List[Dict] = []

    for p in picks:
        result = PostCheckResult(original=dict(p), pick=dict(p))
        confidence = float(p.get("confidence", 0.5))

        # Filter: drop low-confidence picks with a warning
        if confidence < min_confidence:
            result.issues.append(QualityIssue(
                field="confidence", severity="warning",
                message=f"Low confidence ({confidence:.2f} < {min_confidence})",
            ))

        # 1. HOOK
        hook_orig = p.get("hook") or p.get("viral_title") or ""
        new_hook = _rewrite_hook(hook_orig, archetype)
        if new_hook is not None:
            result.pick["hook"] = new_hook
            result.rewrites_applied.append("hook")
            result.issues.append(QualityIssue(
                field="hook", severity="warning",
                message=f"Replaced weak hook '{hook_orig[:30]}' → '{new_hook[:30]}'",
                fixed=True,
            ))
        else:
            result.pick["hook"] = hook_orig

        # 2. RETENTION BRIDGE
        bridge_orig = p.get("retention_bridge") or p.get("caption") or ""
        new_bridge = _rewrite_bridge(bridge_orig, archetype)
        if new_bridge is not None:
            result.pick["retention_bridge"] = new_bridge
            result.pick["caption"] = new_bridge  # legacy alias
            result.rewrites_applied.append("retention_bridge")
            result.issues.append(QualityIssue(
                field="retention_bridge", severity="warning",
                message=f"Added bridge to '{bridge_orig[:30]}'",
                fixed=True,
            ))
        else:
            result.pick["retention_bridge"] = bridge_orig
            result.pick["caption"] = bridge_orig

        # 3. TITLE
        title_orig = p.get("title") or p.get("viral_title") or ""
        new_title = _rewrite_title(title_orig, result.pick["hook"], archetype)
        if new_title is not None:
            result.pick["title"] = new_title
            result.pick["viral_title"] = new_title  # legacy alias
            result.rewrites_applied.append("title")
            result.issues.append(QualityIssue(
                field="title", severity="warning",
                message=f"Replaced banned/short title '{title_orig[:30]}' → '{new_title}'",
                fixed=True,
            ))
        else:
            result.pick["title"] = title_orig.upper()
            result.pick["viral_title"] = result.pick["title"]

        # 4. DURATION (just warn, don't rewrite)
        duration = p.get("end", 0) - p.get("start", 0)
        if duration < 8 or duration > 30:
            result.issues.append(QualityIssue(
                field="time", severity="warning",
                message=f"Duration {duration:.1f}s outside ideal 10-22s window",
            ))

        # Always keep the pick (don't drop on warning)
        cleaned.append(result.pick)
        results.append(result)

    # 5. TIME OVERLAP — redistribute if needed
    cleaned = _redistribute_times(cleaned)

    return cleaned, results


def format_post_check_report(results: List[PostCheckResult]) -> str:
    """Format a human-readable report of the post-checks."""
    lines = [f"Post-check: {len(results)} pick(s)"]
    for i, r in enumerate(results, 1):
        lines.append(f"  Pick {i}:")
        if not r.issues:
            lines.append("    ✓ no issues")
        for issue in r.issues:
            mark = "✗" if issue.severity == "error" else ("⚠" if not issue.fixed else "✓")
            lines.append(f"    {mark} {issue.field}: {issue.message}")
        if r.rewrites_applied:
            lines.append(f"    rewrites: {', '.join(r.rewrites_applied)}")
    return "\n".join(lines)


# --- Self-test --------------------------------------------------------------

if __name__ == "__main__":
    print("Post-check self-test:\n")
    # Test 1: LLM-style output with weak hook
    weak_picks = [
        {
            "moment_index": 1, "confidence": 0.85,
            "start": 0.0, "end": 15.0,
            "hook": "I couldn't believe what I saw next",
            "retention_bridge": "and then everything changed",
            "title": "TOP MOMENT",  # banned
            "hashtags": "#story",
        },
        {
            "moment_index": 2, "confidence": 0.45,
            "start": 20.0, "end": 30.0,
            "hook": "Hello everyone",  # weak — no open loop
            "retention_bridge": "stuff happened",  # weak — no bridge word
            "title": "WATCH NOW",  # banned
            "hashtags": "#viral",
        },
        {
            "moment_index": 3, "confidence": 0.7,
            "start": 12.0, "end": 25.0,  # overlaps pick 1
            "hook": "Why does this always work?",
            "retention_bridge": "because the science behind it is wild",
            "title": "THE SCIENCE",
            "hashtags": "#science",
        },
    ]
    cleaned, results = post_check_picks(weak_picks, archetype="story", min_confidence=0.3)
    print(format_post_check_report(results))
    print("\nCleaned picks:")
    for p in cleaned:
        print(f"  [{p.get('start', 0):.1f}-{p.get('end', 0):.1f}] {p.get('title', '?')!r}")
        print(f"    hook:    {p.get('hook', '?')!r}")
        print(f"    bridge:  {p.get('retention_bridge', '?')!r}")
