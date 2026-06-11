# Hetzner Deploy Runbook — RelatiV API

> **Goal:** Get the RelatiV backend + bgutil + Postgres stack live on a
> fresh Hetzner CX31 (€9.85/mo, 4 vCPU / 8 GB RAM) in ~20 minutes, with
> YouTube anti-bot working on day 1.
>
> **Audience:** Deepraj (or anyone with the Hetzner account + an SSH key).
> Hermes runs the actual deploy once you hand over SSH access.

---

## Cost summary (the founder's question)

| Item | Cost/mo | Why |
|---|---|---|
| Hetzner CX31 | €9.85 (~$11) | 4 vCPU / 8 GB fits bgutil + Postgres + Whisper-base + headroom |
| Postgres (in-container) | €0 | Bundled in CX31; can move to managed later when you have >50 users |
| Caddy (in-container) | €0 | Auto-SSL for `api.relativ.app` |
| bgutil (in-container) | €0 | YouTube PO-token provider, Brainicism image |
| Domain (relativ.app) | ~$12/yr | One-time yearly cost |
| **Total** | **~$11/mo** | Cheapest viable production config |

**Why not cheaper?** CX21 (€4.85/mo, 4 GB) is technically enough but
gets tight when Whisper + Postgres + uvicorn are all loaded. €5/mo
savings isn't worth the risk of OOMs on day 1.

**Why not more expensive?** Render / Fly managed services cost 2-3×
more and lock you in. Stay on bare-metal Hetzner until you have
>50 concurrent users, then re-evaluate.

---

## Pre-flight (Deepraj does this, ~5 min)

