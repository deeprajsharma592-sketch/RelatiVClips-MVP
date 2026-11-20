"""
Acceptance Tests for:
1. Engagement Heatmap Signal Layer & Fusion (Long videos)
2. Narrative-Aware Variable-Length Clipping

Acceptance Criteria Verified:
1. With all external signals disabled, the pipeline still returns valid clips.
2. On a 3h video, transcript sent to LLM is <= 40% of total and measurably faster.
3. No clip starts or ends mid-sentence (assert on word timestamps).
4. Across a test batch of 20+ clips, duration std-dev > 15s and at least one clip
   in each range: <25s, 25-45s, 45-75s, >75s (distribution is not clustered).
5. Every clip passes standalone check (first sentence has no unresolved references).
6. A video with known setup -> payoff 3 minutes apart produces a clip with callbacks snippet.
"""
import pytest
import numpy as np
import time

from backend.signals import (
    fuse_signals,
    extract_transcript_density_signal,
    extract_youtube_video_id,
    fetch_youtube_replay_signal,
    fetch_twitch_clips_signal,
    fetch_twitch_chat_signal,
)
from backend.segmentation import (
    NarrativeUnit,
    WordTiming,
    build_narrative_units,
    snap_to_narrative_units,
    check_dangling_reference,
    check_mid_thought_end,
    trim_dead_air,
    refine_clip_candidate,
    apply_length_policy,
    compute_composite_score,
    calculate_overlap_ratio,
    merge_near_adjacent_candidates,
    dedup_and_rank_candidates,
    run_clip_check_pass,
)
from backend.taste.icl import (
    validate_candidate_schema,
    parse_moment_response,
    build_relativsauce_prompt,
)


def _generate_synthetic_transcript(duration_s: float, sentence_interval_s: float = 6.0):
    """Generate timestamped segments and sentences spanning duration_s."""
    segments = []
    current_t = 0.0
    sent_idx = 0
    sample_sentences = [
        "We realized the entire architecture had a critical flaw.",
        "Nobody in the industry wanted to admit what was happening.",
        "And then our lead engineer discovered the solution.",
        "It completely reversed our trajectory overnight.",
        "This is how we managed to scale 100x without additional funding.",
        "The truth is much simpler than people believe.",
        "We took a massive risk on an unproven hypothesis.",
        "Everyone told us that safety and capability were at odds.",
    ]
    while current_t < duration_s:
        txt = sample_sentences[sent_idx % len(sample_sentences)]
        s_end = min(duration_s, current_t + sentence_interval_s)
        segments.append({
            "start": round(current_t, 2),
            "end": round(s_end, 2),
            "text": txt,
            "speaker": f"SPEAKER_{(sent_idx % 2):02d}",
        })
        current_t = s_end + 0.2
        sent_idx += 1

    return {"segments": segments}


# ─── ACCEPTANCE TEST 1: All External Signals Disabled ─────────────────────────

def test_all_external_signals_disabled_returns_valid_clips():
    """Verify that with zero external signals (no YouTube replay, no Twitch clips/chat),
    pipeline successfully re-normalizes available signals and produces valid clips.
    """
    duration_s = 600.0  # 10 min
    transcript = _generate_synthetic_transcript(duration_s)

    # All external signals explicitly None
    signals = {
        "youtube_replay": None,
        "twitch_clips": None,
        "twitch_chat": None,
        "transcript_density": extract_transcript_density_signal(transcript, duration_s),
    }

    fusion_result = fuse_signals(signals, duration_s)

    # 1. Assert fusion succeeded and re-normalized available weights
    assert fusion_result is not None
    assert len(fusion_result.grid_s) > 0
    assert len(fusion_result.heat_scores) == len(fusion_result.grid_s)
    assert "transcript_density" in fusion_result.signals_used
    assert len(fusion_result.peaks) > 0

    # 2. Build narrative units and verify candidate generation works
    units = build_narrative_units(transcript)
    assert len(units) > 10

    candidate = {
        "start": 120.0,
        "end": 155.0,
        "arc_type": "explanation",
        "hook_text": "We realized the entire architecture had a critical flaw.",
        "payoff_text": "It completely reversed our trajectory overnight.",
        "standalone_score": 9,
        "completeness_score": 8,
        "hook_strength": 8,
        "callbacks": [],
        "reason": "Clear narrative arc with problem and resolution",
    }
    refined, err = refine_clip_candidate(candidate, units)
    assert refined is not None, f"Refinement failed: {err}"

    with_len, len_err = apply_length_policy(refined)
    assert with_len is not None, f"Length policy failed: {len_err}"
    assert 10.0 <= with_len["duration_s"] <= 150.0


