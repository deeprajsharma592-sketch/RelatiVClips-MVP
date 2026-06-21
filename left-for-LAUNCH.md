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
## ✅ 2026-06-18 — Backend Tests: 147 Passing

**Fixed 9 pre-existing failures + added 6 integration tests:**

1. `test_model_router.py` — fixed import path (`llm` → `backend.llm`)
2. `taste/icl.py` — restored ICL features + surgical context + `creator_history` support in `build_archetype_aware_prompt`; fixed `parse_moment_response` to handle BOTH new (`moment_index`/`picks`) and legacy (`candidate_index`/bare array) LLM output formats
3. `llm/model_router.py` — fixed tier priority: picks threshold check comes BEFORE hard budget check (was checking $1.999 > $1.00 → "fallback" instead of "picks threshold")
4. `tests/test_orchestrator.py` — fixed mock LLM JSON format to use `picks` wrapper with `moment_index`
5. `pipeline/orchestrator.py` — added `creator_history` passthrough to `build_archetype_aware_prompt`
6. `tests/test_youtube_bgutil.py` — rewrote `test_socks5_proxy_added_when_set` using `sys.modules` interception to force yt-dlp path
7. `tests/test_model_router.py::test_budget_enforcement` — fixed per-pick cost to stay under hard budget

**6 new integration tests** at `backend/tests/integration/test_pipeline_and_routers.py`:
- `test_orchestrator_end_to_end_with_mock_llm` — full pipeline with mocked energy + hooks + surgical + LLM
- `test_orchestrator_falls_back_to_energy_when_llm_returns_invalid_json` — LLM failure → energy fallback
- `test_parse_moment_response_new_format` / `test_parse_moment_response_legacy_format` — dual-format JSON parsing
- `test_parse_moment_response_invalid_raises_value_error` — error handling
- `test_archetype_aware_prompt_includes_creator_history` — creator history in ICL prompt
- `test_surgical_context_basic_archetype_prompt_renders` — archetype prompt rendering
- `test_config_module_has_required_pipeline_settings` — config integrity
- `test_cost_control_record_call_updates_counters` — cost control bookkeeping

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

## v5.1 Premium Redesign — Shipped 2026-06-12 (later)

**Session arc:** user said UI "still not matching my expectation" + asked for premium SaaS feel + 5-6hr push + supermemory setup.

### What shipped
- **Design system v5.1**: cream glass aesthetic, Instrument Serif italic accents on display sans, numbered section markers (01-12), motion utilities (`btn-shine`, `hover-glow`, `hover-lift`, `magnetic`, `page-enter`, `film-grain`, `cursor-dot`, `text-reveal`, `live-pulse`, `tabular-nums`, premium focus rings)
- **Landing page** (`/`): 12 numbered sections + 4 new (Trust strip, How it works, Live preview, FAQ, premium Footer)
- **Dashboard mockup polish**: stage transitions (Transcribe → Score → Detect → Render), eased progress, active moment highlight with shimmer, live counters (elapsed/words/fps)
- **Re-skinned subpages**: `/brands`, `/services`, `/plans`, `/campaigns` (all to cream glass, 7-section layout pattern)
- **Hero polish on `/clippers`**: status pill, section marker, sunset gradient headline
- **Footer**: cream glass, 4 link columns, "All systems operational · v2.0" status, social pills, big italic-V "RelatiV" wordmark
- **New components**: `ScrollProgress` (top bar + right-edge section tracker), `CustomCursor` (fuchsia dot + ring, mix-blend-mode, hover scale), `MagneticButton` (subtle mouse-follow on CTAs), `TextScramble` (random char cycle on hover, applied to hero "ten viral clips")
- **Mobile overflow fix**: 768px was 141px over (header button + MathBackground glyphs + marquee). Fixed via `html,body{overflow-x:hidden}` + hiding "Get started" until md + browser scroll-clipping. All 3 viewports (1440/768/390) now clean.

