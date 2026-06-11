# RelatiV — Deployment Guide

> **Audience:** Deepraj (and anyone else shipping this). End-to-end production deploy for the 3-tier RelatiV stack.
> **Last updated:** Day 2 — wired up after Day 1 quality gate.

## TL;DR — 3 services, 1 hour

| Tier    | Platform | Cost/mo     | Setup time |
|---------|----------|-------------|------------|
| Frontend | **Vercel** (free tier)   | $0          | 5 min      |
| Backend  | **Hetzner CX31** or Fly.io | €14 / $25  | 30 min     |
| Database | **Render Postgres** or Hetzner-managed | $0–7 | 5 min  |

Total minimum spend: **$0–25/mo** for first 100 users.

---

## 0. Pre-flight checklist

Before you touch any platform, confirm:

- [ ] `wip/pipeline-v2` is merged to `main` (or you accept deploying from the branch)
- [ ] `.env.example` is up to date with the platform you chose
- [ ] You have accounts on: GitHub, Vercel, Render/Fly/Hetzner
- [ ] You have these secrets ready (set in platform dashboards, **never committed**):
  - `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com) (sk-ant-…)
  - `RUNPOD_API_KEY` — from [runpod.io/console](https://www.runpod.io/console) (only needed if `WHISPER_BACKEND=runpod`)
  - `DATABASE_URL` — auto-set by Render if you use their Postgres
  - `YOUTUBE_COOKIES_FILE` — exported from a logged-in YouTube session (optional but recommended)

---

## 1. Pick a backend host — decision matrix

| If you want… | Pick | Trade-off |
|---|---|---|
| Cheapest + full control (you manage Docker, Caddy, Postgres all on one box) | **Hetzner CX31** (€14/mo, 4 vCPU / 8 GB) | You patch + scale manually |
| Easiest deploy, auto-SSL, managed Postgres, free tier | **Render** (Blueprint, $0–7/mo first 90 days) | Most expensive at scale |
| Multi-region, cheapest always-on, easy CLI | **Fly.io** ($5–25/mo) | Steeper learning curve, no managed DB |

**Recommendation for now:** **Hetzner CX31 + docker-compose**. The stack is already dockerized, you can lift the whole `docker-compose.yml` to a VM in 10 min, and you avoid the 2x markup Render/Fly charge for managed services. Migrate to Render/Fly when concurrent users > 50.

---

## 2. Path A — Hetzner (recommended for now)

### 2.1 Provision the VPS

```bash
# From your local machine
hcloud server create --name relativ-prod --type cx31 --image debian-13 --ssh-key ~/.ssh/id_ed25519
# or via UI: https://console.hetzner.cloud → New Server → CX31 → Debian 13
```

### 2.2 Initial server setup

```bash
ssh root@<server-ip>
apt update && apt -y upgrade
apt -y install docker.io docker-compose-plugin git ufw
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP (Caddy → 443)
ufw allow 443/tcp     # HTTPS
ufw enable
systemctl enable --now docker
```

### 2.3 Clone + configure

```bash
git clone https://github.com/<your-org>/RelatiV.git /app/RelatiV
cd /app/RelatiV
cp .env.example .env
nano .env   # fill in ANTHROPIC_API_KEY, DATABASE_URL, etc.
```

### 2.4 Bring up the stack

```bash
docker compose up -d --build
docker compose logs -f backend   # wait for "Uvicorn running on http://0.0.0.0:9000"
```

### 2.5 Verify

```bash
curl http://localhost:9000/health
# Expected: {"status":"ok",...}

# Test Caddy HTTPS (after DNS points to the server)
curl https://api.relativ.app/health
```

### 2.6 DNS

Point an A record at the server IP:
- `api.relativ.app → <server-ip>` (backend via Caddy)
- `relativ.app → <vercel-cname>` (frontend)

Caddy auto-provisions Let's Encrypt certs once DNS resolves.

---

## 3. Path B — Render (easiest)

### 3.1 Push the repo to GitHub (if not already)

```bash
git remote add origin https://github.com/<your-org>/RelatiV.git
git push -u origin main
```

### 3.2 Connect Render

1. Go to [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints)
2. New Blueprint Instance → select your repo
3. Render reads `render.yaml` and provisions:
   - `relativ-backend` web service (Docker)
   - `relativ-postgres` database
   - 20 GB persistent disk mounted at `/data/outputs`

### 3.3 Set secrets

In the Render dashboard → `relativ-backend` → Environment:
- `ANTHROPIC_API_KEY` (sync: false)
- `RUNPOD_API_KEY` (only if using RunPod)
- `RUNPOD_WHISPER_URL` (only if using RunPod)

### 3.4 Verify

Wait for the first deploy to finish (~10 min, Docker build is slow on Render free tier), then:

```bash
curl https://relativ-backend.onrender.com/health
```

---

## 4. Path C — Fly.io (cheapest at scale)

### 4.1 Install flyctl

```bash
curl -L https://fly.io/install.sh | sh
fly auth signup    # or `fly auth login` if you have an account
```

### 4.2 Launch

```bash
cd /app/RelatiV
fly launch --no-deploy   # creates app, doesn't deploy yet
# Edit fly.toml to set app name + region
fly secrets set ANTHROPIC_API_KEY=*** DATABASE_URL=postgresql://...
fly volumes create relativ_outputs --size 20   # persistent volume
fly deploy
```

### 4.3 Verify

```bash
fly status
curl https://relativ-backend.fly.dev/health
```

---

## 5. Frontend — Vercel (all paths)

### 5.1 Connect Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your RelatiV repo
3. **Root directory:** `frontend-next`
4. Framework: Next.js (auto-detected)
5. **Environment variable:** `NEXT_PUBLIC_API_URL` = the backend public URL
   - Hetzner: `https://api.relativ.app`
   - Render: `https://relativ-backend.onrender.com`
   - Fly: `https://relativ-backend.fly.dev`