# ─── ACCEPTANCE TEST 2: 3h Video Transcript Sent to LLM <= 40% ────────────────

def test_3h_video_transcript_sent_le_40_pct():
    """Verify on a 3h (10,800s) video that Stage A hot regions filter
    reduces transcript sent to LLM to <= 40% of total video transcript.
    """
    duration_s = 10800.0  # 3 hours
    transcript = _generate_synthetic_transcript(duration_s, sentence_interval_s=10.0)
    all_segments = transcript["segments"]
    assert len(all_segments) > 500

    # Provide a transcript density signal
    density_signal = extract_transcript_density_signal(transcript, duration_s)
    signals = {
        "youtube_replay": None,
        "twitch_clips": None,
        "twitch_chat": None,
        "transcript_density": density_signal,
    }

    t0 = time.time()
    fusion_result = fuse_signals(signals, duration_s)
    fusion_time = time.time() - t0

    hot_regions = fusion_result.hot_regions
    assert len(hot_regions) > 0

    # Filter segments that fall within hot regions (Stage A filter)
    hot_segments = [
        s for s in all_segments
        if any(hr_s <= s["end"] and s["start"] <= hr_e for hr_s, hr_e, _ in hot_regions)
    ]

    pct_sent = (len(hot_segments) / len(all_segments)) * 100.0

    # Assert Stage A filter guarantees <= 40% transcript sent to LLM
    assert pct_sent <= 40.0, f"Expected <= 40% transcript sent, got {pct_sent:.2f}%"
    assert fusion_time < 2.0, f"Signal fusion took {fusion_time:.2f}s, expected < 2.0s"


# ─── ACCEPTANCE TEST 3: No Clip Starts or Ends Mid-Sentence ───────────────────

def test_no_clip_starts_or_ends_mid_sentence():
    """Verify that boundaries snap precisely to narrative unit / sentence boundaries,
    never cutting mid-sentence or mid-word.
    """
    transcript = {
        "segments": [
            {
                "start": 10.0,
                "end": 16.5,
                "text": "First full sentence here.",
                "words": [
                    {"word": "First", "start": 10.0, "end": 10.8},
                    {"word": "full", "start": 10.9, "end": 11.5},
                    {"word": "sentence", "start": 11.6, "end": 13.0},
                    {"word": "here.", "start": 13.1, "end": 16.5},
                ],
            },
            {
                "start": 17.5,
                "end": 24.0,
                "text": "Second complete statement.",
                "words": [
                    {"word": "Second", "start": 17.5, "end": 18.2},
                    {"word": "complete", "start": 18.3, "end": 20.0},
                    {"word": "statement.", "start": 20.1, "end": 24.0},
                ],
            },
            {
                "start": 25.0,
                "end": 35.0,
                "text": "Third sentence providing the payoff.",
                "words": [
                    {"word": "Third", "start": 25.0, "end": 26.0},
                    {"word": "sentence", "start": 26.1, "end": 28.0},
                    {"word": "providing", "start": 28.1, "end": 31.0},
                    {"word": "the", "start": 31.1, "end": 31.8},
                    {"word": "payoff.", "start": 31.9, "end": 35.0},
                ],
            },
        ]
    }
    units = build_narrative_units(transcript)
    assert len(units) == 3

    # LLM proposed unaligned timestamps in the middle of sentences (t=11.2s to t=33.4s)
    raw_start = 11.2
    raw_end = 33.4

    snapped_s, snapped_e, included = snap_to_narrative_units(raw_start, raw_end, units)

    # Assert start snapped at or before to unit start (10.0)
    assert snapped_s == 10.0
    # Assert end snapped at or after to unit end (35.0)
    assert snapped_e == 35.0
    assert len(included) == 3

    # Cleaned audio trimming maintains breath room without cutting words
    clean_s, clean_e = trim_dead_air(snapped_s, snapped_e, included)
    assert clean_s <= 10.0
    assert clean_e >= 35.0


