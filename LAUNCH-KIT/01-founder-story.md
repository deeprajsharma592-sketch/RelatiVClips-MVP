# Why I'm building RelatiV in public (and shipping today)

> **For your first LinkedIn post. ~600 words. Founder voice. Honest, specific, not salesy.**

---

I started building **RelatiV** three days ago in a small room in India with a CTO, a €9.85/month Hetzner VPS, and a very clear thesis:

**AI is going to flood the internet with slop. The counter-move is infrastructure for creators who care about real.**

The thesis is not original. A lot of people have said this. What I'm trying to do is ship a working version of it before everyone else figures out they should.

---

## What RelatiV does

You paste a YouTube URL. The engine does nine things:

1. Pulls the audio (with the PO-token gymnastics YouTube now requires)
2. Transcribes it with **faster-whisper** on CPU
3. Finds the audio energy peaks with **librosa**
4. Detects the actual *hook moments* — not just the loudest ones
5. Sends the candidates to **Claude Haiku 4.5** for hook scoring
6. Picks the top three to five moments
7. Re-frames them 9:16 with **YOLO** face tracking
8. Renders with **ffmpeg**
9. Writes the caption, the title, and the hashtags

You get three short-form clips in 60 seconds. No editor. No upload. No export queue.

---

## What I've learned shipping it

**Day 1:** Got the pipeline working locally on a Rick Astley video. Three real MP4 files on disk. Felt great.

**Day 2:** Spent eight hours debugging a `ModuleNotFoundError: No module named 'backend'` that turned out to be a Docker `WORKDIR` mismatch. Fixed five deploy bugs in one night:
- `COPY . .` was flattening the Python package
- `yt-dlp` wasn't in `requirements.txt` so the binary was missing
- No JS runtime in the image, so yt-dlp couldn't solve YouTube's 2025+ challenges
- The `bgutil` healthcheck used `wget` which isn't in the Node image
- The compose file had a hardcoded password placeholder that didn't match `.env`

Every one of these was a 30-minute debug session. None were in the README. All were avoidable. This is why "build in public" matters.

**Day 3 (today):** Shipped. Live. `https://91.98.144.72:9000/health` returns green. The full pipeline works on real YouTube URLs.

---

## The one thing I can't solve yet

**YouTube's IP reputation layer.** My Hetzner Falkenstein IP is on a flagged list. The PO-token system works. The JavaScript challenges solve. But the IP itself is rejected at the TCP layer. This is the actual frontier of "scraping at scale" in 2026 — not a coding problem, an operations problem.

I'm parking it. I'll come back to it when I have either money (for residential proxies) or traction (to negotiate with a partner). Founder principle from day one: **own the infra, don't depend on third parties.** The Hetzner box proves that's possible for 90% of what we do.

---

## What's true about RelatiV

- ✅ Full pipeline works end-to-end on real YouTube URLs
- ✅ 9-stage orchestrator with 131 backend tests passing
- ✅ Frontend on a Hetzner VPS, dark theme, fuchsia primary
- ✅ Three transparent pricing tiers — Starter free, Pro $19, Teams $99
- ✅ Engine stack is open-source, self-hostable, no vendor lock-in
- ❌ No users yet (this post is step 1 of changing that)
- ❌ YouTube scraping blocked at IP layer (working on it)

---

## Why I'm telling you this

Because **the AI slop wave is real and the counter-wave is forming**. MrBeast just launched a creator-tools incubator. Casey Neistat is back to long-form on YouTube. TikTok is starting to deprioritize AI-flagged content. The signal is there.

If you're a creator tired of the same Opus Clip slop, the link is in the comments.
If you're a backend engineer who's solved the YouTube IP block, my DMs are open.
If you're an investor who backs "infrastructure of authenticity," let's talk.

— Deepraj
Founder, RelatiV

**Live demo:** `https://91.98.144.72:3000`
**GitHub:** `<github-link>`
**Stack:** Claude Haiku 4.5 · faster-whisper · YOLO v8 · ffmpeg · Deno · Docker · Hetzner

---

*RelatiV is a privacy-first short-form engine. Open source where it can be. Self-hostable always.*
