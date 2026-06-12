# RelatiV — LAUNCH-KIT

> **For Deepraj to use in his Day 1 launch. All content, all assets, all outbound scripts in one place.**
> **Built during the 9:45 AM → 5:00 PM IST "ship today" block on 2026-06-12 (actual: completed in ~1.5h).**

## The launch is done. Everything's in this folder.

| # | File | What it is | Where to use |
|---|---|---|---|
| 00 | [launch-summary.md](00-launch-summary.md) | **START HERE.** Day 1 launch summary, cost breakdown, what's parked | Read first; share with cofounders/investors |
| 1 | [founder-story.md](01-founder-story.md) | ~600 word LinkedIn long-form post, "Why I'm building RelatiV in public" | LinkedIn article + landing-page /about |
| 2 | [thread-shipping.md](02-thread-shipping.md) | 8-post X thread: "What we shipped in 7 hours" | X / Twitter thread |
| 3 | [thread-youtube-antibot.md](03-thread-youtube-antibot.md) | 6-post X thread: "The YouTube anti-bot rabbit hole" | X / Twitter thread (dev audience) |
| 4 | [thread-founder-infra.md](04-thread-founder-infra.md) | 7-post X thread: "Why founder-led infra decisions matter" | X / Twitter / LinkedIn (founder audience) |
| 5 | [mentor-targets.md](05-mentor-targets.md) | 10 specific mentor/angel targets with draft DMs | Cold outreach DMs |
| 6 | [funding-list.md](06-funding-list.md) | 8 funding programs (YC, Pioneer, OnDeck, Afore, Antler, Surge, 100X, MS/Google) | Applications |
| 7 | [pitch-deck.md](07-pitch-deck.md) | 12-slide pitch for investor meetings | Convert to PDF, send to investors |
| 8 | [one-pager.md](08-one-pager.md) | 1-page distilled version | Cold email attachment |
| 9 | [pricing-page.md](09-pricing-page.md) | Pricing page content | /plans route |
| 10 | [faq.md](10-faq.md) | FAQ page content (8 categories, 25+ Q&As) | /faq route |
| 11a | [privacy.md](11a-privacy.md) | Privacy policy (GDPR-compliant v1) | /privacy route |
| 11b | [tos.md](11b-tos.md) | Terms of service (v1) | /tos route |
| 12 | [about.md](12-about.md) | About page content (founder story, manifesto, roadmap) | /about route |
| 13 | [services-setup.md](13-services-setup.md) | 30-min guide for UptimeRobot, Sentry, PostHog, MS, Google | Founder setup (5-10 min each) |

## Screenshots (cleaned, in /app/RelatiV/screenshots/)

| # | File | What |
|---|---|---|
| 01 | 01-landing-hero.png | Hero + tech stack trust strip |
| 02 | 02-landing-demo.png | Interactive YouTube URL demo card |
| 03 | 03-landing-engine.png | "Four models" bento (Claude + Whisper + YOLO + Storytelling) |
| 04 | 04-landing-verticals.png | 6 use cases (Podcasters, Sports, Coaches, E-commerce, Music, Brand) |
| 06 | 06-landing-cta.png | Final "Stop editing" CTA |
| 07 | 07-clippers.png | /clippers full page |
| 08 | 08-apply.png | /clippers/apply form |

## Live URLs (today)

- **Public API:** `http://91.98.144.72:9000/health`
- **Public frontend:** `http://91.98.144.72:3000`
- **GitHub:** `<your-org>/RelatiVClips-MVP`
- **Branch:** `wip/pipeline-v2`
- **Latest commit:** see `git rev-parse HEAD` in /app/RelatiV

## Today's founder action items (priority order)

1. **Send the 3 DMs** (LAUNCH-KIT/05 — Prithvi, mentor, 1-2 more) — 10 min
2. **Post the founder story** on LinkedIn (LAUNCH-KIT/01) — 5 min to publish
3. **Stagger the 3 X threads** (LAUNCH-KIT/02, 03, 04) — 1 per day for 3 days
4. **Set up 4 services** (LAUNCH-KIT/13 — UptimeRobot, Sentry, PostHog, MS for Startups) — 30 min
5. **Buy the domain** (relativ.app + .in + .io + .app, ~$15/yr) — 5 min

## Live verification (run anytime)

```bash
ssh -i /root/.ssh/relativ_hetzner root@91.98.144.72 \
  'cd /app/RelatiV && bash scripts/verify-deploy.sh http://localhost:9000 http://localhost:3000'
```

Expected: 11/12 green, 1 expected YouTube IP block failure (parked, see left-for-LAUNCH.md).

---

**Built in public by Deepraj, with Hermes (CTO) on Nous Research / MiniMax.**
**The counter-move is here.**
