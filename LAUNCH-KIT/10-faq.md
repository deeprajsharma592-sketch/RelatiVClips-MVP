# FAQ — RelatiV

> **For the /faq page. Use this copy on the frontend.**

---

## General

### What is RelatiV?
RelatiV is a short-form video engine. Paste a YouTube URL, get 10 ready-to-publish clips in 60 seconds. We use Claude for hook scoring, faster-whisper for transcription, YOLO for face tracking, and ffmpeg for rendering.

### Who is RelatiV for?
- **Creators** who post on TikTok, Instagram Reels, and YouTube Shorts
- **Brands** who need paid-media variations of one hero video
- **Agencies** managing multiple creator accounts
- **Coaches and educators** turning long lessons into short reels
- **Podcasters** who want clip-and-go episodes

### How is this different from Opus Clip / Gling / vidyo.ai?
Three things:
1. **Taste-based selection, not just keyword spotting.** Our hook scoring uses Claude, not just energy peaks.
2. **Self-hostable.** If you don't trust our cloud, run it on your own VPS.
3. **No revenue share.** Other tools take 20-30% of your creator revenue. We don't.

### How long does it take?
60 seconds for a 1-hour video. We transcribe, score, render, and caption in parallel.

### Do I need to upload my video?
No. RelatiV works from a YouTube URL. You can also upload a local file (Pro+ feature).

### What aspect ratios do you support?
9:16 (Reels, Shorts, TikTok), 1:1 (Instagram feed), 16:9 (YouTube). Pro tier unlocks all.

### Do you add a watermark?
Starter tier: yes, small corner watermark. Pro and Teams: no watermark.

---

## Technical

### What AI models do you use?
- **Claude Haiku 4.5** for hook calibration
- **faster-whisper** (CPU int8) for transcription
- **YOLO v8** for active speaker detection
- **librosa** for audio energy peaks
- **OpenCV** for visual analysis

### Can I bring my own Anthropic key?
Yes, on Pro and Teams plans. Drop your `ANTHROPIC_API_KEY` into the env and RelatiV uses it directly.

### Can I self-host?
Yes. The full engine is open source (MIT). See our [self-host guide] for `docker compose up -d` on a Hetzner CX31.

### What happens to my videos after processing?
We delete them in 24 hours. Your videos, your data, your control. (Configurable on Pro+ for longer retention.)

### Do you have an API?
Teams tier includes a full REST API. See [docs.relativ.app/api] for endpoints.

### Is there a latency budget?
- 60-minute video → ~75 seconds total pipeline
- 30-minute video → ~40 seconds
- 10-minute video → ~20 seconds

(Bottleneck is currently Whisper transcription on CPU; RunPod GPU mode is on the roadmap.)

---

## Account & Billing

### How does the 7-day Pro trial work?
No credit card. Full Pro features. Email reminder 3 days before it ends.

### Can I cancel anytime?
Yes. One click in account settings. Pro-rated refund within 30 days.

### Do you offer student or non-profit discounts?
Yes, 50% off Pro with a `.edu` or non-profit verification. Email founders@relativ.app.

### What payment methods do you accept?
Stripe: Visa, Mastercard, Amex, Apple Pay, Google Pay. Crypto: not yet, on the roadmap.

### Where is my data stored?
EU (Hetzner Falkenstein). GDPR compliant. SOC2 on the roadmap.

---

## Privacy & Security

### Do you train on my videos?
No. Never. Not on the public release, not on the roadmap.

### Do you share my data with third parties?
Only the AI providers you've enabled (Claude, Whisper). You can self-host to remove all third-party calls.

### What if a YouTube video has a takedown notice?
We honor DMCA within 24 hours. Your account won't be affected if someone else's video is taken down — we just delete the cached version.

### How do I delete my account?
Settings → Delete account. All data (videos, clips, account info) is wiped within 7 days. Permanent within 30.

---

## Contact

### How do I reach a human?
- **Email:** founders@relativ.app (response within 24h, Mon-Fri IST)
- **Discord:** discord.gg/relativ (community + support)
- **Twitter:** @relativclips
- **Office hours:** Thursdays 4-5pm IST (live call with founder)

### Do you have a status page?
Yes, [status.relativ.app](https://status.relativ.app). Subscribe for incident updates.

### Where are you based?
RelatiV is a 1-person company based in India. We ship globally from day 1.
