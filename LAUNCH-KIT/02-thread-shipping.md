# Thread 1: "What we shipped in 7 hours" (X / Twitter, 8 posts)

> **For X / Twitter. Single thread. 8 posts. Each ≤280 chars. The kind of thread that gets bookmarked by infra / founder types.**

---

**Post 1 (hook):**
Three days ago I started building a YouTube → short-form clipping engine in India with a €9.85/month VPS and a CTO.

Today it's live.

Here's what 7 hours of deploy work actually looks like. 🧵

---

**Post 2 (the moment):**
Day 1: pipeline works on a Rick Astley video. Three real MP4 files on disk. I felt something.

Then I tried a real creator's video. 502 Bad Gateway. ModuleNotFoundError. Three deploy bugs in 5 minutes.

You don't ship without hitting these.

---

**Post 3 (the technical meat):**
The YouTube anti-bot war in 2026 has three layers:
1. PO tokens (protocol)
2. JS challenges (browser proof)
3. IP reputation (operational)

We solved 1+2. The 3rd requires money or traction. So we parked it.

---

**Post 4 (the architecture):**
Stack that actually works:
- bgutil (PO token provider) on port 4416
- yt-dlp 2026.06 with --js-runtimes deno
- threading.Lock to serialize fetches
- --sleep-interval 5/15 to look human
- Docker compose with healthcheck

All open source. Self-hostable in 5 minutes.

---

**Post 5 (the deploy bugs):**
5 deploy bugs we hit:
- `COPY . .` flattened the Python package
- `yt-dlp` not in requirements.txt
- No JS runtime in image
- bgutil healthcheck used `wget` (Node image has no wget)
- Hardcoded password placeholder in compose

Every one was a 30-min debug. None were in the README.

---

**Post 6 (the cost):**
Total stack runs on a Hetzner CX31:
- 4 vCPU
- 8 GB RAM
- 80 GB SSD
- €9.85 / month

That's it. No managed services. No vendor lock-in. Self-hostable.

If you can't run it on a single VPS, you can't run it anywhere.

---

**Post 7 (the principle):**
Founder principle from day 1: own the infra, don't depend on third parties.

We didn't sign up for any paid proxy service. We didn't take free tiers that expire. We didn't add vendor lock-in.

That means some things take longer. Some things break. But we never get rate-limited by someone else's pricing change.

---

**Post 8 (the ask):**
Live demo: `https://91.98.144.72:3000`
GitHub: `<link>`

If you're:
- A creator tired of AI slop → try the demo
- An infra engineer who's solved YT IP block → my DMs are open
- An investor backing "infrastructure of authenticity" → let's talk

Day 1 of building in public. 🛠️