6. Deploy

### 5.2 Verify

Visit `https://relativ-<hash>.vercel.app` — the landing page should load and the "Try a demo" button should hit the backend successfully.

### 5.3 Custom domain

In Vercel → Settings → Domains → add `relativ.app`. Vercel auto-provisions the cert.

---

## 6. End-to-end smoke test

After all 3 tiers are up:

```bash
# 1. Health checks
curl https://relativ.app/                    # frontend loads
curl https://api.relativ.app/health          # backend healthy
curl https://api.relativ.app/api/v1/voices   # backend speaks

# 2. Full pipeline (YouTube URL)
curl -X POST https://api.relativ.app/api/v1/clip/from-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://youtu.be/dQw4w9WgXcQ","max_clips":3}'

# 3. Check the result came back
# - Should return 202 with a task_id
# - Poll /api/v1/tasks/<task_id> until status="done"
# - Download the rendered clip from outputs/
```

---

## 7. Post-deploy monitoring

### Quick wins (Day 2)

- [ ] UptimeRobot or BetterStack on `/health` (free tier, 5-min checks)
- [ ] Sentry in the FastAPI app for exception tracking
- [ ] Vercel Analytics (built-in, free) on the frontend
- [ ] Log tail: `fly logs` / `render logs` / `docker compose logs -f`

### Cost guardrails

- **Anthropic**: hard cap at $50/mo via console.anthropic.com → Settings → Limits
- **RunPod**: set a billing alert at $20/mo in runpod.io/console
- **Hetzner**: set a billing alert at €20/mo in console.hetzner.cloud → Billing

---

## 8. Rollback plan

| Tier | Rollback |
|---|---|
| Vercel | Dashboard → Deployments → click a previous green deploy → "Promote to Production" |
| Render | Auto-rollback on health-check failure (configured in `render.yaml`) |
| Fly.io | `fly releases rollback` |
| Hetzner | `cd /app/RelatiV && git checkout <previous-tag> && docker compose up -d --build` |

---

## 9. What's NOT in this guide (deliberately)

- **Custom auth** (Clerk, Auth0, Supabase Auth) — the current build is single-user / demo. Add when you have paying users.
- **S3 / R2 for outputs** — the persistent volume works up to ~500 GB. Move to object storage when you start hitting that.
- **CDN for rendered clips** — Vercel's edge cache will do this for free once the output URLs are stable. Revisit when render time > 10s.
- **Multi-region** — single-region (fra1 / falkenstein) is fine until you have users in 2+ continents. Don't pre-optimize.

These are Day 3+ concerns. Ship the MVP first.

---

## 10. YouTube anti-bot — bgutil infrastructure (added 2026-06-11)

The pipeline uses `yt-dlp` to fetch YouTube audio. As of 2025+, YouTube
binds PO (Proof of Origin) tokens to specific video IDs and applies IP
reputation checks. The old `player_client=web` static approach returns
"Sign in to confirm you're not a bot" on flagged IPs.

**The fix (free, 100% open-source):**

1. **`bgutil-ytdlp-pot-provider`** — a Docker image + pip plugin that
   negotiates a real per-video PO token via Botguard/Innertube.
2. **The `bgutil` container** runs locally on port 4416 and is wired
   into the backend's yt-dlp calls via the env var
   `BGUTIL_POT_BASE_URL`.
3. **Optional SOCKS5 residential proxy** — set `YT_PROXY=socks5://...`
   to tunnel through a residential IP if your server's IP is still
   flagged after bgutil is running. Cost: $0 if you have a home
   network machine to tunnel from.

### Hetzner deploy (recommended)

`docker-compose.yml` already has the `bgutil` service wired in. After
`docker compose up -d --build`, the backend container will be able to
reach bgutil on `http://bgutil:4416`. No extra config needed.

```bash
# Confirm both containers are up
docker ps --filter "name=bgutil"   # expect: Up X minutes
docker ps --filter "name=backend"  # expect: Up X minutes, healthy
```

### Bare-metal deploy (no Docker)

```bash
# Pull and run bgutil as a bare container alongside the systemd service
docker run -d --init --name bgutil-provider --restart unless-stopped \
  -p 4416:4416 brainicism/bgutil-ytdlp-pot-provider

# Add to backend's env
echo "BGUTIL_POT_BASE_URL=http://127.0.0.1:4416" >> /etc/relativ.env
systemctl restart relativ-backend
```

### If YouTube still blocks after bgutil

YouTube's IP reputation system is a separate signal from PO tokens.
If `curl https://api.relativ.app/api/v1/intake/counts` works but a
real `POST /process/youtube` still returns "Sign in to confirm":

1. Confirm bgutil is reachable: `curl http://127.0.0.1:4416/ping`
2. Confirm the plugin is discovered: run
   `cd /app/RelatiV/backend && .venv/bin/python -m pytest tests/test_youtube_bgutil.py`
   — all 7 should pass.
3. If they all pass but YouTube still blocks: your server IP is
   flagged. Add `YT_PROXY=socks5://...` to your env. See SOCKS5 setup
   notes in `OPERATIONS.md`.

### Background: why this is the right answer

- **bgutil** is the de-facto standard for the yt-dlp community in 2025+.
  Brainicism is the maintainer, and the project has 1k+ GitHub stars
  and active issues.
- **SOCKS5 to a residential IP** is the cleanest cloud-IP workaround.
  Commercial residential proxy pools cost $5–50/GB; a private tunnel
  back to your home network costs $0 and gets a clean reputation score.
- **PO tokens are per-video**, so a fresh container restart gives you
  a fresh slate — bgutil re-negotiates on every request.
