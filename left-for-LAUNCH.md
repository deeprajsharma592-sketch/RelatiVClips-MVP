# RelatiV — Left for LAUNCH

> **Read this first if you're a new session picking up RelatiV work.**
> This file is the single source of truth for "what's left to ship" + "context you will lose across compaction."

---

## TL;DR (30 seconds)

- **Product:** RelatiV — paste a YouTube URL → get 3 short viral clips via taste-based selection (Claude hook scoring + faster-whisper + librosa energy peaks + OpenCV face detect + ffmpeg render).
- **Brand:** "RelatiV" (stylized, V at end) / "relativclips" (URL spelling). Dark theme, fuchsia primary, glow tokens. Positioning: "infrastructure of authenticity" vs AI slop.
- **Live:** Backend on Hetzner (91.98.144.72:9000), 11/12 verify checks pass. 1 hard blocker: **Hetzner fsn1 IP is reputation-flagged by YouTube.**
- **Founder principle:** *"Robust and scalable, not dependent on third parties."* — own infra over pay vendors.
- **Founder tz:** Asia/Kolkata. Decision rhythm: late-night sprints with CTO-mode execution, expects action not questions.

---

## Founder's Open Decisions (BLOCKING work)

| # | Decision | Options | Default if no answer |
|---|---|---|---|
| 1 | **YouTube IP block fix** | (a) Recreate Hetzner box for new /24, (b) SOCKS5 from home/residential IP, (c) Multi-region VPS pool (~$20/mo), (d) Webshare paid (~$10-30/mo, VENDOR — founder rejected), (e) Wait 24-48h for IP rotation | I default to **(a) recreate** |
| 2 | **Auth provider** | Clerk ($25/mo), Supabase Auth (free tier), or skip for v1 (demo-with-shared-queue) | **Skip for v1**, add Supabase at v1.5 |
| 3 | **Payments** | Stripe paid v1, freemium-only, or pricing-page-but-no-Stripe-yet | **Pricing page only, no Stripe** until v1.5 |
| 4 | **Domain purchase** | relativclips.com + .app + .in + .io (~60-80/yr) | **Buying now** (screenshot showed 0 taken) |
| 5 | **Mentor/Prithvi DM** | Send the drafted messages for advice on IP block | **Send after domain buy** (5 min) |
| 6 | **Latency pass** | Wins 1-3+5 (free refactor ~3-4h) + Win 4 (RunPod scale, $ cost) | **Parked** — not critical for v1 launch |

---

## Current Deploy State (Hetzner, 91.98.144.72)

### What's LIVE ✅
- `relativ-backend-1` — FastAPI, **healthy**, all 15 endpoints, on `relativ_relativ_mesh` (172.18.0.5)
- `relativ-db-1` — Postgres 15, **healthy**, tables initialized, DB connected (no more memory-only mode)
- `relativ-bgutil-1` — Node PO-token provider, **healthy** (was unhealthy — healthcheck now uses `node http.get` not `wget`), returns valid `poToken` from `POST /get_pot`
- `relativ-caddy-1` — Caddy reverse proxy on :80/:443

### What PASSES in verify-deploy.sh (11/12) ✅
- Backend /health, /openapi.json, /vram
- bgutil /ping
- Intake endpoints: campaigns/quote, clippers/apply, intake/counts
- Frontend /, /brands, /clippers (3 routes)
- CORS preflight

### What FAILS ❌
- **YouTube anti-bot probe** — Hetzner fsn1 IP reputation block. `android_vr` and `web_safari` both return `LOGIN_REQUIRED` even with valid bgutil PO token + Deno 2.8.2 + node 20.19.2 JS runtime.

### 5 Deploy Bugs Fixed Today (commits on `wip/pipeline-v2`)
1. **`8c04822` — Dockerfile layout**: `COPY . ./backend/` + `PYTHONPATH=/app` + `CMD uvicorn backend.main:app` (was crashing with `ModuleNotFoundError: No module named 'backend'`)
2. **`f401e61` — docker-compose env**: `${DATABASE_URL}` from .env, node-based bgutil healthcheck
3. **`2c3c929` — requirements.txt**: added `yt-dlp>=2024.10.7` (was missing entirely from container)
4. **`4d6a7d7` — Dockerfile nodejs**: `apt install nodejs` (was no JS runtime, yt-dlp 2025+ needs it)
5. **`949227a` + `e8a7730` — Dockerfile Deno**: `curl deno.land/install.sh` + `unzip` (yt-dlp 2025+ EJS default is Deno, node 20 was "unsupported")

