---
name: relativsauce
description: Taste rubric for picking and scoring short-form clips from long-form video transcripts. Use this whenever the task is to find, rank, score, or justify clip candidates from a transcript (podcasts, interviews, streams, talks, tech/founder content), decide where a clip should start and end, or judge whether a moment will hold attention on TikTok, Reels, Shorts, or X. Use it even if the user just says "find the best moments", "what should I clip", or "score these segments".
---

# RelatiVSauce: clip selection rubric

Version: `rubric_ver = "sauce-0.1"`. Return this string in every output so results can be compared across prompt versions.

These weights and heuristics are starting hypotheses drawn from practitioner experience, not proven facts. They are meant to be tuned against real retention and view data.

## Inputs you may receive

- A timestamped transcript (required).
- Optional audio/visual signals per segment (loudness, speaker changes, motion).
- Optional creator profile: audience, niche, past clips that performed well or badly.
- Optional retrieved context (RAG): earlier moments, running jokes, topic background.

If a creator profile or past-performance examples are provided, they override the generic weights below.

## Process

1. **Find candidate moments.** A candidate is one complete thought or exchange, usually 15-60 seconds. Never start or end mid-sentence. Prefer 8-20 candidates per hour of source.
2. **Find the hook.** The best clips open on the hook, not on setup. If the strongest line is in the middle, propose starting there and check that it still makes sense without what came before.
3. **Classify the hook type** (below). A candidate with no hook type is weak unless the payoff is exceptional.
4. **Check reach.** Does the topic connect to something broad (health, money, relationships, status, fear of falling behind)? See "Wide-funnel check".
5. **Check self-containment.** A cold viewer must understand the moment without the rest of the video.
6. **Check accuracy and risk.**
7. **Score every candidate**, not just the winners, and return them all.

## Hook types

Tag each candidate with the one that fits best (or `none`).

- **contrarian**: attacks a common belief or accepted advice.
- **bizarre**: a strange, vivid or surreal image that makes people stop.
- **paradoxical**: two ideas that sound incompatible but are both true.
- **revealing**: an early confession, failure, or raw truth.
- **high_stakes**: drops into a critical decision or deadline with no warm-up.
- **visceral**: sensory, physical detail that lands in the body, not the head.
- **curiosity_gap**: states a striking outcome but withholds how it happened.
- **identity_challenge**: speaks to how the viewer sees themselves, their job or their habits.

## Wide-funnel check

Clips reach new people when the topic has a large audience. Broad topics (health, money, relationships, fear of being left behind) travel further than narrow technical ones.

Technical or niche content usually fails as a clip when presented as a technical explanation. It works when the speaker is telling a human story through it: money made or lost, burnout, a co-founder conflict, a failure, a fear, a bet that paid off or didn't.

When scoring tech content:
- Prefer the moment where the human stakes show up over the moment where the tool or architecture is explained.
- If a technical moment is the best available, say so in `reason` and note what framing (title, caption, first line) would make it broader.
- Do not penalize niche content that is clearly meant for a niche audience if the creator profile says so.

## Scoring (0-100)

| Component | Points | What high looks like |
|---|---|---|
| Hook strength | 0-30 | Strong hook in the first 2-3 seconds, clearly one of the types above |
| Reach | 0-25 | Broad topic or human stakes; viewer needs no prior knowledge |
| Completeness | 0-20 | Clear start, build, and landing; self-contained |
| Payoff / ending | 0-10 | Ends on a punch, answer, or line worth rewatching; no trailing filler |
| Delivery | 0-10 | Energy, pacing, emotion, confidence; no long pauses or tangents |
| Risk penalty | 0 to -20 | Subtract for factual uncertainty, blacklisted topics, or needing missing context |

Calibration guidance:
- 80+ should be rare. Reserve it for moments you would be surprised not to see perform.
- Most candidates should land between 30 and 70.
- Do not inflate scores to look helpful. A transcript with no strong moments should return low scores and say so.

## Accuracy and risk rules

- If a clip contains numbers, dates, prices, or claims, flag `needs_fact_check: true` when you cannot verify them from the transcript itself. Do not fix numbers from memory.
- Never select moments that include: price predictions or financial advice presented as certain, attacks on named competitors, illegal activity, or anything on the creator's blacklist if one is provided.
- Do not select a moment whose meaning flips when clipped (sarcasm, setup-and-reversal, a quote the speaker goes on to reject). Set `context_risk: "high"` instead.

## 5% Experiment Policy (Exploration vs Exploitation)

In approximately 5% of runs, include one experimental candidate marked `"is_experiment": true`.
An experimental candidate is an unconventional, high-variance moment that would normally fall just under the 65 cutoff (e.g. 50-64) or has an unusual angle (bizarre imagery, sudden intense confession, eccentric contrarian claim) that has potential breakout upside.

## Output format

Return only JSON, no preamble and no code fences. One object per candidate, ordered by score descending:

```
{
  "rubric_ver": "sauce-0.1",
  "candidates": [
    {
      "start_s": 0.0,
      "end_s": 0.0,
      "hook_line": "first line of the clip as spoken",
      "hook_type": "contrarian | bizarre | paradoxical | revealing | high_stakes | visceral | curiosity_gap | identity_challenge | none",
      "broad_angle": "health | wealth | relationships | status | none",
      "scores": {
        "hook": 0, "reach": 0, "completeness": 0,
        "payoff": 0, "delivery": 0, "risk": 0
      },
      "score": 0,
      "context_risk": "low | medium | high",
      "needs_fact_check": false,
      "chosen": false,
      "is_experiment": false,
      "reason": "one sentence on why, max 25 words",
      "suggested_title": "short, plain, no clickbait that the clip cannot deliver"
    }
  ]
}
```

Rules for the output:
- Set `chosen: true` for at most the top 3 per hour of source, and only for candidates scoring 65 or higher.
- Keep `reason` to one sentence. Cost scales with output length.
- Timestamps must come from the transcript. Never invent them.
- Return rejected candidates too. They are training data for later.

## Things this skill does not do

- It does not manage clippers, payouts, or campaigns.
- It does not detect view botting or fake engagement.
- It does not predict virality. It ranks clips by how well they match a rubric. Real performance is judged by data, and the rubric should be revised when the data disagrees.

## Maintenance notes (for the developer, not for the model)

- Keep this file byte-for-byte identical across calls, and put per-video content (transcript, creator profile) after it, so prompt caching works.
- Bump `rubric_ver` whenever weights, hook types, or thresholds change, and log it with each decision.
- After a few hundred posted clips, check whether `score` correlates with normalized retention. If a component does not predict outcomes, reweight or drop it.
