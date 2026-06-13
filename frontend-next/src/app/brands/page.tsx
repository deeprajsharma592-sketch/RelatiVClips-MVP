"use client";

/**
 * /brands — RelatiV's marketing landing for brands.
 *
 * Re-skinned in v5.1 to match the cream-glass aesthetic of the homepage.
 * Same business logic (CPM calculator, contact form, FAQ data) — new visual
 * layer: numbered section markers, glass cards, motion classes, designer
 * typography (display + serif italic accents).
 *
 * Sections:
 *  01 · Hero            — editorial pitch + dual CTA
 *  02 · How it works    — 3 steps with big background numbers
 *  03 · CPM calculator  — interactive budget → impressions estimator
 *  04 · Scale           — capacity / throughput messaging
 *  05 · Comparison      — agency model vs RelatiV model
 *  06 · FAQ             — accordion
 *  07 · Run a campaign  — contact form
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronDown, Sparkles, Check } from "lucide-react";
import CpmCalculator from "@/components/CpmCalculator";
import { apiPath } from "@/lib/apiBase";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Brief us in 5 minutes",
    body: "Drop your raw video and a short brief. We extract the 50 hookiest moments and lock the brand guidelines — fonts, colors, voice, do-not-use list — into the system.",
    artifact: "input · youtube.com/watch?v=…",
  },
  {
    step: "02",
    title: "Clippers deliver in 48 hours",
    body: "Our clipper network competes for your slots. You get 30+ platform-ready clips, each with hook variants, on-brand captions, and hashtag stacks. Iterate via comments.",
    artifact: "compute · 30 clips · 4 hook variants each",
  },
  {
    step: "03",
    title: "You pay per view",
    body: "$7 CPM. Verified-view billing from each platform. We invoice the actual count — not an estimate. Scale up or down anytime. No spend cap.",
    artifact: "output · 30 × .mp4 + verified view count",
  },
];

const SCALE = [
  { stat: "10", unit: "clippers", label: "working in parallel per campaign" },
  { stat: "48h", unit: "", label: "first batch delivered" },
  { stat: "50K → 5M", unit: "", label: "impressions per campaign tier" },
  { stat: "3", unit: "platforms", label: "TikTok · Reels · Shorts in one brief" },
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

function SectionMarker({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>{num}</span>
      <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
      <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{label}</span>
    </div>
  );
}

export default function BrandsPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<{ quote_id: string; estimated_views: number } | null>(null);

  return (
    <>
      {/* ════════════ 01 · HERO ════════════ */}
      <section className="relative min-h-[80vh] flex items-center overflow-hidden pt-32 pb-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.18) 0%, transparent 70%)" }}
          />
          <div
            className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.14) 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
          <SectionMarker num="01" label="For brands" />

          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full text-[11px] font-medium"
            style={{
              background: "rgba(255, 252, 242, 0.7)",
              backdropFilter: "blur(12px) saturate(180%)",
              border: "1px solid rgba(255, 255, 255, 0.7)",
              color: "var(--color-text-secondary)",
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: "#10B981" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#10B981" }} />
            </span>
            Pay-per-impression · No retainers
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="font-display font-semibold tracking-tight max-w-5xl mx-auto"
            style={{ fontSize: "clamp(2.75rem, 6vw, 5.5rem)", lineHeight: 0.98 }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>From us, for brands.</span>
            <br />
            <span className="hero-text text-gradient-sunset" style={{ fontSize: "1.1em" }}>Pay only for views.</span>
            <br />
            <span style={{ color: "var(--color-text-primary)" }}>Not a flat fee.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-8 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Drop a video. Get 30+ platform-ready clips from our clipper network in 48 hours. We bill you $7 per 1,000 verified views — never a flat fee, never a retainer. Scale up or down anytime.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a href="#run" className="btn-primary btn-shine inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Launch a campaign
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#math" className="btn-ghost inline-flex items-center gap-2">
              See the math
            </a>
          </motion.div>

          {/* Trust strip — 4 numbers */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto"
          >
            {[
              { v: "18,421", l: "active clippers" },
              { v: "$7", l: "per 1K views" },
              { v: "48h", l: "first batch" },
              { v: "3", l: "platforms" },
            ].map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                className="glass-card hover-glow px-4 py-3"
              >
                <div className="font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                  {s.v}
                </div>
                <div className="text-[11px] mt-0.5 font-mono" style={{ color: "var(--color-text-muted)" }}>
                  {s.l}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════════════ 02 · HOW IT WORKS ════════════ */}
      <section className="relative py-32 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)", borderBottom: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>02</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>The model</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            </div>
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Three steps. </span>
              <span className="hero-text text-gradient-sunset">No retainers.</span>
            </h2>
            <p className="mt-5 text-lg" style={{ color: "var(--color-text-secondary)" }}>
              You bring the video. We bring the network, the AI pipeline, and the verified-view billing. You pay for what works.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass-card hover-glow p-7 relative overflow-hidden"
              >
                {/* Big background number */}
                <span
                  className="absolute -top-4 -right-2 font-display font-semibold select-none pointer-events-none"
                  style={{
                    fontSize: "8rem",
                    lineHeight: 1,
                    color: "transparent",
                    background: "linear-gradient(180deg, rgba(60, 50, 30, 0.08) 0%, rgba(60, 50, 30, 0.02) 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                  }}
                >
                  {step.step}
                </span>

                <div className="relative">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                    style={{ background: "var(--gradient-sunset)", boxShadow: "0 4px 12px rgba(217, 70, 239, 0.20)" }}
                  >
                    <span className="font-display font-bold text-white text-xl">{i + 1}</span>
                  </div>
                  <h3
                    className="font-display font-semibold text-xl mb-3"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed mb-5" style={{ color: "var(--color-text-secondary)" }}>
                    {step.body}
                  </p>
                  <div
                    className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5"
                    style={{ background: "rgba(40, 30, 15, 0.04)", border: "1px solid rgba(60, 50, 30, 0.08)" }}
                  >
                    <span className="text-[10px] font-mono uppercase tracking-wider shrink-0" style={{ color: "var(--color-text-muted)" }}>
                      {step.artifact.split("·")[0]?.trim()}
                    </span>
                    <code className="text-[11px] font-mono truncate" style={{ color: "var(--color-text-primary)" }}>
                      {step.artifact.split("·").slice(1).join("·").trim()}
                    </code>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ 03 · CPM CALCULATOR ════════════ */}
      <section id="math" className="relative py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>03</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>The math</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            </div>
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Drag the budget. </span>
              <span className="hero-text text-gradient-ocean">See the views.</span>
            </h2>
            <p className="mt-5 text-lg" style={{ color: "var(--color-text-secondary)" }}>
              $7 per 1,000 verified views. 12% platform margin (transparent, not deducted invisibly). No platform fees, no agency cut.
            </p>
          </div>

          <CpmCalculator />
        </div>
      </section>

      {/* ════════════ 04 · SCALE ════════════ */}
      <section className="relative py-32 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)", borderBottom: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>04</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Scale</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            </div>
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Built to scale </span>
              <span className="hero-text text-gradient-sunset">with you.</span>
            </h2>
            <p className="mt-5 text-lg" style={{ color: "var(--color-text-secondary)" }}>
              From a single 50K-view test to a 5M-view always-on — same dashboard, same billing, same network.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SCALE.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="glass-card hover-glow p-6 text-center"
              >
                <div
                  className="font-display font-semibold text-3xl md:text-4xl tracking-tight tabular-nums"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {s.stat}
                  {s.unit && (
                    <span className="text-base md:text-lg ml-1" style={{ color: "var(--color-text-muted)" }}>
                      {s.unit}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs leading-snug" style={{ color: "var(--color-text-muted)" }}>
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ 05 · COMPARISON ════════════ */}
      <section className="relative py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>05</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Comparison</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            </div>
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Agency vs </span>
              <span className="hero-text text-gradient-sunset">RelatiV</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            <div className="glass-card p-7">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  Agency model
                </span>
              </div>
              <ul className="space-y-2.5">
                {[
                  "$8K–$25K monthly retainer",
                  "2–4 week turnaround per batch",
                  "You pay for the team's time, not the views",
                  "Clips locked to the agency's editor pool",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-[14px]" style={{ color: "var(--color-text-muted)" }}>
                    <span className="mt-0.5 text-[var(--color-error)] font-mono text-base leading-none">×</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="p-7 rounded-[var(--radius-xl)]"
              style={{
                background: "rgba(217, 70, 239, 0.06)",
                border: "1px solid rgba(217, 70, 239, 0.25)",
                backdropFilter: "blur(20px) saturate(180%)",
                boxShadow: "0 0 0 1px rgba(217, 70, 239, 0.08), 0 16px 48px rgba(140, 110, 60, 0.08)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: "var(--color-accent)" }}>
                  RelatiV model
                </span>
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(217, 70, 239, 0.15)", color: "var(--color-accent)" }}
                >
                  recommended
                </span>
              </div>
              <ul className="space-y-2.5">
                {[
                  "$7 CPM · pay only for views delivered",
                  "48-hour first batch, ongoing from there",
                  "You pay for the outcome, not the labor",
                  "Compete among 18K+ clippers per slot",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-[14px]" style={{ color: "var(--color-text-primary)" }}>
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ 06 · FAQ ════════════ */}
      <section className="relative py-32 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>06</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>FAQ</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            </div>
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Things brands </span>
              <span className="hero-text text-gradient-sunset">ask first.</span>
            </h2>
          </div>

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
                  className="glass-card overflow-hidden"
                  style={{ borderRadius: "var(--radius-lg)" }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left transition-colors"
                    aria-expanded={open}
                  >
                    <span className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {item.q}
                    </span>
                    <motion.span
                      animate={{ rotate: open ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="shrink-0"
                    >
                      <ChevronDown className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div
                          className="px-6 pb-5 text-[14px] leading-relaxed"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
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

      {/* ════════════ 07 · RUN A CAMPAIGN (form) ════════════ */}
      <section
        id="run"
        className="relative py-32 overflow-hidden"
        style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.18) 0%, transparent 70%)" }}
        />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>07</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Run a campaign</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
          </div>

          <h2
            className="font-display font-semibold tracking-tight"
            style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)", lineHeight: 1.02 }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Drop a video link.</span>
            <br />
            <span className="hero-text text-gradient-sunset">Get clips in 48 hours.</span>
          </h2>
          <p className="mt-5 text-lg" style={{ color: "var(--color-text-secondary)" }}>
            We&apos;ll review the brief, quote a CPM tier, and start the clipper competition within 24 hours. No sales call required.
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
                const [contactRes, quoteRes] = await Promise.all([
                  fetch(apiPath("/api/v1/brands/contact"), {
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
                  fetch(apiPath("/api/v1/campaigns/quote"), {
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
              className="input-glass flex-1"
            />
            <input
              name="budget"
              type="number"
              min={1000}
              step={500}
              defaultValue={5000}
              placeholder="Budget (USD)"
              className="input-glass sm:w-40"
            />
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary btn-shine whitespace-nowrap disabled:opacity-50"
            >
              {submitting ? "Launching…" : "Launch →"}
            </button>
          </form>
          {submitError && (
            <p className="mt-4 text-xs font-mono" style={{ color: "var(--color-error)" }}>
              {submitError}
            </p>
          )}
          {submitOk && (
            <p className="mt-4 text-xs font-mono" style={{ color: "var(--color-success)" }}>
              ✓ Quote {submitOk.quote_id} saved · {submitOk.estimated_views.toLocaleString("en-US")} estimated views · we&apos;ll be in touch within 24h.
            </p>
          )}
          {!submitError && !submitOk && (
            <p className="mt-4 text-[10px] font-mono" style={{ color: "var(--color-text-faint)" }}>
              Backend wired: contacts and quotes both persist server-side. You&apos;ll get a real confirmation.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