### Deploy Auth
- SSH key: `/root/.ssh/relativ_hetzner` (ed25519, passphrase-less)
- User: `root@91.98.144.72`
- ANTHROPIC_API_KEY: in `/app/RelatiV/.env` on Hetzner (chmod 600). Also in `/tmp/.relativ_anth_key` locally — **shred this local copy after deploy confirmed stable**.

### Git State
- Branch: `wip/pipeline-v2` (NOT pushed to origin — only local + server)
- Server pulls via `scp` not `git pull` (no upstream tracking on server)
- 16 commits today, latest `4d6a7d7` (or later when Deno commit lands)

---

## 🔧 BACKEND Remaining Work

### 🟥 Critical — blocks public launch
- [ ] **Auth** — Clerk / Auth0 / Supabase Auth. Currently single-user/demo.
- [ ] **Rate limiting** on intake endpoints (clippers/apply, brands/contact — no spam protection)
- [ ] **CORS tighten** from `allow_origins=["*"]` → specific origins (relativclips.com + vercel preview)
- [ ] **DB migrations** (Alembic) — `Base.metadata.create_all` is fine for v0, breaks when you change a column
- [ ] **Privacy**: anonymize user data in task logs (currently names + URLs leak)
- [ ] **Lock down server `.env`** — values are in `docker inspect` output today

### 🟧 Important — should-have for v1
- [ ] **Latency pass wins 1-3+5** (free refactor: parallelize stages 7-9, stream Claude response, HTTP/2 pool) — ~3-4h
- [ ] **Webhook for completed runs** — frontend poll-less updates
- [ ] **Error handling hardening** — exponential-backoff retries, graceful-degradation review
- [ ] **Sentry** (or equivalent) for exception tracking
- [ ] **Cost guardrails** — Anthropic $50/mo cap, Hetzner €20/mo alert, RunPod $20/mo (when added)
- [ ] **UptimeRobot** on `/health` — 5-min free checks, alerts to Telegram/email
- [ ] **Background job queue** (Celery or RQ) — replace ad-hoc `asyncio.to_thread`
- [ ] **API deprecation policy** — `/api/v1` exists, no v2 plan

### 🟨 Nice-to-have — v2+
- [ ] Multi-region worker pool (when Hetzner IP gets re-flagged)
- [ ] RunPod GPU transcription (when >50 runs/day)
- [ ] S3/R2 for outputs (when >500 GB)
- [ ] CDN for rendered clips
- [ ] DB read replicas
- [ ] Redis cache for repeated fetches
- [ ] OpenAPI examples + interactive docs (Swagger UI)
- [ ] Per-clipper leaderboard backend (currently static)

---

## 🎨 FRONTEND Remaining Work

### 🟥 Critical — blocks public launch
- [ ] **Vercel deploy** — code is build-clean, just needs to be pushed
- [ ] **NEXT_PUBLIC_API_URL** wiring so "Try a demo" actually hits the backend
- [ ] **HTTPS via custom domain** (relativclips.com → Vercel, api.relativclips.com → Hetzner)
- [ ] **Pricing page** — transparent tiers, no "contact for pricing"
- [ ] **FAQ page** — 5-8 common questions (cuts support load 50%)
- [ ] **Custom 404 / error pages** (not Next.js default)
- [ ] **User dashboard** — "your past pipeline runs" with download links
- [ ] **Privacy policy + Terms of service** — needed before public traffic

### 🟧 Important — should-have for v1
- [ ] **Clipper portal** — post-apply status tracking (currently one-shot)
- [ ] **Brand portal** — post-contact quote review
- [ ] **Toast notifications** — success/error feedback on form submits
- [ ] **Inline form validation** — error states, not just "required"
- [ ] **Loading skeletons** — not spinners (perceived perf)
- [ ] **Empty states** — "no clips yet" with clear CTA
- [ ] **OG image / social cards** — for Twitter/LinkedIn link previews
- [ ] **SEO: structured data** — Organization, Product, FAQ schema
- [ ] **Vercel Analytics** — free, 1-line enable
- [ ] **Mobile QA** (deep, not just responsive) — 60%+ of your traffic will be mobile
- [ ] **Accessibility audit** — axe-core pass, fix any AA violations
- [ ] **Stripe integration** — paid plans when ready

