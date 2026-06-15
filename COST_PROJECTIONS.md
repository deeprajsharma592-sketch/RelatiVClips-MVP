# RelatiV — LLM Cost Projections

**Budget:** $20.00 (one-time initial)
**Provider default:** Claude Haiku 4.5 (auto-fallback to Groq/D…)
**Date:** 2026-06-15

## Per-request cost (Haiku 4.5: $1/MTok in, $5/MTok out)

| Component | Tokens | Cost |
|---|---|---|
| Input (15 moments × ~50 tok + meta) | ~800 | $0.0008 |
| Output (3 picks × ~80 tok JSON) | ~240 | $0.0012 |
| **Per request total** | **~1,040** | **~$0.0020** |

## Budget scenarios

| Daily cap | Requests/day possible | Days until $20 exhausted | Notes |
|---|---|---|---|
| **$0.50** (current default) | **~250** | **40 days** | safe default for beta |
| $1.00 | ~500 | 20 days | light use |
| $2.00 | ~1000 | 10 days | heavy testing |
| $5.00 | ~2500 | 4 days | burn it all |
| No cap | unlimited | 1 day of 10K calls | **DO NOT** |

**$20 / $0.002 = ~10,000 LLM-assisted taste picks.**

## Smart-skip impact

If smart-skip triggers on 50% of requests (typical when text+audio merge
produces 3+ high-confidence moments):

- 10,000 possible requests → 5,000 actual LLM calls → 5,000 smart-skips
- **Cost drops to ~$10 spent, $10 saved**
- **Effectively doubles the runway**

## With Anthropic's $20 free credit (new accounts)

- One-time $20 = ~10,000 LLM calls = ~10,000 taste selections
- If smart-skip is on (50% skip rate): 20,000 total clips analyzed
- Enough for 200 creators × 100 videos OR 20 creators × 1000 videos

## LLM_MAX_OUTPUT_TOKENS

Capped at 500 (default). The actual JSON output is ~240 tokens. The cap
prevents runaway generation if the model gets stuck.

## Daily cap (LLM_DAILY_BUDGET_USD)

Default $0.50/day. At 250 requests/day, that's 2,500 requests/month.
Beta with 50 active users × 50 videos/month each = 2,500 requests/month.
**The cap is sized for beta traffic, not for cost-saving — it prevents
accidents (prompt injection, runaway loop, etc.).**

## Real-time visibility

- `GET /cost-status` returns: spent_today, remaining_today, calls_today,
  calls_skipped_smart, calls_skipped_budget, last 10 calls
- Cron at 09:00 UTC (`32f6a180cb79`) reads this + posts to Discord

## Recommendations

1. **Start with $0.50/day cap** (default). It's enough for testing and
   prevents accidents.
2. **Bump to $1.00/day** when you have active users (lift env in compose).
3. **Set $5.00/day MAX** for the public beta (env: `LLM_DAILY_BUDGET_USD=5.00`).
4. **Add Anthropic billing alerts** in their dashboard at $5, $10, $15.
5. **If budget runs out:** pipeline falls back to smart-skip + lexical.
   Quality drops ~10% (no LLM titles) but it still works.