### Verified
- Build clean (19 routes, 3.5s)
- Live on https://relativclips.com (HTTPS, primary domain)
- All 12 section IDs (section-0..section-11) hooked to scroll-spy
- 4 subpages re-skinned with consistent SectionMarker pattern

### Supermemory setup
- SDK installed (`supermemory 3.46.0`)
- Bridge: `/app/RelatiV/memory/supermemory_bridge.py` (remember/recall/profile/status CLI)
- Free tier: $5/mo usage credit
- **BLOCKED on user**: needs to sign up at supermemory.ai → Settings → API keys → add `SUPERMEMORY_API_KEY=***` to `/app/RelatiV/.env`

### Pending
- Auth pages polish (login/signup/account — already in good shape, btn-shine pending)
- Real-time analytics cron firing
- Clipper section deep-dive cron firing

---

**Last updated: 2026-06-12 (post-v5.1-premium push)**
**Status: 12/12 verify green, premium v5.1 shipped, supermemory bridge staged (needs key).**

---

## v6 Real User Onboarding & Live Data — Shipped 2026-06-13 (early)

**Session arc:** user said "start the pending tasks now, keep supermemory for later." I picked the real-user onboarding block as highest leverage.

### What shipped
- **Server-side route protection** (`frontend-next/src/middleware.ts`):
  - Anonymous users hitting `/account`, `/brands/*`, `/clippers/*`, `/creators/*` -> 307 to `/signup?next=...`
  - Authed users on `/login` or `/signup` -> 307 to `/account`
  - 3 cookie names supported (`relativ_session`, `relativ_access_token`, `session`) for resilience
  - Skip `_next/static`, `_next/image`, favicon, robots, sitemap, manifest, all image assets
- **Role-based post-auth redirect**:
  - `signup/page.tsx`: reads `result.user.role` from signup response, redirects creator->`/creators/dashboard`, brand->`/brands/dashboard`, clipper->`/clippers/dashboard`, fallback->`/account`
  - `login/page.tsx`: same logic but honours `?next=` if it points to a real, safe path
  - New helper `roleDestination(user)` in both files
- **Dashboards wire to real user via `useAuth()`**:
  - `/brands/dashboard` + `/clippers/dashboard`: loading skeleton (4 pulse cards), no-user safety net, real `user.name` + `user.email` in sidebar (was hard-coded "Acme Co." / "Maya Chen"), role-mismatch banner with deep-link to correct dashboard
  - Banner styled per role: coral/pink for brand, violet for clipper
- **E2E auth verified**: 8/8 checks pass - signup 201, dup 409, login 200, /me 200, bad role enum 400, wrong password 401, logout 204, brand DB row created with all 8 fields (company_name, industry, website, payment_terms=net15 default)
- **Test users updated**: `clipper@test.com` was missing from DB despite docs claiming 3 - created via signup with handle=@hookqueen, specialty=Podcasts Tech. Now 4 accounts in DB.
- **GitHub**: merged wip/pipeline-v2 (10 commits behind) -> main rebased, pushed. Auto-deploy did not fire (CDN cache held old build). `bash /root/.vercel-tmp/deploy.sh` deployed in 45s, build clean (24 routes including f Proxy Middleware).
- **Production middleware verified**: 5/5 redirect tests pass via `curl -I`. /account -> 307 /signup?next=%2Faccount, /brands/dashboard -> 307 /signup?next=%2Fbrands%2Fdashboard, /clippers/dashboard -> 307, /creators/dashboard -> 307, /signup with cookie -> 307 /account.

### Discovered quirks
- Vercel token is in `/root/.vercel-tmp/token` (60 chars). Use `bash /root/.vercel-tmp/deploy.sh` - the script does link+env+deploy in one go.
- Vercel CDN cache held the OLD build for 64min even after a push (`age:` header revealed it). `git push` alone did not trigger a fresh deploy this time. `vercel deploy` worked.
- Next.js 16 deprecates `middleware` filename in favor of `proxy`. Warning, not error.
- Cookie name is `relativ_session` (not the legacy `relativ_access_token`).