### 🟨 Nice-to-have — v2+
- [ ] Blog / changelog
- [ ] A/B test infrastructure (PostHog or similar)
- [ ] Real testimonials (founder said add manually after launch)
- [ ] Animation polish (Framer Motion)
- [ ] Image optimization (Cloudflare Images or Vercel built-in)
- [ ] Test coverage merge (vitest worktree exists at `wt/lane-frontend-tests`, not yet on main)
- [ ] Brand voice consistency pass on all copy
- [ ] Conversion tracking (PostHog or Plausible)

---

## 🌐 INFRA / DEPLOY / OPS

### 🟥 Critical
- [ ] **Buy domain**: relativclips.com + .app + .in + .io (~60-80/yr, Namecheap recommended)
- [ ] **DNS records**: `relativclips.com` → Vercel, `api.relativclips.com` → 91.98.144.72
- [ ] **TLS cert** — Caddy auto-issues for api., Vercel auto for app

### 🟧 Important
- [ ] **Hetzner firewall** — current `firewall-1` allows 80/443 globally; restrict 9000 to localhost + Vercel IPs
- [ ] **Cost guardrails** (Anthropic + Hetzner billing alerts)
- [ ] **Backup strategy** — daily `pg_dump` to Hetzner Storage Box (€3/mo) or S3
- [ ] **Incident runbook** — "if X breaks, do Y, ping Z" — 1 page, lives in repo

### 🟨 Nice-to-have
- [ ] **Status page** (statuspage.io free tier or self-hosted)
- [ ] **Auto-scaling policy** (when Hetzner CPU > 80% sustained 10 min → add worker)
- [ ] **Load testing** (k6 or Locust) — know your ceiling before users do
- [ ] **Disaster recovery** — restore-from-backup drill quarterly

---

## Crons Armed (auto-fires)

| Cron ID | Fires | Action |
|---|---|---|
| `c7f09f9711ae` | Tonight 18:30 UTC (midnight IST) | Send midnight progress report to Discord |
| `097dcd1f7ff1` | 2026-06-12 00:00 UTC | **Real-time analytics work begins** — plan + 3 questions, no code yet |
| `c8d99e30548c` | 2026-06-12 05:30 UTC | **Clipper section deep dive** — go deep on LiveTicker, CreatorStats, ClipperLeaderboard for v2 |

---

## Critical Paths / IPs / Files (NEVER lose these)

| What | Where |
|---|---|
| Hetzner IP | `91.98.144.72` |
| Hetzner SSH key | `/root/.ssh/relativ_hetzner` (passphrase-less ed25519) |
| ANTHROPIC_API_KEY local | `/tmp/.relativ_anth_key` (chmod 600) — **shred after deploy** |
| ANTHROPIC_API_KEY server | `/app/RelatiV/.env` on Hetzner |
| Git branch | `wip/pipeline-v2` (NOT pushed to origin) |
| Deploy runbook | `docs/HETZNER-DEPLOY-RUNBOOK.md` |
| Verify script | `scripts/verify-deploy.sh` (12 checks) |
| Anti-bot probe | `backend/scripts/probe_youtube_antibot.py` |
| Lock wrapper | `backend/pipeline/ingestion.py` (`_yt_fetch_lock = threading.Lock()`) |
| Docker files | `Dockerfile` (root), `backend/Dockerfile`, `docker-compose.yml` |
| Ingress | Caddyfile → Caddy auto-TLS for `api.relativclips.com` |
| Pricing math | `backend/api/routes.py` `/api/v1/campaigns/quote` (server-authoritative) |
| CookieBanner | `frontend-next/components/CookieBanner.tsx` (SSR-safe) |
| HeroBackground | `frontend-next/components/HeroBackground.tsx` (mounted-gate) |
| Figma colors | 230 token refs in `frontend-next/tailwind.config.*` (fuchsia `#D946EF`) |

---

## Anti-bot Strategy (founder-confirmed)

- **Level 1 (current):** bgutil PO-token provider + Deno JS runtime + node fallback + threading.Lock serialization + `--sleep-interval 5/15` slow rate
- **Level 2 (next):** Multi-region VPS pool (~$20/mo, owned, scales linearly) — **FAVORED** if Hetzner IP stays flagged
- **Level 3 (deferred):** SOCKS5 from residential IP — only if founder acquires a home/office machine
- **Level 4 (last resort):** Webshare residential paid ($2.99/GB) — founder explicitly rejected as "dependent"
- **FORBIDDEN:** Free 1GB-tier proxies, free VPNs (already flagged, no quality signal)
- **Fallback ladder is intentional, not a wish list** — every level has been priced and ranked

