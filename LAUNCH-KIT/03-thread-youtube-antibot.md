# Thread 2: "The YouTube anti-bot rabbit hole" (X / Twitter, 6 posts)

> **For X / Twitter. Technical thread. 6 posts. Targets infra / scraping / dev community.**

---

**Post 1 (hook):**
I spent 8 hours inside YouTube's 2025+ anti-bot stack so you don't have to.

Here's the actual architecture, with code, configs, and the 1 layer I couldn't solve. 🧵

---

**Post 2 (the 3 layers):**
YouTube's defense in 2026:

L1: PO tokens (Proof of Origin) — JavaScript-computed "I'm a real browser" proof
L2: JS challenges — runtime computation only a real browser can solve
L3: IP reputation — known datacenter / scraping IPs are blocked

Each layer independently can reject you.

---

**Post 3 (L1: PO tokens — SOLVED):**
The fix: `bgutil-ytdlp-pot-provider` runs locally on :4416.

The pip plugin auto-discovers, yt-dlp calls it per video, you get a fresh token.

This is what the open-source community standardized on in 2025.

---

**Post 4 (L2: JS challenges — SOLVED):**
YouTube serves a JS challenge. Client must solve it with a runtime.

yt-dlp 2025+ has an "EJS" external JS system. Default is Deno.

Image needs `deno` AND `node` AND `unzip` (Deno's installer needs it).

Without these, the player JS can't run, and you get "Sign in to confirm" even with a valid PO token.

---

**Post 5 (L3: IP reputation — UNSOLVED):**
This is where we are stuck.

Hetzner's Falkenstein IP is on a reputation list. Doesn't matter that:
- bgutil returns valid PO tokens
- Deno solves the JS challenge
- We're not scraping too fast

The TCP connection itself is rejected.

---

**Post 6 (the options):**
The fix ladder:

a) Recreate the box, get a different /24
b) SOCKS5 tunnel from a residential IP
c) Multi-region VPS pool (~$20/mo, owned)
d) Webshare / Bright Data ($5-30/mo, vendor)
e) Wait 24-48h for IP rotation

We're parked. Will resume when money or traction arrives.

Code + Docker compose + healthchecks for L1/L2 are open source. Link in next post.

---

**Tagged people to reach:**
- @Brainicism (bgutil maintainer)
- @ytdl_official (yt-dlp)
- @anthropaboratories (Claude, since we use Haiku)
- @fasterwhisper (our transcription)