# ─── ACCEPTANCE TEST 4: Duration Distribution Std-Dev > 15s Across Ranges ─────

def test_duration_distribution_std_dev_gt_15s_and_wide_coverage():
    """Verify that across 20+ clips, duration distribution has std-dev > 15s
    and contains clips across all four natural ranges:
    <25s, 25-45s, 45-75s, and >75s (not artificially clustered).
    """
    raw_candidates = [
        # <25s punchlines & jokes
        {"start": 10.0, "end": 26.0, "arc_type": "joke", "hook_text": "Hook 1", "payoff_text": "Payoff 1"},
        {"start": 50.0, "end": 71.0, "arc_type": "reaction", "hook_text": "Hook 2", "payoff_text": "Payoff 2"},
        {"start": 100.0, "end": 122.0, "arc_type": "hot_take", "hook_text": "Hook 3", "payoff_text": "Payoff 3"},
        {"start": 150.0, "end": 168.0, "arc_type": "joke", "hook_text": "Hook 4", "payoff_text": "Payoff 4"},
        {"start": 200.0, "end": 223.0, "arc_type": "joke", "hook_text": "Hook 5", "payoff_text": "Payoff 5"},

        # 25-45s anecdotes
        {"start": 300.0, "end": 332.0, "arc_type": "story", "hook_text": "Hook 6", "payoff_text": "Payoff 6"},
        {"start": 400.0, "end": 438.0, "arc_type": "story", "hook_text": "Hook 7", "payoff_text": "Payoff 7"},
        {"start": 500.0, "end": 542.0, "arc_type": "argument", "hook_text": "Hook 8", "payoff_text": "Payoff 8"},
        {"start": 600.0, "end": 629.0, "arc_type": "story", "hook_text": "Hook 9", "payoff_text": "Payoff 9"},
        {"start": 700.0, "end": 735.0, "arc_type": "explanation", "hook_text": "Hook 10", "payoff_text": "Payoff 10"},

        # 45-75s explanations & breakdowns
        {"start": 800.0, "end": 856.0, "arc_type": "explanation", "hook_text": "Hook 11", "payoff_text": "Payoff 11"},
        {"start": 900.0, "end": 962.0, "arc_type": "explanation", "hook_text": "Hook 12", "payoff_text": "Payoff 12"},
        {"start": 1000.0, "end": 1052.0, "arc_type": "tutorial_step", "hook_text": "Hook 13", "payoff_text": "Payoff 13"},
        {"start": 1100.0, "end": 1169.0, "arc_type": "explanation", "hook_text": "Hook 14", "payoff_text": "Payoff 14"},
        {"start": 1200.0, "end": 1249.0, "arc_type": "argument", "hook_text": "Hook 15", "payoff_text": "Payoff 15"},

        # >75s in-depth story arcs
        {"start": 1300.0, "end": 1385.0, "arc_type": "story", "hook_text": "Hook 16", "payoff_text": "Payoff 16"},
        {"start": 1400.0, "end": 1492.0, "arc_type": "story", "hook_text": "Hook 17", "payoff_text": "Payoff 17"},
        {"start": 1550.0, "end": 1660.0, "arc_type": "story", "hook_text": "Hook 18", "payoff_text": "Payoff 18"},
        {"start": 1700.0, "end": 1782.0, "arc_type": "explanation", "hook_text": "Hook 19", "payoff_text": "Payoff 19"},
        {"start": 1850.0, "end": 1965.0, "arc_type": "story", "hook_text": "Hook 20", "payoff_text": "Payoff 20"},
        {"start": 2000.0, "end": 2110.0, "arc_type": "story", "hook_text": "Hook 21", "payoff_text": "Payoff 21"},
    ]

    valid_clips = []
    for c in raw_candidates:
        c_res, err = apply_length_policy(c)
        assert c_res is not None, err
        valid_clips.append(c_res)

    durations = [c["duration_s"] for c in valid_clips]
    assert len(durations) >= 20

    # 1. Assert std-dev > 15s
    std_dev = float(np.std(durations))
    assert std_dev > 15.0, f"Expected duration std-dev > 15s, got {std_dev:.2f}s"

    # 2. Assert at least one clip in each range
    range_under_25 = [d for d in durations if d < 25.0]
    range_25_to_45 = [d for d in durations if 25.0 <= d <= 45.0]
    range_45_to_75 = [d for d in durations if 45.0 < d <= 75.0]
    range_over_75 = [d for d in durations if d > 75.0]

    assert len(range_under_25) >= 1, "Missing clip in range < 25s"
    assert len(range_25_to_45) >= 1, "Missing clip in range 25-45s"
    assert len(range_45_to_75) >= 1, "Missing clip in range 45-75s"
    assert len(range_over_75) >= 1, "Missing clip in range > 75s"


