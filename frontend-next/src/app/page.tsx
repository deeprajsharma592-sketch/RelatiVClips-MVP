"use client";

/**
 * Landing page — RelatiV
 *
 * HERO LAYOUT (single column on mobile, 2-column on desktop):
 *
 *   LEFT  · Eyebrow → Headline → Subtext
 *            → PasteLinkInput (with bottom-edge "dissolve" mask)
 *            → FunnelGraphic (BIG, glassmorphic, anchored at bottom)
 *
 *   RIGHT · LongFormStack (4 long-form video thumbnails, still)
 *
 * The paste URL's bottom edge "dissolves" into the funnel's top rim —
 * they share the same glassmorphic material so they feel continuous.
 * The funnel is intentionally static (no animation) — it represents
 * the "taste filter" of the engine.
 *
 * Below the hero:
 *   - Section 02: MovingClipsGrid (6 smaller auto-animating short clips)
 *   - Section 03: Three-pillar engine explainer
 *   - Section 04: Final CTA strip with paste input
 *
 * StickyInputBar slides in from the top after 320px of scroll,
 * keeping "Paste URL + Get clips" accessible while browsing.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Sparkles, Brain, Wand2, Mic } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import StickyInputBar from "@/components/StickyInputBar";
import FunnelGraphic from "@/components/FunnelGraphic";
import PasteLinkInput from "@/components/PasteLinkInput";
import LongFormStack from "@/components/LongFormStack";
import MovingClipsGrid from "@/components/MovingClipsGrid";

const PILLARS = [
  {
    icon: Mic,
    title: "Listens to the audio",
    body: "Whisper transcripts, energy peaks, vocal spikes — every moment is scored.",
    accent: "#D946EF",
  },
  {
    icon: Brain,
    title: "Reads the room",
    body: "Claude picks the 10 most shareable moments per video. Not the loudest — the best.",
    accent: "#F59E0B",
  },
  {
    icon: Wand2,
    title: "Writes the post",
    body: "Word-by-word captions, viral title, hashtags, 9:16 render. All auto.",
    accent: "#06B6D4",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Header, Footer, CookieBanner, ValuePropBar all come from layout.tsx */}
      <StickyInputBar />
        {/* ════════════════════════════════════════════════════════════════
            HERO — Left: text + paste URL + funnel
                   Right: long-form video stack
           ════════════════════════════════════════════════════════════════ */}
        <section
          id="hero"
          className="relative min-h-[100vh] flex items-center overflow-hidden pt-28 pb-12 md:pt-32 md:pb-20"
          style={{
            background:
              "radial-gradient(ellipse at 30% 0%, rgba(252, 211, 77, 0.10) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(217, 70, 239, 0.10) 0%, transparent 50%), var(--color-bg-base)",
          }}
        >
          {/* Subtle background pattern — premium grid */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(40, 30, 20, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(40, 30, 20, 0.04) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage:
                "radial-gradient(ellipse at 50% 50%, black 0%, transparent 80%)",
              WebkitMaskImage:
                "radial-gradient(ellipse at 50% 50%, black 0%, transparent 80%)",
            }}
          />

          <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
              {/* ─── LEFT COLUMN: text → paste URL → funnel ─── */}
              <div className="lg:col-span-7 flex flex-col">
                {/* Top: eyebrow + headline + subtext */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span
                      className="text-[11px] font-mono tracking-wider"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      01
                    </span>
                    <span
                      className="h-px w-10"
                      style={{ background: "var(--color-border-strong)" }}
                    />
                    <span
                      className="text-[11px] font-mono uppercase tracking-wider"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      The funnel
                    </span>
                  </div>

                  <h1
                    className="font-display font-semibold max-w-2xl"
                    style={{
                      fontSize: "clamp(2.75rem, 5.5vw, 4.5rem)",
                      lineHeight: 0.98,
                      letterSpacing: "-0.045em",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    One video.{" "}
                    <span
                      className="font-fraunces-italic"
                      style={{
                        fontWeight: 400,
                        color: "var(--color-accent)",
                      }}
                    >
                      Ten clips.
                    </span>
                    <br />
                    <span style={{ color: "var(--color-text-primary)" }}>
                      Zero editing.
                    </span>
                  </h1>

                  <p
                    className="mt-6 text-base md:text-lg max-w-xl leading-relaxed"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    RelatiV watches, listens, and finds the moments that{" "}
                    <em
                      className="not-italic font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      hook
                    </em>
                    . Then writes the caption, the title, and the hashtags.
                    <br className="hidden md:block" />
                    You paste a URL. You publish clips.
                  </p>
                </motion.div>

                {/* Middle: paste URL with dissolve-into-funnel mask */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.15 }}
                  className="mt-8 max-w-xl relative"
                >
                  <PasteLinkInput variant="hero" />

                  {/* The "stream" between paste URL and funnel — a soft
                      beam that visually connects the input to the rim.
                      Reinforces the "URL feeds the funnel" metaphor. */}
                  <div
                    aria-hidden
                    className="hidden md:block mx-auto mt-0 h-12 w-px"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(252, 211, 77, 0.4) 0%, rgba(217, 70, 239, 0.25) 50%, transparent 100%)",
                    }}
                  />
                </motion.div>

                {/* Bottom: the funnel — big, anchored, glassmorphic */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                  className="relative flex-1 flex items-end justify-center mt-4 md:mt-6"
                  style={{ minHeight: "clamp(420px, 55vh, 620px)" }}
                >
                  <FunnelGraphic className="w-full max-w-[520px] h-full" />
                </motion.div>

                {/* Trust strip — under the funnel */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[12px] font-mono"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span
                        className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                        style={{ background: "#10B981" }}
                      />
                      <span
                        className="relative inline-flex rounded-full h-1.5 w-1.5"
                        style={{ background: "#10B981" }}
                      />
                    </span>
                    Public beta
                  </span>
                  <span style={{ color: "var(--color-text-faint)" }}>·</span>
                  <span>60s per video</span>
                  <span style={{ color: "var(--color-text-faint)" }}>·</span>
                  <span>9:16 auto-crop</span>
                  <span style={{ color: "var(--color-text-faint)" }}>·</span>
                  <span>Captions baked in</span>
                </motion.div>
              </div>

              {/* ─── RIGHT COLUMN: Long-form video stack ─── */}
              <div className="lg:col-span-5 relative flex items-center">
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                  className="relative z-10 w-full"
                >
                  <LongFormStack />
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 02 — MOVING CLIPS GRID
           ════════════════════════════════════════════════════════════════ */}
        <section
          id="section-2"
          className="relative py-20 md:py-32 overflow-hidden"
          style={{ background: "var(--color-bg-deep)" }}
        >
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(217, 70, 239, 0.08) 0%, transparent 60%)",
            }}
          />
          <div className="relative max-w-7xl mx-auto px-6">
            <MovingClipsGrid />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 03 — HOW THE ENGINE WORKS (3 pillars)
           ════════════════════════════════════════════════════════════════ */}
        <section
          id="section-3"
          className="relative py-20 md:py-32 overflow-hidden"
          style={{ background: "var(--color-bg-mist)" }}
        >
          <div className="relative max-w-7xl mx-auto px-6">
            <div className="max-w-3xl mb-14">
              <div className="flex items-center gap-3 mb-5">
                <span
                  className="text-[11px] font-mono"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  03
                </span>
                <span
                  className="h-px w-10"
                  style={{ background: "var(--color-border-strong)" }}
                />
                <span
                  className="text-[11px] font-mono uppercase tracking-wider"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  The engine
                </span>
              </div>
              <h2
                className="font-display font-semibold"
                style={{
                  fontSize: "clamp(2rem, 4vw, 3rem)",
                  lineHeight: 1.05,
                  letterSpacing: "-0.04em",
                  color: "var(--color-text-primary)",
                }}
              >
                Three models.{" "}
                <span
                  className="font-fraunces-italic"
                  style={{ color: "var(--color-accent)", fontWeight: 400 }}
                >
                  One decision:
                </span>{" "}
                <br className="hidden md:block" />
                which moment is the hook.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {PILLARS.map((p, i) => (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
                  className="relative p-7 rounded-3xl overflow-hidden"
                  style={{
                    background: "var(--glass-light-strong)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    border: "1px solid var(--color-border)",
                    boxShadow:
                      "0 8px 24px rgba(40, 30, 20, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
                  }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ background: p.accent }}
                  />
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                    style={{
                      background: `${p.accent}20`,
                      border: `1px solid ${p.accent}40`,
                    }}
                  >
                    <p.icon className="h-5 w-5" style={{ color: p.accent }} />
                  </div>
                  <h3
                    className="font-display font-semibold text-[18px] mb-2"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {p.title}
                  </h3>
                  <p
                    className="text-[14px] leading-relaxed"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {p.body}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="mt-14 text-center">
              <Link
                href="/services"
                className="inline-flex items-center gap-2 text-[13px] font-medium transition-colors"
                style={{ color: "var(--color-text-secondary)" }}
              >
                See the full engine spec
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 04 — FINAL CTA STRIP
           ════════════════════════════════════════════════════════════════ */}
        <section
          id="section-4"
          className="relative py-20 md:py-28 overflow-hidden"
          style={{ background: "var(--color-bg-base)" }}
        >
          <div className="relative max-w-4xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div
                className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full text-[11px] font-medium"
                style={{
                  background: "var(--glass-light-strong)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <Sparkles
                  className="h-3 w-3"
                  style={{ color: "var(--color-accent)" }}
                />
                <span>No editor. No upload. No learning curve.</span>
              </div>

              <h2
                className="font-display font-semibold"
                style={{
                  fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
                  lineHeight: 1.05,
                  letterSpacing: "-0.04em",
                  color: "var(--color-text-primary)",
                }}
              >
                Paste a URL.{" "}
                <span
                  className="font-fraunces-italic"
                  style={{ color: "var(--color-accent)", fontWeight: 400 }}
                >
                  Publish clips.
                </span>
              </h2>

              <p
                className="mt-5 text-base md:text-lg max-w-xl mx-auto"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Free during the public beta. Drop a YouTube link — get
                ten ready-to-post short-form clips in under a minute.
              </p>

              <div className="mt-8 max-w-2xl mx-auto">
                <PasteLinkInput variant="hero" />
              </div>
            </motion.div>
          </div>
        </section>
    </>
  );
}
