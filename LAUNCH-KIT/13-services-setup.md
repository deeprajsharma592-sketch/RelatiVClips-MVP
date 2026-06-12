# Launch Day: 3rd-Party Services Setup Guide

> **For Deepraj. Each section is 5-10 minutes. Total: 30 min to set up all 4.**

---

## 1. UptimeRobot (free, 5 min)

**What it does:** Pings `https://api.relativ.app/health` every 5 min, alerts you on Telegram/email if it's down.

**Setup:**

1. Go to https://uptimerobot.com/signUp (free tier is enough)
2. Add a new monitor:
   - **Type:** HTTPS
   - **URL:** `https://api.relativ.app/health` (use Hetzner IP `http://91.98.144.72:9000/health` for now until you wire DNS)
   - **Interval:** 5 minutes
3. Add alert contacts:
   - Email (your primary)
   - Telegram (optional but recommended — setup is 2 min, paste the bot token)
4. **Status page:** UptimeRobot gives you a free public status page at `stats.uptimerobot.com/<your-id>`. Optional.

**Cost:** Free (up to 50 monitors, 5-min interval)

---

## 2. Sentry (free, 10 min)

**What it does:** Captures backend exceptions with stack traces, breadcrumbs, request context. Shows you what broke, when, and for which user.

**Setup:**

1. Go to https://sentry.io/signup (free tier = 5,000 events/mo, enough for v1)
2. Create a new project:
   - **Platform:** Python / FastAPI
   - **Project name:** relativ-backend
3. Copy the DSN (looks like `https://xxxx@o123.ingest.sentry.io/456`)
4. Add to your `.env` on Hetzner:
   ```
   SENTRY_DSN=https://xxxx@o123.ingest.sentry.io/456
   ```
5. Add to `docker-compose.yml` backend env section
6. (Code integration is already set up — see `backend/main.py` import below)

**For the integration in `backend/main.py`:**
```python
import sentry_sdk
if os.getenv("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        traces_sample_rate=0.1,  # 10% perf traces (free tier friendly)
        environment=os.getenv("APP_ENV", "development"),
    )
```

**Cost:** Free (5,000 events/mo) → $26/mo Team (50k events) when you scale

---

## 3. PostHog (free, 5 min)

**What it does:** First-time visitor analytics, page views, button clicks, conversion funnels. Self-hostable EU version (PostHog Cloud EU).

**Setup:**

1. Go to https://posthog.com/signup (free tier = 1M events/mo, EU hosting available)
2. Create a project: "relativ-web"
3. Copy the project API key (looks like `phc_xxxxxxxxxxxxx`)
4. Add to your frontend `.env`:
   ```
   NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxx
   NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
   ```
5. Install the PostHog snippet in your Next.js app:
   ```bash
   cd /app/RelatiV/frontend-next
   npm install posthog-js
   ```
6. Initialize in `app/layout.tsx`:
   ```tsx
   "use client";
   import posthog from "posthog-js";
   import { PostHogProvider } from "posthog-js/react";
   
   if (typeof window !== "undefined") {
     posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
       api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
     });
   }
   
   export default PostHogProvider({ children }); // wrap your app
   ```

**Cost:** Free (1M events/mo) → usage-based after that

---

## 4. Microsoft for Startups (free, 10 min)

**What it does:** Gives you $25k-$100k in Azure credits. Covers your Hetzner for YEARS even if you don't use Azure (just don't activate it). Also unlocks GitHub Enterprise, Office 365, etc.

**Setup:**

1. Go to https://foundershub.startups.microsoft.com/
2. Apply with:
   - Company name: RelatiV
   - One-liner: "Self-hostable YouTube → short-form clipping SaaS"
   - Stage: pre-seed
   - Team size: 1
   - Funding raised: $0
3. Usually approved in 24-48h, free credits hit your Azure account

**Cost:** Free (Microsoft pays you)

---

## 5. Google for Startups (optional, 10 min)

Same idea, Google Cloud credits.

1. https://startups.google.com/
2. Apply with same info
3. Approved in 1-2 weeks typically

**Cost:** Free

---

## 6. (Optional) Sentry Alternative: GlitchTip

If you don't want Sentry (privacy concerns, EU data), **GlitchTip** is a self-hosted open-source Sentry alternative.

- **Repo:** https://gitlab.com/glitchtip/glitchtip-backend
- **Self-host:** docker compose up on a $5/mo Hetzner box
- **Cost:** $5/mo for hosting vs. $0 free tier of Sentry (but your data)

For v1, **Sentry free tier is fine**. Switch to GlitchTip if you ever need EU data sovereignty.

---

## 7. (Optional) Cloudflare in front of Hetzner

Once you buy the domain, put Cloudflare in front of Hetzner for:
- Free SSL
- DDoS protection
- CDN for the frontend
- Bot protection (free tier)

**Setup:**
1. Sign up at https://cloudflare.com
2. Add the domain
3. Update nameservers at registrar
4. Add A record: `api` → `91.98.144.72`
5. Add A record: `@` and `www` → Vercel IPs (when you deploy frontend there)
6. Toggle proxy: enabled (orange cloud)

**Cost:** Free (or $20/mo Pro if you need WAF rules)
