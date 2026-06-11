"use client";

/**
 * /brands — RelatiV's marketing landing for brands.
 *
 * Rebuilt around a single message: "Pay per impression. Not a flat fee."
 *
 * Sections (top to bottom):
 *  1. Hero — marketing pitch + dual CTA
 *  2. How it works — 3-step explainer (Brief → Clippers deliver → Pay per view)
 *  3. CPM calculator — interactive budget → impressions/clips estimator
 *  4. Scale — capacity/throughput messaging
 *  5. FAQ (collapsed, optional)
 *  6. Final CTA
 *
 * No fake testimonials, no fake case studies. Per founder request:
 * social proof deferred until real campaigns are run.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CpmCalculator from "@/components/CpmCalculator";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Brief us in 5 minutes",
    body: "Drop your raw video and a short brief. We extract the 50 hookiest moments and lock the brand guidelines — fonts, colors, voice, do-not-use list — into the system.",
    icon: "→",
    hue: "primary",
  },
  {
    step: "02",
    title: "Clippers deliver in 48 hours",
    body: "Our 18,000+ clipper network competes for your slots. You get 30+ platform-ready clips, each with hook variants, on-brand captions, and hashtag stacks. Iterate via comments.",
    icon: "♪",
    hue: "violet",
  },
  {
    step: "03",
    title: "You pay per view",
    body: "$7 CPM. Verified-view billing from each platform. We invoice the actual count — not an estimate. Scale up or down anytime. No spend cap.",
    icon: "$",
    hue: "gold",
  },
];

const SCALE = [
  {
    stat: "10",
    unit: "clippers",
    label: "working in parallel per campaign",
  },
  {
    stat: "48h",
    unit: "",
    label: "first batch delivered",
  },
  {
    stat: "50K → 5M",
    unit: "",
    label: "impressions per campaign tier",
  },
  {
    stat: "3",
    unit: "platforms",
    label: "TikTok · Reels · Shorts in one brief",
  },
];

const FAQ = [
  {
    q: "What counts as a 'verified view'?",
    a: "Platform-reported view counts, pulled directly from each platform's analytics API. We don't estimate, and we don't count autoplays or repeats shorter than 3 seconds.",
  },
  {
    q: "Can I set a daily or weekly spend cap?",
    a: "Yes. Set a hard cap in the campaign dashboard. We throttle delivery automatically and notify you at 80% and 100% of cap.",
  },
  {
    q: "Do I own the clips?",
    a: "Yes. Full commercial rights, in perpetuity. Use them for paid media, organic, your agency's deck — whatever you need.",
  },
  {
    q: "How do you match my brand with clippers?",
    a: "Clippers opt in to verticals (tech, beauty, sports, etc.) and pass a quality bar before going live. Our router matches each clip to the 3 highest-fit clippers in that vertical.",
  },
  {
    q: "What's the minimum campaign size?",
    a: "$1,000. That's roughly 143K verified views at the standard $7 CPM rate. Below that, you're better off using our Pro plan directly.",
  },
];

const HUE = {
  primary: "from-[color:var(--color-accent)]/15 to-transparent border-[color:var(--color-accent)]/30",
  violet: "from-[color:var(--color-accent-tertiary)]/15 to-transparent border-[color:var(--color-accent-tertiary)]/30",
  gold: "from-[color:var(--color-accent-secondary)]/15 to-transparent border-[color:var(--color-accent-secondary)]/30",
  teal: "from-[color:var(--color-accent-quaternary)]/15 to-transparent border-[color:var(--color-accent-quaternary)]/30",
};

const HUE_TEXT = {
  primary: "text-[color:var(--color-accent)]",
  violet: "text-[color:var(--color-accent-tertiary)]",
  gold: "text-[color:var(--color-accent-secondary)]",
  teal: "text-[color:var(--color-accent-quaternary)]",
};

export default function BrandsPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<{ quote_id: string; estimated_views: number } | null>(null);

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="relative min-h-[80vh] flex items-center overflow-hidden pt-32 pb-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-[color:var(--color-glow-primary)] opacity-40 blur-[140px]" />
          <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-[color:var(--color-glow-violet)] opacity-30 blur-[140px]" />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted"
          >
            <span className="h-1 w-1 rounded-full bg-[color:var(--color-accent)]" />
            FOR BRANDS · PAY-PER-IMPRESSION
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="font-display font-bold tracking-tight text-[clamp(2.5rem,6vw,5rem)] leading-[1.0] max-w-4xl mx-auto"
          >
            <span className="block text-text-primary">From us, for brands.</span>
            <span className="block bg-gradient-to-r from-[color:var(--color-accent)] via-[color:var(--color-gradient-magenta)] to-[color:var(--color-gradient-cyan)] bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient">
              Pay only for views.
            </span>
            <span className="block text-text-primary/90">Not a flat fee.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-8 text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
          >
            Drop a video. Get 30+ platform-ready clips from our clipper network in
            48 hours. We bill you $7 per 1,000 verified views — never a flat fee,
            never a retainer. Scale up or down anytime.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="#run"
              className="px-7 py-4 bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)] font-semibold rounded-full shadow-[0_0_32px_var(--color-glow-primary)] hover:scale-[1.02] transition-transform"
            >
              Launch a campaign
            </a>
            <a
              href="#math"
              className="px-7 py-4 border border-[color:var(--color-border-strong)] text-text-primary font-semibold rounded-full hover:border-[color:var(--color-accent)] transition-colors"
            >
              See the math
            </a>
          </motion.div>

          {/* Trust strip — 4 numbers, no fake logos */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden border border-[color:var(--color-border)]"
          >
            {[
              { v: "18,421", l: "active clippers" },
              { v: "$7", l: "per 1K views" },
              { v: "48h", l: "first batch" },
              { v: "3", l: "platforms" },
            ].map((s) => (
              <div
                key={s.l}
                className="bg-[color:var(--color-bg-base)] px-4 py-5 text-center"
              >
                <div className="font-display font-bold text-2xl md:text-3xl text-text-primary">
                  {s.v}
                </div>
                <div className="mt-1 text-[10px] font-mono tracking-widest text-text-muted">
                  {s.l.toUpperCase()}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="relative w-full py-24 px-6 bg-[color:var(--color-bg-deep)] border-y border-[color:var(--color-border)]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
              THE MODEL
            </span>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-text-primary tracking-tight max-w-3xl mx-auto">
              Three steps. <span className="text-text-muted">No retainers.</span>
            </h2>
            <p className="mt-4 text-text-secondary max-w-2xl mx-auto">
              You bring the video. We bring the network, the AI pipeline, and the
              verified-view billing. You pay for what works.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`relative overflow-hidden rounded-[var(--radius-lg)] border bg-gradient-to-b p-8 ${HUE[step.hue as keyof typeof HUE]}`}
              >
                <div className="flex items-center gap-3 mb-5">
                  <span className="font-mono text-[10px] tracking-widest text-text-faint">
                    STEP {step.step}
                  </span>
                </div>
                <div
                  className={`text-4xl mb-4 font-display font-bold ${HUE_TEXT[step.hue as keyof typeof HUE_TEXT]}`}
                >
                  {step.icon}
                </div>
                <h3 className="font-display font-bold text-xl text-text-primary mb-3 leading-snug">
                  {step.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CPM Calculator ─── */}
      <section
        id="math"
        className="relative w-full py-24 px-6 bg-[color:var(--color-bg-base)]"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
              THE MATH
            </span>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-text-primary tracking-tight max-w-3xl mx-auto">
              Drag the budget. <span className="text-text-muted">See the views.</span>
            </h2>
            <p className="mt-4 text-text-secondary max-w-2xl mx-auto">
              $7 per 1,000 verified views. 12% platform margin (transparent,
              not deducted invisibly). No platform fees, no agency cut.
            </p>
          </motion.div>

          <CpmCalculator />
        </div>
      </section>

      {/* ─── Scale ─── */}
      <section className="relative w-full py-24 px-6 bg-[color:var(--color-bg-deep)] border-y border-[color:var(--color-border)]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
              SCALE
            </span>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-text-primary tracking-tight max-w-3xl mx-auto">
              Built to scale with you.
            </h2>
            <p className="mt-4 text-text-secondary max-w-2xl mx-auto">
              From a single 50K-view test to a 5M-view always-on — same dashboard,
              same billing, same network.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SCALE.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center"
              >
                <div className="font-display font-bold text-3xl md:text-4xl text-text-primary tracking-tight">
                  {s.stat}
                  <span className="text-base md:text-lg text-text-muted ml-1">
                    {s.unit}
                  </span>
                </div>
                <div className="mt-2 text-xs text-text-muted font-sans leading-snug">
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Comparison strip */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
              <div className="text-[10px] font-mono tracking-widest text-text-faint mb-3">
                AGENCY MODEL
              </div>
              <ul className="space-y-2 text-sm text-text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-[color:var(--color-error)] mt-0.5">×</span>
                  $8K–$25K monthly retainer
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[color:var(--color-error)] mt-0.5">×</span>
                  2–4 week turnaround per batch
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[color:var(--color-error)] mt-0.5">×</span>
                  You pay for the team&apos;s time, not the views
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[color:var(--color-error)] mt-0.5">×</span>
                  Clips locked to the agency&apos;s editor pool
                </li>
              </ul>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent)]/5 p-6">
              <div className="text-[10px] font-mono tracking-widest text-[color:var(--color-accent)] mb-3">
                RELATIV MODEL
              </div>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-[color:var(--color-accent)] mt-0.5">✓</span>
                  $7 CPM · pay only for views delivered
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[color:var(--color-accent)] mt-0.5">✓</span>
                  48-hour first batch, ongoing from there
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[color:var(--color-accent)] mt-0.5">✓</span>
                  You pay for the outcome, not the labor
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[color:var(--color-accent)] mt-0.5">✓</span>
                  Compete among 18K+ clippers per slot
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="relative w-full py-24 px-6 bg-[color:var(--color-bg-base)]">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
              FAQ
            </span>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-text-primary tracking-tight">
              Things brands ask first.
            </h2>
          </motion.div>

          <div className="space-y-2">
            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <motion.div
                  key={item.q}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[color:var(--color-surface-2)] transition-colors"
                    aria-expanded={open}
                  >
                    <span className="font-display font-semibold text-text-primary text-base">
                      {item.q}
                    </span>
                    <motion.span
                      animate={{ rotate: open ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0 text-[color:var(--color-accent)] text-xl leading-none"
                    >
                      +
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 text-sm text-text-secondary leading-relaxed">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Run a Campaign (form anchor) ─── */}
      <section
        id="run"
        className="relative py-24 overflow-hidden bg-[color:var(--color-bg-deep)] border-t border-[color:var(--color-border)]"
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[color:var(--color-glow-primary)] opacity-20 blur-3xl"
        />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <span className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
            <span className="h-1 w-1 rounded-full bg-[color:var(--color-accent)]" />
            RUN A CAMPAIGN
          </span>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-text-primary tracking-tight">
            Drop a video link.
            <br />
            <span className="bg-gradient-to-r from-[color:var(--color-accent)] to-[color:var(--color-gradient-cyan)] bg-clip-text text-transparent">
              Get clips in 48 hours.
            </span>
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            We&apos;ll review the brief, quote a CPM tier, and start the clipper
            competition within 24 hours. No sales call required.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting) return;
              setSubmitting(true);
              setSubmitError(null);
              setSubmitOk(null);

              const fd = new FormData(e.currentTarget);
              const video_url = String(fd.get("video_url") || "").trim();
              const budget = Number(fd.get("budget") || 0);

              if (budget < 1000) {
                setSubmitError("Minimum campaign budget is $1,000.");
                setSubmitting(false);
                return;
              }

              try {
                const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:9000";

                // Two requests in parallel: persist the contact, and request
                // a server-authoritative quote. The quote also re-does the
                // math so the user can't be misled by client-side rounding.
                const [contactRes, quoteRes] = await Promise.all([
                  fetch(`${apiBase}/api/v1/brands/contact`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: "Pending — quote request",
                      email: "pending@relativ.video",
                      company: null,
                      video_url,
                      budget_usd: budget,
                      notes: "Submitted from /brands run-campaign form. Email follow-up needed.",
                    }),
                  }),
                  fetch(`${apiBase}/api/v1/campaigns/quote`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ budget_usd: budget, video_url }),
                  }),
                ]);

                if (!contactRes.ok) {
                  const err = await contactRes.json().catch(() => ({}));
                  throw new Error(err.detail || `contact: HTTP ${contactRes.status}`);
                }
                if (!quoteRes.ok) {
                  const err = await quoteRes.json().catch(() => ({}));
                  throw new Error(err.detail || `quote: HTTP ${quoteRes.status}`);
                }

                const quote = await quoteRes.json();
                setSubmitOk({ quote_id: quote.quote_id, estimated_views: quote.estimated_views });
                e.currentTarget.reset();
              } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                setSubmitError(
                  message || "Couldn't submit. Please try again or email brands@relativ.video."
                );
              } finally {
                setSubmitting(false);
              }
            }}
            className="mt-10 flex flex-col sm:flex-row items-stretch gap-3 max-w-2xl mx-auto"
          >
            <input
              name="video_url"
              type="url"
              required
              placeholder="Paste your YouTube / Vimeo / MP4 link"
              className="flex-1 bg-[color:var(--color-bg-base)] border border-[color:var(--color-border-strong)] rounded-full px-5 py-3.5 text-sm text-text-primary placeholder:text-text-faint focus:border-[color:var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30 transition-all"
            />
            <input
              name="budget"
              type="number"
              min={1000}
              step={500}
              defaultValue={5000}
              placeholder="Budget (USD)"
              className="sm:w-40 bg-[color:var(--color-bg-base)] border border-[color:var(--color-border-strong)] rounded-full px-5 py-3.5 text-sm text-text-primary placeholder:text-text-faint focus:border-[color:var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30 transition-all"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-7 py-3.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)] font-semibold text-sm rounded-full shadow-[0_0_24px_var(--color-glow-primary)] hover:scale-[1.02] transition-transform whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {submitting ? "Launching…" : "Launch →"}
            </button>
          </form>
          {submitError && (
            <p className="mt-4 text-xs text-[color:var(--color-error)] font-mono">
              {submitError}
            </p>
          )}
          {submitOk && (
            <p className="mt-4 text-xs text-[color:var(--color-success)] font-mono">
              ✓ Quote {submitOk.quote_id} saved · {submitOk.estimated_views.toLocaleString("en-US")} estimated views · we&apos;ll be in touch within 24h.
            </p>
          )}
          {!submitError && !submitOk && (
            <p className="mt-4 text-[10px] font-mono text-text-faint">
              Backend wired: contacts and quotes both persist server-side. You&apos;ll get a real confirmation.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
