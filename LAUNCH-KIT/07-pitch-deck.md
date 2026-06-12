# RelatiV — Pitch Deck

> **12 slides. For investor meetings. ~10 minutes. PDF-ready.**
> **Use this as a starting point — Deepraj should customize each slide with his own numbers + story.**

---

## Slide 1: Title

**RelatiV**
*Infrastructure of authenticity for the AI-slop era.*

Deepraj, Founder
Demo: relativ.app · GitHub: `<link>`

---

## Slide 2: Problem

**The internet is drowning in AI-generated slop.**

- TikTok and Instagram feeds are 60%+ AI-generated content
- YouTube Shorts is on the same trajectory
- Creators are burning out trying to compete with infinite content
- Brands can't tell what's real anymore
- FTC passed AI disclosure rules in 2025
- TikTok now deprioritizes AI-flagged content

**The counter-move is forming. We're building the infrastructure for it.**

---

## Slide 3: Solution

**RelatiV turns one video into 10 real short-form clips in 60 seconds.**

- Paste a YouTube URL → 3-5 ready-to-publish clips
- No editor, no upload, no export queue
- Claude for hook scoring (taste, not just energy)
- Self-hostable, open-source engine
- 9-stage pipeline in 60 seconds

---

## Slide 4: Market

**$XB total addressable, growing 20% YoY.**

- Global short-form video tools market: $4.2B in 2025 → $7.8B by 2028
- Our wedge: 50M+ active YouTube creators, 200M+ Instagram Reels creators
- Initial beachhead: podcasters + coaches + sports highlighters (highest ARPU)

---

## Slide 5: Product (Demo)

**Live demo at relativ.app**

[Screenshots of the live product]
- Paste a URL → 3-5 clips in 60s
- Pricing tiers: $0 / $19 / $99
- Self-host option
- API for Teams

---

## Slide 6: Tech / Moat

**The infrastructure is the moat.**

- bgutil PO-token provider (vs. wrapper-style competitors)
- Deno + Node JS runtime (vs. simple-API competitors)
- YOLO face tracking (vs. static-frame competitors)
- Self-hostable, open-source core
- €10/mo cost basis = wide margin room

Most competitors wrap OpenAI APIs in a UI. We built the **infrastructure** to fetch YouTube at scale, which is the actual hard problem.

---

## Slide 7: Traction

**Day 1 of public launch. Pre-revenue.**

- Live product at relativ.app
- 9-stage pipeline working end-to-end on real YouTube URLs
- 131 backend tests passing
- Open-source engine on GitHub
- Building in public (LinkedIn, X)
- 0 users → 100 users in 90 days (target)

---

## Slide 8: Business Model

**Three transparent tiers. No per-clip fees. No revenue share.**

| Tier | Price | What |
|---|---|---|
| Starter | $0 | 60 min/month, 10 clips, watermark |
| Pro | $19/mo | 600 min/month, no watermark, all formats |
| Teams | $99/mo | 10 seats, brand templates, API, SSO |

**Unit economics (Pro tier, target):**
- COGS per user: $1.20/mo (Hetzner VPS shared across 50 users)
- Gross margin: 94%
- LTV/CAC target: 5x (conservative for self-serve)

---

## Slide 9: Competition

| | RelatiV | Opus Clip | Gling | vidyo.ai |
|---|---|---|---|---|
| Hook scoring | Claude (taste) | Keyword | Keyword | Energy peaks |
| Self-hostable | ✅ | ❌ | ❌ | ❌ |
| Open-source | ✅ (engine) | ❌ | ❌ | ❌ |
| Pricing | $0/$19/$99 | $0/$19/$99 | $0/$15 | $0/$30 |
| Revenue share | ❌ | 20% | ❌ | 25% |
| YouTube direct | ✅ | ✅ | ❌ | ✅ |

**Our moat:** infrastructure (bgutil, JS runtime, IP routing) + taste layer (Claude). Competitors are wrappers.

---

## Slide 10: Roadmap

**Next 12 months:**

| Quarter | Milestone |
|---|---|
| Q2 2026 | Public launch, first 100 paying users, self-host guide, RunPod GPU mode |
| Q3 2026 | 1k paying users, real-time analytics, mobile app, brand portal v2 |
| Q4 2026 | 5k paying users, Series A or profitable bootstrapping, EU + US presence |
| Q1 2027 | 10k paying users, expansion to TikTok + Instagram direct, agency tools |

---

## Slide 11: Team

**1 person + 1 model.**

- **Deepraj, Founder.** India-based. Technical background. 3 days from idea to live product.
- **Hermes (AI), CTO.** Nous Research / MiniMax model. Writes the code, runs the deploy, takes the screenshots, tells me when I'm being unrealistic.

We are 1 human and 1 model, in 1 room, in India, building a real product.

*Hiring: First infra engineer / co-founder.*

---

## Slide 12: Ask

**Raising $250-500k pre-seed.**

**Use of funds:**
- 60% engineering (1-2 senior engineers, run RunPod GPU)
- 20% growth (creator-economy GTM, partnership with 1-2 YouTube networks)
- 10% ops (Sentry, monitoring, post-launch support)
- 10% reserve (runway extension if traction is slower than expected)

**18-month runway** at $500k raised.

**The ask:** 30-min call to see if this is a fit.

founders@relativ.app · relativ.app · @relativclips
