# Thread 3: "Why founder-led infra decisions matter" (X / Twitter, 7 posts)

> **For X / Twitter / LinkedIn. Founder philosophy thread. 7 posts. Targets founders, indie hackers, infra-curious people.**

---

**Post 1 (hook):**
I'm 3 days into building RelatiV and I've made every infra decision myself.

No "let the team decide" hand-waves. No "we'll figure out scale later." Every line of docker-compose, every deploy script, every rate-limit setting — I made the call.

Here's why that matters. 🧵

---

**Post 2 (the cost of "we'll figure it out later"):**
Most startups treat infra as a tax.

"We'll use a managed database, it scales."
"We'll pay for the proxy service, it's cheap."
"We'll add auth later, we need to ship."

Every one of these is a future tax. The cheaper you go now, the more expensive it is to undo later.

---

**Post 3 (the founder principle):**
My principle from day 1: **own the infra, don't depend on third parties.**

RelatiV runs on:
- One Hetzner VPS
- One Postgres container
- One bgutil sidecar
- One Caddy reverse proxy

No managed services. No vendor lock-in. €9.85/month total.

---

**Post 4 (the trade-offs):**
This principle is NOT free. It costs:
- More time on deploy (8 hours yesterday on 5 bugs)
- Some features that "just work" elsewhere (auth, queues, monitoring)
- The 1 layer I can't solve yet (YouTube IP block)

But it gives me:
- Predictable costs
- No rate-limit surprises
- Full understanding of every byte
- Self-hostable in 5 minutes
- A demo that works on my laptop, in CI, and in production identically

---

**Post 5 (when to break the rule):**
There are exactly 3 reasons to break "own the infra":

1. **Time** — if you're spending 100% of your time on infra instead of product
2. **Compliance** — if your industry requires SOC2 / HIPAA / etc.
3. **Scale** — if you have actual revenue to pay for it

We're at 0/3. So we own it.

---

**Post 6 (the anti-pattern):**
The startup anti-pattern I see most:

"We use a managed DB. We use a managed queue. We use a managed cache. We use a managed auth service. We use a managed proxy service."

Then one day the managed services cost more than your revenue. And you can't move because each one is a 3-month migration.

Own what you can. Outsource what you must. But know the difference.

---

**Post 7 (the ask):**
If you're building infra in public and want a founder who ships:
- I'm @deepraj on X
- RelatiV is at `https://91.98.144.72:3000`
- I'm hiring my first infra engineer / co-founder

Reply with your worst deploy story. Best one gets a thank-you in the next post. 🛠️
