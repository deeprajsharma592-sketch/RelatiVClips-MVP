# Supermemory integration for Hermes / RelatiV

Bridge file: `supermemory_bridge.py`
Container: `relativ-agent`

## What it does

Adds a third memory layer alongside the existing `memory` tool (always-on notes)
and `fact_store` (52 facts with trust scoring):

| Tool | Scope | Strength |
|------|-------|----------|
| `memory` | Single session, always injected | Compact facts, present-tense |
| `fact_store` | Cross-session, 52 facts | Trust-scored, entity resolution |
| **supermemory** | Cross-session, **graph memory** | Auto-extracted relations, temporal evolution, semantic recall |

## Setup (3 minutes)

1. **Sign up** at https://supermemory.ai
2. **Get API key**: Settings → API keys → Create
3. **Add to .env**: `echo "SUPERMEMORY_API_KEY=sm_..." >> /app/RelatiV/.env`
4. **Verify**: `python3 /app/RelatiV/memory/supermemory_bridge.py status`

```
{
  "enabled": true,
  "key_present": true,
  "container": "relativ-agent",
  "tier": "free"
}
```

## Free tier

- $5/month usage credit (no card required for the credit, card on file for overage)
- Sub-300ms recall latency
- Unlimited memories (charged by usage, not seats)
- SOC 2 Type II compliant

## Usage from the agent

```python
from memory.supermemory_bridge import remember, recall, profile, status

# At end of important turns:
remember("Deepraj wants RelatiV homepage to look like Stripe × Linear × Framer — premium glassmorphism, no fake testimonials, no fake numbers")

# At start of context-heavy turns:
ctx = recall("what is the current state of RelatiV design?")
# → list of {content, score, metadata}

# To get the synthesized profile:
p = profile()
# → {"static": [...], "dynamic": [...]}
```

## What to remember (when to call `remember`)

- **Decisions made** ("we chose glassmorphism over dark fuchsia")
- **Constraints** ("no fake testimonials, no 'trusted by 16M creators'")
- **Deploy state** ("Cloudflare tunnel to Hetzner fsn1 working, NOT persistent")
- **Cost/spend** ("relativclips.com $11.25/yr on Vercel")
- **Founder preferences** ("CTO mode = full creative+technical autonomy, no asking")
- **Stuck items** ("YT-DLP blocked by Hetzner fsn1 IP, parked per user")

## What NOT to remember

- Session-scoped state ("we just deployed to Vercel")
- Transient task progress ("3 cron jobs running")
- Stale facts that will change in <7 days
- Code snippets (use `memory` for those, or just re-read the file)

## Why not just use `fact_store`?

`fact_store` is great for high-trust, entity-tagged facts. Supermemory is great for:
- **Temporal evolution**: "Deepraj started with dark fuchsia aesthetic, then glassmorphism, then designer mode" — the timeline matters
- **Cross-cutting recall**: "what was that thing about magnetic buttons we discussed at 3pm?"
- **Auto-entity-resolution**: supermemory extracts people/projects/concepts automatically
- **Sub-300ms latency**: 10× faster than Zep, 25× faster than Mem0

The two are complementary, not competing. fact_store = curated ledger, supermemory = free-form memory.
