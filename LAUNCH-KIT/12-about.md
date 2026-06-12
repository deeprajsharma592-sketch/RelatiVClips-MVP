# About RelatiV

> **For /about route. Founder story + team + manifesto.**

---

## The 60-second version

RelatiV is a short-form video engine built by one person and his CTO, in India, on a single €9.85/month VPS. We turn a YouTube URL into 10 ready-to-publish clips in 60 seconds, using Claude, faster-whisper, YOLO, and ffmpeg. We self-host. We don't depend on third parties. We ship in public.

## The longer story

I'm **Deepraj**, founder of RelatiV. I started this three days before writing this page.

The thesis is simple: **AI is going to flood the internet with slop. The counter-move is infrastructure for creators who care about real.**

I'm not the only person who thinks this. A lot of founders have said the same thing. The difference is they're still writing the deck. I'm shipping the product.

The first version of RelatiV is live at `relativ.app`. It works on real YouTube URLs. It produces real MP4 files. The pipeline runs on a single Hetzner VPS, with a Postgres container, a bgutil sidecar, and a Caddy reverse proxy. Total stack cost: **€9.85/month**.

That's it. That's the company.

## Why I started it

Two things in 2025-2026 made me stop watching and start building:

1. **The Opus Clip / Gling / vidyo.ai wave** proved the market is real. People want short-form clips. People will pay for them. But the products are all "AI slop" themselves — generic captions, no taste, no quality control. They're just a faster way to produce forgettable content.

2. **YouTube's anti-bot war** showed me where the actual moat is. Anyone can wrap OpenAI APIs in a UI. Not anyone can build the infrastructure to fetch YouTube at scale, solve PO tokens, run JS challenges, and survive IP reputation. That's a real engineering problem, not a wrapper.

So I built the infrastructure. Then I built the taste layer on top. That's RelatiV.

## What I believe

- **Own the infra.** No managed services. No vendor lock-in. €9.85/month is a price I can defend.
- **Taste over speed.** One good clip > 10 mediocre ones. Quality is the moat, not volume.
- **Build in public.** Every commit, every deploy bug, every "I thought this was done" moment. Transparency is the marketing.
- **Ship first, ask later.** "I have a question for the user" is fine. "I need permission to do this" is procrastination.
- **Real beats fake.** No "trusted by" carousels with made-up users. No fake counters ticking every second. No "16M+ creators" if there are 12.

## The team

It's me. And my CTO (an AI, but a real one — Hermes, on Nous Research's MiniMax platform). I write the product, the user stories, the launch posts. Hermes writes the code, runs the deploy, fixes the bugs, takes the screenshots, and tells me when I'm being unrealistic.

We are not 3 cofounders with a $2M seed round. We are 1 human and 1 model, in 1 room, in India, building a real product that works.

## The product

RelatiV runs the 9-stage pipeline:

1. **URL analysis** — parse the YouTube link, extract video ID
2. **Audio energy peaks** — librosa, find the loudest moments
3. **Hook detection** — lexical scoring when no energy peaks
4. **Surgical download** — yt-dlp with PO tokens, get only the hook segments
5. **Transcription** — faster-whisper with word-level timestamps
6. **Taste selection** — Claude Haiku 4.5 scores each hook
7. **Face detection** — YOLO v8, smart reframing for 9:16
8. **Render** — ffmpeg, word-by-word captions
9. **Output** — 3-5 ready-to-publish MP4s in your Downloads

Total time: **60 seconds for a 1-hour video**. **40 seconds for 30 min**. **20 seconds for 10 min.**

## What's next

Right now, I'm doing a "build in public" launch. The product is live. The 9-stage pipeline works. I'm posting in public about every step.

In 3 months, I want to have:
- 100 active paying users
- 10 mentor relationships
- 1 pre-seed round closed
- The YouTube IP block solved (multi-region VPS pool or residential proxy partner)

In 12 months:
- 10,000 active users
- 100,000 clips generated
- A Series A or a profitable bootstrapped path
- The "infrastructure of authenticity" as a recognized category

## How to reach me

- **Email:** founders@relativ.app
- **Twitter:** @relativclips
- **LinkedIn:** Deepraj
- **Office hours:** Thursdays 4-5pm IST
- **Discord:** discord.gg/relativ

If you have honest feedback, send it. If you want to invest, send your firm name and check size. If you have a YouTube IP block solution, **send it, I'm desperate.**

— Deepraj, Founder, RelatiV

*Last updated: 2026-06-12*