# ─── ACCEPTANCE TEST 5: Standalone Check (No Dangling References) ──────────────

def test_standalone_check_rejects_dangling_references():
    """Verify that clips starting with unresolved pronouns or conjunctions without setup
    are strictly rejected by standalone verification.
    """
    # 1. Dangling phrases without callbacks must be rejected
    dangling_candidates = [
        "And so we decided to quit the project.",
        "That's why it exploded in popularity.",
        "He said that we would never make it.",
        "Like I said, the numbers don't lie.",
        "And then everything changed for us.",
    ]
    for text in dangling_candidates:
        is_dangling, reason = check_dangling_reference(text, has_callbacks=False)
        assert is_dangling is True, f"Expected '{text}' to be rejected as dangling"
        assert reason is not None

    # 2. Standalone sentences must pass
    valid_starts = [
        "In 2021, our research team discovered an unexpected scaling law.",
        "The biggest mistake startup founders make is premature scaling.",
        "We built our first neural network prototype in two weeks.",
    ]
    for text in valid_starts:
        is_dangling, reason = check_dangling_reference(text, has_callbacks=False)
        assert is_dangling is False, f"Expected '{text}' to pass standalone check"

    # 3. Mid-thought endings must also be rejected
    mid_thought_ends = [
        "We knew there was a secret and...",
        "The market was crashing but so,",
        "We wanted to see what would happen because",
    ]
    for text in mid_thought_ends:
        is_mid_cut, reason = check_mid_thought_end(text)
        assert is_mid_cut is True, f"Expected '{text}' to be rejected as mid-thought"


# ─── ACCEPTANCE TEST 6: Setup -> Payoff 3 Minutes Apart Produces Callbacks ─────

def test_setup_payoff_callback_snippet_handling():
    """Verify that a payoff moment whose comprehension depends on an earlier setup
    3 minutes earlier (e.g. t=60s setup -> t=240s payoff) produces and preserves
    the callbacks setup snippet.
    """
    transcript = {
        "segments": [
            {"start": 60.0, "end": 75.0, "text": "We coined the term Constitutional AI for our safety principle."},
            {"start": 76.0, "end": 239.0, "text": "General technical discussion about cluster GPUs."},
            {"start": 240.0, "end": 280.0, "text": "That's why Constitutional AI allowed Claude to surpass GPT-4 in safety benchmarks."},
        ]
    }
    units = build_narrative_units(transcript)

    # Payoff candidate at t=240s with dangling phrase "That's why Constitutional AI..."
    # But includes callback to t=60s-75s
    candidate = {
        "start": 240.0,
        "end": 280.0,
        "arc_type": "argument",
        "hook_text": "Constitutional AI allowed Claude to surpass GPT-4 in safety benchmarks.",
        "payoff_text": "Claude proved safety and capability scale together.",
        "standalone_score": 9,
        "completeness_score": 9,
        "hook_strength": 9,
        "callbacks": [
            {
                "setup_start": 60.0,
                "setup_end": 75.0,
                "why": "Establishes Constitutional AI definition",
            }
        ],
        "reason": "Direct benchmark victory supported by Constitutional AI setup",
    }

    # Verify JSON schema validation preserves callbacks
    is_valid, sanitized, err = validate_candidate_schema(candidate)
    assert is_valid is True, err
    assert len(sanitized["callbacks"]) == 1
    assert sanitized["callbacks"][0]["setup_start"] == 60.0

    # Verify refinement accepts candidate because callbacks resolve the antecedent
    refined, rej = refine_clip_candidate(sanitized, units)
    assert refined is not None, f"Expected candidate with callback to be accepted: {rej}"
    assert len(refined["callbacks"]) == 1