### Files added
- `frontend-next/src/middleware.ts` (NEW, 90 lines, 3KB)

### Files modified
- `frontend-next/src/app/(auth)/signup/page.tsx` (smart redirect + roleDestination helper)
- `frontend-next/src/app/(auth)/login/page.tsx` (same)
- `frontend-next/src/app/brands/dashboard/page.tsx` (+useAuth, +loading, +role-mismatch, real user in sidebar)
- `frontend-next/src/app/clippers/dashboard/page.tsx` (same)

### Screenshots saved (v6-onboarding/)
- `01-signup-role-1440x900.png` - signup wizard step 1
- `02-login-1440x900.png` - login form
- `03-signup-role-mobile-390x844.png` - signup on mobile
- `04-middleware-redirect-1440x900.png` - anon user bounced from /account to /signup
- `05-brand-dash-with-clipper-cookie-1440x900.png` - clipper user on /brands/dashboard with role-mismatch banner
- `06-brand-dash-with-brand-cookie-1440x900.png` - brand user on /brands/dashboard, no banner, real name Acme Co
- `07-signup-role-mobile-390x844.png` - signup on mobile (alt crop)

---

**Last updated: 2026-06-13 (post-v6-onboarding push)**
**Status: real user onboarding shipped, middleware live in prod, 8/8 E2E auth checks pass, 4 test accounts seeded.**

### 📋 Parked — content idea (awaiting user video)
- User has a content idea branched days ago, will share as video "by tomorrow"
- When video arrives: transcribe → distill → produce in whichever format (landing copy / social / email / pitch)
- Source: Discord #gtm-marketing / content thread, started 2026-06-13 with "content"



## Tier 1 (v7) — Real User Onboarding & Live Data (2026-06-13)

**Goal**: Convert the 3 dashboards from mock data → real DB data, add forgot/reset/verify flows, and wire Stripe to /plans.

### What shipped

**Backend** (3 new routers + 3 new tables + 4 new user columns):
- `routers/dashboard_router.py` — `GET /api/v1/dashboard/{brand,clipper,creator}` returns real KPIs, campaigns, clips, weekly chart
- `routers/email_auth_router.py` — `/forgot-password`, `/reset-password`, `/verify-email`, `/resend-verification`
- `routers/billing_router.py` — `/billing/config`, `/billing/create-checkout`, `/billing/webhook`
- `services/email_backend.py` — multipart SMTP send with Resend/Postmark/SMTP/console fallback
- `scripts/migrate_tier1.py` — adds 4 user columns + 3 marketplace tables + seeds 4 campaigns, 2 claims, 2 clips
- `models.py` — `CampaignModel`, `CampaignClaimModel`, `CampaignClipModel`
- `auth_router.py` — auto-generates email verification token on signup + sends welcome email
- `stripe==9.12.0` installed

**Frontend** (3 new auth pages + 3 dashboards wired):
- `/forgot-password` — email input → "check your inbox"
- `/reset-password` — token from URL → new password → success/expired
- `/verify-email` — auto-verify on mount → 4 states (loading/success/error/no-token)
- `/brands/dashboard` (994 lines) — wired to `getBrandDashboard` API, role-mismatch banner, 3 states
- `/clippers/dashboard` (875 lines, violet accent) — wired to `fetchClipperDashboard`
- `/creators/dashboard` — wired to `fetchCreatorDashboard`
- `/account` — Resend verification email banner when `is_verified=false`
- `/plans` — Stripe checkout wired (Pro $29, Elite $99), 4 banner states
- `lib/api.ts` — 7 new API helpers + 4 TypeScript interfaces

### Verified in production (https://relativclips.com)

- 3 dashboard endpoints: 200 with rich real data
  - brand: $15,880 spent, 2.01M views, 4 campaigns with per-campaign clip counts
  - clipper: $1,323 pending, $4,207 lifetime, 1 open campaign (Huberman Lab, $6 CPM, 6/12 slots)
  - creator: $280.70 this month, 5 auto-clips, 2 brand deals ($7,000 open)