---

## The YouTube IP Block — Decision Tree

Current state: bgutil + Deno + node + slow rate all wired and proven working. The **only** failure mode is YouTube's IP reputation layer flagging Hetzner fsn1.

```
YouTube IP block (active, blocks 91.98.144.72)
    │
    ├─ (a) Recreate Hetzner box → new /24, ~10 min downtime
    │     Risk: might land in same flagged range
    │     Cost: $0
    │
    ├─ (b) SOCKS5 from founder's home/residential IP
    │     Risk: founder has no home machine
    │     Cost: $0
    │
    ├─ (c) Multi-region VPS pool (Hetzner + Vultr/OVH)
    │     Risk: if all VPS IPs are in same YouTube bucket, doesn't help
    │     Cost: ~$20/mo total
    │
    ├─ (d) Webshare residential paid ($2.99/GB)
    │     Risk: founder's principle violation ("not dependent")
    │     Cost: ~$10-30/mo
    │
    └─ (e) Wait 24-48h for Hetzner IP rotation
          Risk: Hetzner might re-use the same IP
          Cost: $0, but blocks launch
```

**My default if no answer: (a) recreate the box.** Fast, free, sometimes works.

---

## Drafts Ready (not yet sent)

### LinkedIn DM to Prithvi Devireddy (full version in chat)
- Casual opener, 3-bullet problem, asks 15-min call
- Tone: peer-founder-to-peer-founder

### DM to Founder's Mentor (shorter version)
- 5 sentences max, 3 options listed, casual sign-off
- Tone: founder-pinging-mentor-for-gut-check

### DEPLOY.md updated with: YouTube anti-bot (bgutil) section
- Already merged, in `docs/DEPLOY.md` §10

### HETZNER-DEPLOY-RUNBOOK.md
- Already merged, in `docs/HETZNER-DEPLOY-RUNBOOK.md`
- Includes cost breakdown, 9-step deploy, 4-level YouTube fallback

---

## Things NEVER to do (founder's principles)

- ❌ Sign up for free 1GB-tier proxies or free VPNs (founder explicitly: "honestly shit tbh i want a robust and scalable system not a dependent system")
- ❌ Touch frontend/brand during deploy work unless asked
- ❌ Surface taste/niche/ICL rationale (founder marked these as deferred)
- ❌ Make product-ambiguity decisions without asking (deployment is fine, features need sign-off)
- ❌ Reveal ANTHROPIC_API_KEY in plain text in any output
- ❌ Skip the slow rate limits on yt-dlp (we just hardened these, don't undo)
- ❌ Push past midnight IST without founder consent (his self-imposed stop)

---

## What I do autonomously vs needs input

### Autonomous (no founder input needed)
- Frontend Vercel deploy (need Vercel token OR founder does it)
- Sentry / error tracking wire-up
- Uptime monitoring setup
- CORS tighten + rate limiting
- Alembic migrations
- Latency pass wins 1-3+5 (free refactor)
- Backup automation

### Needs founder input
- Auth choice (Clerk vs Supabase vs skip)
- Payments decision (Stripe v1 or freemium)
- YouTube IP block fix choice
- Domain purchase (him buying)
- DMs to Prithvi/mentor (him sending)
- Public launch date

---

## Quick state checks (for next session)

```bash
# Backend healthy?
ssh -i /root/.ssh/relativ_hetzner root@91.98.144.72 \
  'docker ps --format "table {{.Names}}\t{{.Status}}"'

# Verify full stack (run on Hetzner)
ssh -i /root/.ssh/relativ_hetzner root@91.98.144.72 \
  'cd /app/RelatiV && bash scripts/verify-deploy.sh http://localhost:9000 http://localhost:3000'

# YouTube probe (real test)
ssh -i /root/.ssh/relativ_hetzner root@91.98.144.72 \
  'docker exec -e BGUTIL_POT_BASE_URL=http://bgutil:4416 relativ-backend-1 \
   python -m backend.scripts.probe_youtube_antibot'

# Local git state
cd /app/RelatiV && git log --oneline -5 && git status -s
```

---

**Last updated: 2026-06-11 (pre-midnight IST progress report)**
**Status: 11/12 verify green, YouTube IP block is the ONLY blocker to public launch.**