1. **Buy a Hetzner CX31** in [Falkenstein (fsn1)](https://console.hetzner.cloud)
   - OS: Debian 13
   - SSH key: your existing public key (or generate a new one for this)
   - Volume: none (default 80 GB SSD is plenty)
2. **Buy a domain** (relativ.app) at Namecheap / Cloudflare / Porkbun
   - **Skip DNS for now** — you can deploy without a domain first and add it
     later (Caddy needs DNS to issue the Let's Encrypt cert, but the API
     works on the bare IP for initial smoke-testing)
3. **Create the ANTHROPIC_API_KEY** at [console.anthropic.com](https://console.anthropic.com)
   - Settings → API Keys → Create Key
   - Copy the `sk-ant-...` value (you'll paste it into the server's `.env`)
4. **Hand Hermes the SSH target:** `ssh root@<server-ip>` and either:
   - Paste the IP + confirm the SSH key path
   - Or generate a one-shot keypair: `ssh-keygen -t ed25519 -f ~/.ssh/relativ_hetzner`,
     paste `relativ_hetzner.pub` into Hetzner, and hand Hermes the
     `relativ_hetzner` private key path (he'll use it just for this deploy)

---

## Deploy (Hermes does this, ~15 min once SSH works)

### Step 1 — Initial server setup
```bash
ssh root@<server-ip>

# Base packages
apt update && apt -y upgrade
apt -y install docker.io docker-compose-plugin git ufw curl jq

# Firewall
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP (Caddy → 443)
ufw allow 443/tcp     # HTTPS
ufw enable
systemctl enable --now docker

# Verify
docker --version
docker compose version
```

### Step 2 — Clone the repo
```bash
git clone https://github.com/<your-org>/RelatiV.git /app/RelatiV
cd /app/RelatiV
git checkout wip/pipeline-v2   # the branch with bgutil + lock + E2E proof
git log --oneline -5           # confirm we see commit 4ca20b8
```

### Step 3 — Create `.env` (NEVER commit this)
```bash
cp .env.example .env
nano .env   # fill in these critical values:
```

**Minimum `.env` for day 1:**
```bash
APP_ENV=production
LOG_LEVEL=INFO
PUBLIC_URL=https://api.relativ.app

DATABASE_URL=postgresql+asyncpg://relativ_admin:relativ_secure_pass@db:5432/relativ_db

CORS_ORIGINS=https://relativ.app,https://www.relativ.app,http://localhost:3000

# YouTube PO-token provider (Docker service name resolves automatically)
BGUTIL_POT_BASE_URL=http://bgutil:4416

# SOCKS5 proxy — LEAVE EMPTY for Hetzner fresh IP. Set later if Hetzner IP gets flagged.
YT_PROXY=

# REQUIRED — paste your sk-ant-... key
ANTHROPIC_API_KEY=sk-ant-...

# Claude model — haiku is fast + cheap, good for v1
CLAUDE_MODEL=claude-haiku-4-5-20251001

# Transcription: auto = use RunPod if key set, else local CPU faster-whisper
TRANSCRIPTION_PROVIDER=auto
# (leave RUNPOD_API_KEY empty for v1 — use local faster-whisper)

# CPU whisper
WHISPER_BACKEND=local
WHISPER_MODEL=base
WHISPER_DEVICE=cpu
```

```bash
chmod 600 .env
```

### Step 4 — Bring up the stack
```bash
cd /app/RelatiV
docker compose up -d --build
# This takes 5-8 min the first time (Docker build of the backend image)

# Watch the logs
docker compose logs -f backend
# Wait for: "Uvicorn running on http://0.0.0.0:9000"
# Ctrl-C to detach
```

### Step 5 — Verify the stack is healthy
```bash
# All 4 services should be Up
docker compose ps

# Backend health
curl -fsS http://localhost:9000/health
# Expected: {"status":"ok",...}

# bgutil health
curl -fsS http://localhost:4416/ping
# Expected: {"version":"1.3.1",...}

# Run the full 12-check verification
cd /app/RelatiV
./scripts/verify-deploy.sh http://localhost:9000 http://localhost:3000
# Expected: "All 12 checks passed. ✓ Deploy looks good."
```

### Step 6 — YouTube anti-bot smoke test (the real test)
```bash
cd /app/RelatiV
source backend/.venv/bin/activate
BGUTIL_POT_BASE_URL=http://localhost:4416 python -m backend.scripts.probe_youtube_antibot
# Expected: "[probe] PASS: fetched 'Me at the zoo' in NNNNms"
```

**If probe PASSES → ship. Move to Step 7.**
**If probe FAILS** → see "If YouTube is blocked" section below before continuing.

### Step 7 — Full E2E test on a real video
```bash
# Pick any non-flagged YouTube video. Rick Astley is the classic test.
curl -X POST http://localhost:9000/api/v1/clip/from-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","max_clips":3}'

# Response includes task_id. Poll for completion:
curl http://localhost:9000/api/v1/tasks/<task_id>

# When status="done", clips are in /app/outputs/
ls -lah /app/outputs/
# Expected: 3 .mp4 files (~50-500KB each), viral_title set, caption set
```

### Step 8 — Point DNS (if you bought a domain)
1. In your DNS provider, add:
   - `A api.relativ.app → <server-ip>` (the Hetzner IP)
2. Wait 5-10 min for DNS to propagate
3. Caddy will auto-issue a Let's Encrypt cert on the next request:
   ```bash
   curl -fsS https://api.relativ.app/health
   # Expected: {"status":"ok",...}
   ```
4. (Frontend on Vercel: set `NEXT_PUBLIC_API_URL=https://api.relativ.app` in Vercel env)

### Step 9 — Cost guardrails (so a runaway doesn't bankrupt you)
```bash
# Anthropic: set a hard cap at $50/mo
# → https://console.anthropic.com → Settings → Limits → Monthly spend cap

# Hetzner: set a billing alert at €20/mo
# → https://console.hetzner.cloud → Billing → Usage alerts

# Watch disk (logs + outputs grow)
df -h /  # should stay below 50% (CX31 has 80GB)
```

---

## Day 1 monitoring (free, set up in 10 min)

1. **UptimeRobot** on `https://api.relativ.app/health` — 5-min checks, free tier
   - Alerts you on Telegram/email if the API goes down
2. **Watch the logs** for the first 24h:
   ```bash
   cd /app/RelatiV
   docker compose logs -f backend | grep -E "error|ERROR|exception"
   ```
3. **Cost dashboard:**
   - Anthropic: https://console.anthropic.com → Usage
   - Hetzner: https://console.hetzner.cloud → Billing

---

## If YouTube is blocked (the contingency)

If `probe_youtube_antibot` fails with "Sign in to confirm you're not a bot",
Hetzner's IP range is on YouTube's flagged list. This is rare but possible.
**Do not panic.** The fix ladder is:

### Level 1: Verify bgutil is actually being called
```bash
# Check the bgutil container is logging
docker logs bgutil 2>&1 | grep -i innertube
# Expected: "generating visitor data via Innertube"

# Confirm backend has BGUTIL_POT_BASE_URL set
docker exec backend env | grep BGUTIL
# Expected: BGUTIL_POT_BASE_URL=http://bgutil:4416
```

### Level 2: Wait 24-48h for IP reputation to recover
Hetzner rotates IPs frequently. If you can wait, delete the server and
re-create — the new IP is often clean.

### Level 3: Add a SOCKS5 residential proxy
**This is the only step that needs your decision.** Set in `.env`:
```bash
YT_PROXY=socks5://user:pass@residential-ip:1080
```
Then `docker compose restart backend` to pick up the new env. Cost depends
on the proxy provider:
- **Free option:** tunnel from a home machine (`ssh -D 1080 user@home-ip`),
  ~$0/mo, but requires a home machine you control
- **Webshare residential paid:** $2.99/GB, ~$10-30/mo for our volume
- **Bright Data ISP pool:** $8/GB, ~$30-60/mo, highest quality

### Level 4: Multi-region pool
If YouTube consistently flags Hetzner IPs, deploy 2-3 workers in different
datacenters (Hetzner fs+nb, Vultr LON, OVH GRA) with our orchestrator
doing round-robin. ~$30/mo total, fully owned, no third party.

**Our principle (founder's directive):** own the infrastructure where
possible, only pay vendors when we have to.

---

## Rollback (if Day 1 goes badly)

```bash
ssh root@<server-ip>
cd /app/RelatiV

# Stop the stack
docker compose down

# Roll back to the previous known-good commit
git fetch
git checkout <previous-tag-or-commit>
docker compose up -d --build

# Verify
./scripts/verify-deploy.sh
```

Previous known-good: `4ca20b8` (Day 2 E2E green), `2aa83b3` (pipeline v2 base).

---

## What this runbook does NOT do (deliberately, for later)

- **Auto-scaling** — single CX31 handles 10-20 concurrent pipeline runs;
  revisit when you have >50 paying users
- **Multi-region** — see Level 4 above; not needed for v1
- **Monitoring beyond uptime** — UptimeRobot + docker logs are enough for
  first 100 users; add Prometheus + Grafana when you need to see metrics
- **CDN for outputs** — clips are small enough that Vercel's edge cache
  handles them; revisit when render time > 10s
- **Auth (Clerk/Auth0)** — single-user / demo mode for v1; add when you
  have paying users

These are Day 3+ concerns. Ship the MVP first.