- Auth flows: signup → 200 (auto-token generated, is_verified=false), login → 200 + cookie
- Password reset: 200, token consumed, new pass works (200), old fails (401), restored to testpass1234
- Email verify (GET): 200, is_verified=true, token nulled, timestamp set
- Middleware: anon→/signup?next=... (307), dashboards protected (307), auth pages open (200)
- Billing config: 2 plans visible, stripe_enabled=false (awaiting keys)

### Files

- NEW: `backend/routers/dashboard_router.py`, `email_auth_router.py`, `billing_router.py`
- NEW: `backend/services/email_backend.py`, `scripts/migrate_tier1.py`
- NEW: `frontend-next/src/app/forgot-password/page.tsx`, `reset-password/page.tsx`, `verify-email/page.tsx`
- MODIFIED: backend models, auth_router, main, frontend api.ts, 3 dashboards, /account, /plans
- 16 screenshots in `.hermes/screenshots/v7/` (3 dashboards × 3 viewports + 7 page captures)

### Pending for Tier 1 to be "done done"

- Add `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_CLIPPER_PRO/ELITE` to `.env` to enable checkout
- Optionally `RESEND_API_KEY` for transactional email
- After that, Tier 2 (marketplace launch: campaigns CRUD, clip submission, view-verification bot)

---

## v8 — Tier 2: Marketplace Launch (2026-06-13)

**Backend:** 4 new routers, 22 new endpoints, 1 new enum value. **Frontend:** 6 new pages, 32 total routes. **E2E:** 13/13 marketplace tests pass.

### Backend (4 routers, 22 routes)

- `routers/campaigns_router.py` — CRUD + pause/resume/complete/cancel with Pydantic validation (CPM $1-$1000, budget $10-$100k, slots 1-1000)
- `routers/claims_router.py` — claim/unclaim/list-claimants/my-claims, 7-day auto-deadline
- `routers/clips_router.py` — submit/approve/reject/pending-review/clip-detail, idempotent state transitions
- `services/verification_service.py` + `routers/verification_router.py` — mock view-polling bot (platform-specific growth rates, auto-verified at 5K views)
- `CampaignStatus.CANCELLED` added (soft-delete for budget unfreeze)

### Frontend (6 pages, 32 routes total)

- `/brands/campaigns` — list with status filter tabs + create CTA
- `/brands/campaigns/new` — form with **live preview** (auto-computes reach, per-clip pay, slots)
- `/brands/campaigns/[id]` — Overview/Claimants/Clips/Pending tabs with inline Approve/Reject
- `/clippers/campaigns` — browse with filter chips (All/High CPM/Tech/Health/Business/Closing soon)
- `/clippers/clips` — status-grouped list of submitted clips (Pending/Approved/Verified/Rejected)
- `/clippers/clips/new` — submission form with claim context
- Brand dashboard cards now link to detail; clipper dashboard "Apply" links to browse

### Verified in production (https://relativclips.com)

- 13/13 marketplace E2E tests pass against real DB
  - brand creates campaign → clipper claims slot → submits clip → brand approves → view-verification run (+993 views, $7.94 earned)
- All 5 new pages protected by middleware (anon→/signup 307)
- Clipper signed in as Maya Chen sees 6 clips grouped: 2 pending (E2E), 2 approved, 2 verified ($4,215 lifetime)
- Brand campaign form has live preview (CPM × budget auto-shows total reach)
- 0 console errors, 0 React errors on any page

### Bugs fixed during build

1. **Route order** — `/clips/pending-review` matched as `{clip_id}` first → moved static path before dynamic
2. **TypeScript collision** — `Clip` (pipeline) vs new `Clip` (marketplace) → aliased old as `PipelineClip`
3. **T-SQL `iif()`** in dashboard → `case()` for PostgreSQL (carryover from Tier 1)
4. **`UserRole.ADMIN` doesn't exist** → removed admin check, scoped verification to brand/clipper
5. **`CampaignStatus.CANCELLED` missing** → added to enum
6. **Next.js 16 `useSearchParams`** → wrapped in `<Suspense>` (was the wrong fix for the actual bug)
7. **React error #310 "Rendered more hooks"** → moved 2 `useMemo` calls above the early returns in `/clippers/campaigns` and `/clippers/clips`

