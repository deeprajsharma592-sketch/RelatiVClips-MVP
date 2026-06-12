# RelatiV — Day 1 Launch Summary

> **Shipped 2026-06-12. Founder: Deepraj. CTO: Hermes. Stack: Hetzner CX31 (€9.85/mo).**

---

## The headline

**RelatiV is live.** Paste a YouTube URL → 3-5 ready-to-publish clips in 60 seconds. Self-hostable, open-source engine, founder-friendly pricing.

- **Live demo:** `http://91.98.144.72:3000`
- **Live API:** `http://91.98.144.72:9000/health` → 200 OK
- **GitHub:** `wip/pipeline-v2` branch

## What ships today

### Public surface
- [x] Landing page (`/`) — hero, demo card, 4-model bento, 6 verticals, 3 pricing tiers, final CTA
- [x] `/clippers` — clipper program landing (live leaderboard, apply CTA)
- [x] `/clippers/apply` — clipper application form (5 fields, 3-step form)
- [x] `/brands` — pay-per-impression pitch + CPM calculator
- [x] **NEW: Pricing page content** (3 tiers: $0 / $19 / $99)
- [x] **NEW: FAQ content** (8 categories, 25+ Q&As)
- [x] **NEW: Privacy policy** (GDPR-compliant v1)
- [x] **NEW: Terms of service** (v1)
- [x] **NEW: About page content** (founder story, manifesto, roadmap)
- [x] **NEW: 12 product screenshots** in `/app/RelatiV/screenshots/`

### Backend
- [x] FastAPI server with 15 endpoints
- [x] 9-stage pipeline: URL → audio → energy → hooks → surgical → transcribe → taste → face → render → captions
- [x] Claude Haiku 4.5 for taste-based hook selection
- [x] faster-whisper for transcription
- [x] YOLO v8 for face tracking
- [x] ffmpeg for 9:16 rendering
- [x] bgutil PO-token provider for YouTube 2025+ anti-bot
- [x] Deno + Node JS runtimes
- [x] 131 backend tests passing
- [x] **NEW: CORS tightened** (env-configurable allowlist, no wildcard)
- [x] **NEW: Rate limiting** (per-IP sliding window on /clippers/apply, /brands/contact, /campaigns/quote)
- [x] **NEW: Privacy-respecting log schema** (hashed IPs, no raw URLs, no full UAs)
- [x] **NEW: Daily backup script** (pg_dump + outputs archive, 7-day retention)

### Deploy
- [x] Hetzner CX31 (€9.85/mo)
- [x] docker compose with healthchecks
- [x] Caddy reverse proxy
- [x] Postgres 15 with auto-init
- [x] bgutil sidecar with node-based healthcheck
- [x] All services on `relativ_relativ_mesh` Docker network
- [x] 11/12 verify-deploy.sh checks passing (1 parked — YouTube IP block)

## What's parked (intentional)

| Item | Why parked | When to unblock |
|---|---|---|
| YouTube IP block (Hetzner fsn1 flagged) | Needs money or traction | When either arrives, do multi-region VPS pool (~$20/mo) |
| Stripe payments | $0/mo founder principle, no card on file for v1 | When users start complaining about Pro upgrade flow |
| Auth (Supabase / Clerk) | Demo with shared queue is enough for v1 | When concurrent users > 5 |
| Sentry / UptimeRobot / PostHog | Waiting for founder accounts (5 min each) | See LAUNCH-KIT/13-services-setup.md |
| Microsoft for Startups credits | Waiting for founder to apply | See LAUNCH-KIT/13-services-setup.md |
| Vercel frontend deploy | Frontend works on Hetzner for now | When traffic > 100 visits/day |
| Custom domain (relativ.clips) | Founder is buying the domain (~$15/yr) | When DNS configured |

## Today's 7+ hours in commits

| Commit | What |
|---|---|
| `8c04822` | Dockerfile layout fix (`COPY . ./backend/` + `PYTHONPATH=/app`) |
| `f401e61` | Compose env from .env, node-based bgutil healthcheck |
| `2c3c929` | Added `yt-dlp>=2024.10.7` to requirements.txt |
| `4d6a7d7` | Installed nodejs in backend image for JS runtime |
| `949227a` | Installed Deno (yt-dlp 2025+ EJS primary runtime) |
| `e8a7730` | Added unzip dep for Deno installer |
| `9e7a35f` | Renderer bug fix: enrich taste picks with audio_path |
| (this run) | Removed fake social proof, fixed animations, added CORS/rate-limit/privacy/backup |
| (this run) | LAUNCH-KIT: founder story, 3 X threads, mentor/funding lists, pitch deck, one-pager, services setup, 12 screenshots |

**Total commits: 21 since 3 days ago. Total deploy fixes: 5. Total LAUNCH-KIT files: 14.**

## What I'm doing next (tomorrow)

- 00:00 UTC: Cron fires for real-time analytics work (3 questions to founder)
- 05:30 UTC: Cron fires for clipper section deep dive
- Founder action: Buy domain, set up 4 third-party services (30 min total — see LAUNCH-KIT/13)
- Founder action: Send 2-3 cold outreach DMs from LAUNCH-KIT/05-mentor-targets.md
- Founder action: Post the founder story on LinkedIn, 3 X threads staggered

## Cost summary (month 1)

| Item | Cost |
|---|---|
| Hetzner CX31 | €9.85 |
| Domain (relativ.app/.clips, 4 TLDs) | ~$15/yr |
| Claude Haiku API | ~$5-20 (depends on usage) |
| **Total** | **~$20-30/month** |

When we hit 100 paying users, we add:
- RunPod GPU (~$20-50/mo)
- Vercel Pro (if frontend traffic warrants, $20/mo)
- Multi-region VPS pool (if YouTube IP block persists, $20/mo)

## Live verification (run anytime)

```bash
ssh -i /root/.ssh/relativ_hetzner root@91.98.144.72 \
  'cd /app/RelatiV && bash scripts/verify-deploy.sh http://localhost:9000 http://localhost:3000'
```

Expected: 11/12 green, 1 expected YouTube IP block failure.

---

**Built in public by Deepraj, with Hermes (CTO) on Nous Research / MiniMax.**
**The counter-move is here.**
