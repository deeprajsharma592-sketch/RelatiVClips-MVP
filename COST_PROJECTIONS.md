# RelatiV — LLM Cost Projections (Tier-Aware)

**Budget:** $20.00 (one-time initial, for Claude Haiku 4.5)
**Strategy:** Three-tier router (`backend/llm/model_router.py`)
**Date:** 2026-06-15

## TL;DR — Which model when?

| Phase | Tier | Model | $/pick | $20 budget | When |
|---|---|---|---|---|---|
| **Calibration** (months 1-3) | `calibration` | `claude-haiku-4-5-20251001` (with prompt caching) | **$0.001188** | ~16,800 picks | First 2,000 picks OR until budget tightens |
| **Steady-state** (months 4+) | `budget` | `deepseek-v4-flash` | **$0.000168** | ~119,000 picks | After calibration data collected |
| **Emergency** (always) | `fallback` | `gpt-oss-20b` (Groq) | **$0.000120** | ~166,000 picks | When main providers down or hard cap hit |

**Smart mode** (default) auto-switches between tiers. Override with `LLM_TIER=calibration|budget|fallback`.

## Pricing matrix (per million tokens)

| Model | Input | Output | Cache read | Source |
|---|---|---|---|---|
| `claude-haiku-4-5-20251001` | $1.00 | $5.00 | **$0.10** (10× cheaper) | [Anthropic](https://docs.anthropic.com/en/docs/about-claude/pricing) |
| `deepseek-v4-flash` | $0.14 | $0.28 | **$0.0028** (50× cheaper) | DeepSeek API |
| `deepseek-v4-pro` | $0.435 | $0.87 | $0.003625 | DeepSeek API |
| `gpt-oss-20b` (Groq) | $0.075 | $0.30 | n/a | Groq |

**The killer feature is Anthropic's prompt caching**: our ICL prompt is ~80%
constant (the few-shot examples don't change). With `cache_control: ephemeral`,
that 800-token block hits cache on every call after the first. At 87% cache hit
ratio, Haiku's effective input cost drops from $1.00/MTok to **$0.20/MTok** (cached
+ fresh blended).

## Per-pick cost (realistic, 800 input + 200 output tokens)

| Model | Cost per pick | Picks per $1 | $20 budget |
|---|---|---|---|
| Haiku 4.5 (no cache) | $0.001800 | 555 | 11,111 |
| **Haiku 4.5 (87% cache)** | **$0.001188** | **841** | **16,840** |
| V4-Flash (no cache) | $0.000168 | 5,952 | 119,047 |
| V4-Flash (87% cache) | $0.000072 | 13,888 | 277,777 |
| Groq GPT OSS 20B | $0.000120 | 8,333 | 166,666 |

**Why Haiku 4.5 for calibration, not DeepSeek or OSS 20B?**

Story/hook calibration requires narrative understanding — recognizing a
"turning point", "tension", "revelation" beat in conversational content.
Haiku 4.5 is measurably better at this than V4-Flash (similar size, similar
class) and the gap is *bigger* with GPT OSS 20B (20B params, weaker reasoning).

**The plan:** Spend ~$3-5 of the $20 generating ~3,000 high-quality
calibration picks (titles + rationale). Log every LLM decision. After 2-3
months, use this dataset to fine-tune V4-Flash (or distill to OSS 20B),
giving us 80-90% of the quality at 7-15× the cost efficiency.

## Smart-mode switching logic

The router auto-switches tiers based on:

1. **Calibration phase** (default for first `LLM_SMART_THRESHOLD` picks, default 2000):
   - Uses Haiku 4.5 with prompt caching
   - Builds the dataset for future model distillation
2. **Budget phase** (after threshold OR daily burn > 50% of `LLM_HARD_BUDGET_USD`):
   - Switches to DeepSeek V4-Flash
   - Cost drops 7-16×
3. **Fallback phase** (daily burn > `LLM_HARD_BUDGET_USD` OR all providers down):
   - Uses Groq GPT OSS 20B
   - Never fully offline

## Smart-skip impact (on top of tier routing)

If smart-skip triggers on 50% of requests (typical when text+audio merge
produces 3+ high-confidence moments):

- 10,000 possible requests → 5,000 actual LLM calls → 5,000 smart-skips
- **Effective cost halves again**
- Combined with tier routing: a single $20 of Haiku 4.5 budget can power
  ~30,000 analyzed clips

## Anthropic's $20 free credit math

For 50 creators × 50 videos/month (beta target):
- 2,500 videos/month
- ~50% smart-skip = 1,250 actual LLM calls/month
- Calibration tier: 1,250 × $0.001188 = **$1.49/month**
- After switch to budget tier: 1,250 × $0.000168 = **$0.21/month**

**$20 lasts 13+ months at calibration tier, 95+ months at budget tier.**

## Hard limits (anti-accident)

- `LLM_MAX_OUTPUT_TOKENS=500` — caps worst-case output
- `LLM_DAILY_BUDGET_USD=0.50` — caps daily burn
- `LLM_HARD_BUDGET_USD=1.00` — forces fallback tier
- All in-process, not Redis-backed (single-worker assumption)

## Real-time visibility

- `GET /cost-status` returns: spent_today, remaining_today, calls_today,
  calls_skipped_smart, calls_skipped_budget, last 10 calls
- `routing` sub-object shows: active_tier, active_model, picks_per_dollar,
  remaining_picks_estimated, all_tier_options comparison
- Cron at 09:00 UTC (`32f6a180cb79`) reads this + posts to Discord

## Configuration (env vars)

| Var | Default | Purpose |
|---|---|---|
| `LLM_TIER` | `smart` | `calibration` \| `budget` \| `fallback` \| `smart` |
| `LLM_SMART_THRESHOLD` | `2000` | Picks before auto-switching calibration → budget |
| `LLM_HARD_BUDGET_USD` | `1.00` | Daily $ that triggers fallback tier |
| `LLM_DAILY_BUDGET_USD` | `0.50` | Daily cap (informs the budget-exceeded skip) |
| `LLM_MAX_OUTPUT_TOKENS` | `500` | Per-request output cap |
| `SMART_SKIP_MIN_MOMENTS` | `3` | Min high-conf moments to skip LLM |
| `SMART_SKIP_MIN_SCORE` | `0.70` | Min score for "high confidence" |

## Migration checklist (when to switch tiers)

1. **After 2,000 picks** (auto, in smart mode): calibration → budget
2. **After 1 month of real usage**: review `/cost-status` to see if budget tier quality is acceptable
3. **If budget tier underperforms**: bump `LLM_TIER=budget` → use DeepSeek V4-Pro instead (similar cost, better quality)
4. **If providers become flaky**: set `LLM_TIER=fallback` to force Groq OSS 20B

## Why this works for the $20 budget

The tier system means we *don't* need to choose quality vs. cost upfront.
We get Haiku 4.5 quality during the calibration phase (when quality matters
most for building the dataset), and the model automatically switches to
budget tier when we've collected enough calibration data to know what
"good" looks like. By that point, the $20 has built:
- A labeled dataset of 2,000+ taste picks
- A daily-spend log showing the cost curve
- Operational confidence in the pipeline

The fallback tier (Groq GPT OSS 20B) means we *always* have a free
safety net — even if all API keys expire, the pipeline still produces
lexical-fallback clips with generic titles.