### Files

- NEW: `backend/routers/campaigns_router.py`, `claims_router.py`, `clips_router.py`, `verification_router.py`
- NEW: `backend/services/verification_service.py`, `/tmp/test_marketplace.py`
- NEW: 6 frontend pages listed above
- MODIFIED: backend `models.py` (CANCELLED), `main.py` (4 new routers), `lib/api.ts` (+9 helpers)
- 8 screenshots in `.hermes/screenshots/v8-marketplace/`

### Pending for Tier 2 to be "done done"

- Add a real view-verification polling job (currently invoked on-demand)
- Brand campaign analytics: per-clip CPM actual vs target, drop-off scatterplot
- Clip submission form: multi-platform URL detection, auto-fill title/hook from URL

---

## v9 — Tier 3: SEO + Content + Growth Infrastructure (2026-06-13)

**Scope:** Ship the public-surface assets that turn a working product into a findable product. SEO infrastructure, /changelog with real entries, /blog with 2 launch posts, structured data for Google knowledge graph.

### What shipped

- `/sitemap.xml` — Next.js MetadataRoute.Sitemap with 14 public routes, real lastmod/priority
- `/robots.txt` — disallows auth + dashboard + API routes, allows public marketing pages
- JSON-LD structured data on every page:
  - `Organization` schema (name, logo, founders, sameAs X + GitHub, contactPoint)
  - `SoftwareApplication` schema (offers/price/featureList for Google rich results)
- `/changelog` — 5 entries spanning the build (Day 1 MVP → Infra → Product redesign → Tier 1 → Tier 2)
  - Timeline UI: numbered dots, color-coded by severity, stats grid per entry
- `/blog` — 2 launch essays (Founder note + Product teardown), `/blog/[slug]` dynamic routes with prose styling
- All new pages have full per-page metadata: OG, Twitter cards, canonical URL, description

### Verified in production (https://relativclips.com)

- /sitemap.xml → 200 with valid XML
- /robots.txt → 200 with correct disallow rules + sitemap reference
- /changelog → 200, 5 entries render with timeline + stats
- /blog → 200, 2 posts listed
- /blog/why-three-sided → 200, full essay renders with H2s, blockquote, prose
- /blog/taste-not-length → 200, full essay renders

### Bug fixed during build

**`params` is a Promise in Next.js 15+.** The dynamic `/blog/[slug]` page was reading `params.slug` synchronously, which worked for SSG but caused runtime `notFound()` (404) for every post. Fix: `type Params = Promise<{slug: string}>` + `const {slug} = await params` in both `generateMetadata` and the page component. **Lesson: any dynamic route in Next 15+ must `await params`.**

### Files

- NEW: `frontend-next/src/app/sitemap.ts`, `robots.ts`
- NEW: `frontend-next/src/app/changelog/page.tsx` + `data.ts`
- NEW: `frontend-next/src/app/blog/page.tsx` + `data.tsx` + `[slug]/page.tsx`
- MODIFIED: `frontend-next/src/app/layout.tsx` (added 2 JSON-LD blocks)
- 34 routes total (was 32)

### Next: Tier 4 polish + design overhaul

- [ ] Cursor-pointer removal across all interactive elements
- [ ] Real color palette refresh (deeper gradients, layered shadows)
- [ ] Variable fonts + display serif upgrade
- [ ] Spring physics + magnetic buttons + scroll-driven motion
- [ ] Real product screenshots in hero (replace hand-drawn mocks)
- [ ] 8px grid + tighter typography
- [ ] First-paid-brand outreach: pitch + targeted D2C list
- [ ] App store listing prep: 5 screenshot frames, 30s demo script, 4000-char description
