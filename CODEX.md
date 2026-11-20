# CODEX.md — RelatiVClips MVP 3-Day Autonomous Execution Guide

This document is the master instruction guide for OpenAI Codex / AI coding agents working on **RelatiVClips-MVP**.

---

## 1. Project Context & Rules
- **Repository:** `deeprajsharma592-sketch/RelatiVClips-MVP`
- **Default branch:** `main` (always commit to `main`)
- **Live Production URL:** `https://relativclips.com` (Vercel automatically deploys on every push to `main` within ~2 minutes)
- **Active Backend Tunnel:** Running on Ubuntu server, tunneled through Cloudflare (`BACKEND_BASE_URL` in `frontend-next/.env.local`).

### Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Framer Motion, Lucide Icons (`frontend-next/`)
- **Backend:** FastAPI, Python 3.12, SQLAlchemy, Asyncpg, Faster-Whisper, FFmpeg, Ultralytics YOLO (`backend/`)
- **Database & Auth:** Supabase PostgreSQL & Supabase Auth (`https://avyfsbbzdahfbcdhzoxv.supabase.co`)
- **Edge Proxy:** Next.js proxy at `frontend-next/src/app/api/proxy/[...path]/route.ts` forwards all `/api/v1/*` requests to the active `BACKEND_BASE_URL`.

---

## 2. 3-Day Sprint Overview

```
+---------------------------------------------------------------------------------------------------------+
| DAY 1: Dashboard UI Overhaul + Content Archetype Templates                                               |
| DAY 2: Onboarding Wizard + Social Accounts Linking (YouTube, TikTok, Instagram)                        |
| DAY 3: "Analyse" Performance Analytics Engine + Cross-Platform 1-Click Publisher / Scheduler Modal       |
+---------------------------------------------------------------------------------------------------------+
```

---

## 3. Day 1: Studio Dashboard & Archetype Templates

### Task 1.1: Build `frontend-next/src/components/dashboard/StudioLayout.tsx`
- Replicate the reference design from OpusClip (`media_1795109620823_ff4b0b63.jpg`).
- Left Dark Sidebar navigation:
  - **User & Tier Profile Header:** Avatar, display name, "Free" plan badge, "Invite members 👑".
  - **CREATE Section:**
    - `Home` (`/dashboard`)
    - `My projects` (`/dashboard?tab=projects`)
    - `Brand kit 👑` (`/dashboard?tab=brand-kit`)
    - `Asset library` (`/dashboard?tab=assets`)
  - **POST Section:**
    - `Analyse` (`/dashboard?tab=analyse`)
    - `Social accounts` (`/dashboard?tab=socials`)
    - `Calendar` (`/dashboard?tab=calendar`)
  - **Footer:**
    - Credits remaining counter (`⚡ 2 credits`), "Upgrade plan" button.
- Top Sticky Header:
  - Banner: *"👑 Unlock watermark-free exports and make your content look pro. Upgrade plan"*
  - Right: Notifications bell, Credit balance pill, "Add credits" button.

### Task 1.2: Refactor `frontend-next/src/components/dashboard/StudioHero.tsx`
- Intake Hero Card:
  - Dual Tabs: `[Clip long video]` (default active) and `[Auto-edit footage]`.
  - Input field: `"Drop a YouTube link"` with `"Get clips in 1 click"` primary button.
  - Secondary intake buttons: `[Upload video]`, `[Google Drive]`, `[Try a sample project]`.
- Recipe / Archetype Skill Pills:
  - `[🎙️ Podcast & Interviews]`
  - `[🎮 Clip Gaming Streams]`
  - `[⚡ Streamer Reactions]`
  - `[💡 Educational / Talking Head]`
  - `[🎬 Auto-edit Footage]`
  - `[✨ Captions & Subtitles]`
  - Clicking a pill passes the `template` parameter to the intake state.
- "Start from a demo project" Carousel:
  - 3 pre-built interactive cards:
    - *Danny Duncan 24h stream* (Streamer template)
    - *Steph Curry 12 Threes Drills* (Gaming/Action template)
    - *Lex Fridman #408 with Tal Wilkenfeld* (Podcast template)
  - Clicking "Try it" loads the demo project immediately with pre-rendered clips.

### Task 1.3: Update Backend Archetypes (`backend/pipeline/archetype.py`)
- Support explicit template overrides: `podcast`, `streamer`, `gaming`, `educational`.
- Adjust energy thresholds and hook criteria per template:
  - `streamer`: `STEEP_MIN_RELATIVE_RISE = 0.4`, prioritize facecam reactions and high volume peaks.
  - `podcast`: Prioritize turn-taking dialogue and silence-bounded complete statements.
  - `gaming`: Prioritize rapid audio spikes and clutch elimination moments.
  - `educational`: Prioritize instructional keywords ("how to", "step", "reason", "because").

---

## 4. Day 2: Onboarding Flow & Social Accounts Linking

### Task 2.1: Revamp Onboarding (`frontend-next/src/app/(auth)/onboarding/page.tsx`)
- 3-step progressive onboarding wizard:
  - **Step 1: Content Archetype:** Choose primary content style (Podcaster, Streamer, Gamer, Educator).
  - **Step 2: Styling & Subtitles:** Choose default caption styling (MrBeast bold, Minimalist sans, Cyberpunk neon, Word-by-word karaoke) and aspect ratio (`9:16` vertical, `1:1` square).
  - **Step 3: Instant First Video:** Option to paste a first YouTube link or link a social account to unlock bonus credits.

### Task 2.2: Build `frontend-next/src/components/dashboard/SocialAccountsView.tsx`
- View displayed when `/dashboard?tab=socials` is active.
- Support 3 major platforms:
  - **YouTube Shorts:** Channel connection button, subscribers counter, avatar.
  - **TikTok:** TikTok account connection, followers counter.
  - **Instagram Reels:** Instagram Professional/Creator account connection.
- Action: "Connect Account" opens the OAuth modal or connects credentials. Shows disconnect option for connected accounts.

### Task 2.3: Backend Socials Router (`backend/routers/socials_router.py`)
- Add FastAPI endpoints:
  - `GET /api/v1/socials/accounts`: List connected accounts for user.
  - `POST /api/v1/socials/accounts/connect`: Save OAuth token or mock profile connection.
  - `DELETE /api/v1/socials/accounts/{account_id}`: Remove connected account.
- Add SQLAlchemy model in `backend/database/models.py`:
  - `SocialAccountModel`: `id`, `user_id`, `platform` (youtube/tiktok/instagram), `account_handle`, `account_name`, `avatar_url`, `access_token`, `refresh_token`, `expires_at`, `created_at`.

---

## 5. Day 3: "Analyse" Engine & Cross-Platform Publisher

### Task 3.1: Build `frontend-next/src/components/dashboard/AnalyseView.tsx`
- View displayed when `/dashboard?tab=analyse` is active.
- Key Metrics Dashboard:
  - **Total Views Tracked:** Aggregated view count across all posted clips.
  - **Audience Reach:** Estimated unique viewers reached.
  - **Average Engagement Rate:** Likes, comments, shares ratio.
  - **Top Performing Format:** Identifies whether 15s, 30s, or 60s clips perform best.
- Visual Charts:
  - Platform comparison bar chart (TikTok vs Shorts vs Reels).
  - 7-day view growth velocity graph.
- Clip Performance Table:
  - Thumbnail, title, viral score, date published, platform badges, total views.

### Task 3.2: Build `frontend-next/src/components/dashboard/CrossPlatformPublishModal.tsx`
- Multi-platform publisher modal launched from any clip card:
  - Left: 9:16 vertical video player with subtitle playback.
  - Right:
    - Platform selector checkboxes: `[x] YouTube Shorts`, `[x] TikTok`, `[x] Instagram Reels`.
    - Universal caption & hashtag editor with "Generate AI Hashtags" button.
    - Timing options: "Post immediately" vs "Schedule for best time".
    - Primary CTA: **"Publish to 3 Platforms"**.

### Task 3.3: Backend Publish Router & Schema
- In `backend/routers/socials_router.py`:
  - `POST /api/v1/socials/publish`: Receives `clip_id`, `platforms`, `caption`, `scheduled_at`.
  - Records publication in `ClipPublicationModel`.

---

## 6. Verification & Quality Commands

```bash
# Frontend build check
cd frontend-next && npm run build

# Backend unit tests
python3 -m pytest backend/tests/test_offline_orchestrator.py
python3 -m pytest backend/tests/test_archetype.py

# Live API Health Checks
curl -s http://localhost:9000/health
curl -s http://localhost:9000/api/v1/debug-db
```
