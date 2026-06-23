"use client";

/**
 * Landing page — RelatiV
 *
 * New layout (post-feedback):
 *   HERO  · LEFT: text + paste URL + trust strip
 *           RIGHT: CascadeGraphic (4-stage glassmorphic pipeline)
 *   STATS · 4-up trust strip
 *   CLIPS · 6 moving clip cards
 *   STEPS · "How it works" — paste → engine → publish
 *   ENGINE · 3 pillars: Listens / Reads / Writes
 *   FAQ   · 5 common questions
 *   CTA   · Final paste URL
 *
 * Removed: LongFormStack (4 YouTube thumbnails) — was redundant noise.
 *
 * The cascade replaces the literal funnel because the literal taper
 * was too phallic / condom-shaped. The cascade is 4 distinct shapes
 * (circle, diamond, hexagon, square) — not a continuous taper.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Brain,
  Wand2,
  Mic,
  Link2,
  Zap,
  Download,
  Clock,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import StickyInputBar from "@/components/StickyInputBar";
import CascadeGraphic from "@/components/CascadeGraphic";
import PasteLinkInput from "@/components/PasteLinkInput";
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

const STATS = [
  { v: "60s", l: "average clip time" },
  { v: "10×", l: "output per video" },
  { v: "$0", l: "manual editing" },
  { v: "4-min", l: "2-hour source" },
];

const STEPS = [
  {
    num: "01",
    icon: Link2,
    title: "Paste a URL",
    body: "Drop a YouTube link. No editor, no upload, no learning curve. Works on any public video.",
    accent: "#FCD34D",
  },
  {
    num: "02",
    icon: Zap,
    title: "Engine runs",
    body: "Whisper transcribes. Librosa scores energy peaks. Claude picks the 10 most shareable moments.",
    accent: "#D946EF",
  },
  {
    num: "03",
    icon: Download,
    title: "Ship clips",
    body: "Auto-cropped 9:16. Word-by-word captions. Viral title. Download or post directly.",
    accent: "#F59E0B",
  },
];

const FAQS = [
  {
    q: "How long does it take?",
    a: "About 4 minutes for a 2-hour source. The bottleneck is transcription. Once transcribed, scoring and rendering take 30 seconds.",
  },
  {
    q: "What aspect ratios are supported?",
    a: "9:16 (TikTok, Reels, Shorts), 1:1 (LinkedIn, X), 16:9 (YouTube). All three render from the same source. Output is H.264 MP4.",
  },
  {
    q: "Can I edit the captions?",
    a: "Yes. Every clip ships with a .srt file and editable captions baked into the video. Pro and Elite plans get word-by-word animated captions.",
  },
  {
    q: "Who owns the clips?",
    a: "You do. Always. We process your source on our GPU workers, render locally, and the files are yours to download, post, and monetize.",
  },
  {
    q: "Do you support non-English videos?",
    a: "Whisper auto-detects 99 languages. Claude scoring works best on English but understands multilingual transcripts. UI is English today.",
  },
];

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <>
      {/* Header, Footer, CookieBanner, ValuePropBar come from layout.tsx */}
      <StickyInputBar />

      <section
        id="hero"
        className="relative min-h-[100vh] flex items-center overflow-hidden pt-24 pb-12 md:pt-28 md:pb-20"
        style={{
          background:
            "radial-gradient(ellipse at 70% 30%, rgba(217, 70, 239, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(252, 211, 77, 0.10) 0%, transparent 50%), var(--color-bg-base)",
        }}
      >
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
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* ─── LEFT COLUMN: text + paste URL + trust strip ─── */}
            <div className="lg:col-span-7 flex flex-col">
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
                    The engine
                  </span>
                </div>

                <h1
                  className="font-display font-semibold"
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

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="mt-8 max-w-xl"
              >
                <PasteLinkInput variant="hero" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="mt-6 flex flex-wrap items-center gap-4 text-[12px] font-mono"
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

              {/* Social proof bar */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="mt-8 flex flex-wrap items-center gap-6"
              >
                <span
                  className="text-[12px] font-mono"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Built in Assam, India
                </span>
                <span
                  className="h-3 w-px"
                  style={{ background: "var(--color-border)" }}
                />
                <span
                  className="text-[12px] font-mono"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Live beta — 50-60 clip requests in first day
                </span>
                <span
                  className="h-3 w-px"
                  style={{ background: "var(--color-border)" }}
                />
                <span
                  className="text-[12px] font-mono"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  45-second clip time
                </span>
              </motion.div>
            </div>

            {/* ─── RIGHT COLUMN: CascadeGraphic (glassmorphic pipeline) ─── */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                className="relative z-10 w-full max-w-[520px]"
              >
                <CascadeGraphic />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          STATS STRIP — fills the "missing information" gap
         ════════════════════════════════════════════════════════════════ */}
      <section
        className="relative py-10 border-y"
        style={{
          background: "var(--color-bg-deep)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
                className="text-center md:text-left"
              >
                <div
                  className="font-mono text-3xl md:text-4xl font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {s.v}
                </div>
                <div
                  className="text-[11px] font-mono uppercase tracking-wider mt-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {s.l}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 02 — MOVING CLIPS GRID
         ════════════════════════════════════════════════════════════════ */}
      <section
        id="section-2"
        className="relative py-20 md:py-32 overflow-hidden"
        style={{ background: "var(--color-bg-base)" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(217, 70, 239, 0.06) 0%, transparent 60%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6">
          <MovingClipsGrid />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 03 — HOW IT WORKS (3 steps)
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
                How it works
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
              Three steps.{" "}
              <span
                className="font-fraunces-italic"
                style={{ color: "var(--color-accent)", fontWeight: 400 }}
              >
                Ten clips.
              </span>{" "}
              <br className="hidden md:block" />
              Less than a coffee break.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5 relative">
            {/* Connecting line between steps (desktop) */}
            <div
              aria-hidden
              className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(217, 70, 239, 0.3) 20%, rgba(245, 158, 11, 0.3) 80%, transparent 100%)",
              }}
            />

            {STEPS.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
                className="relative p-7 rounded-3xl"
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
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
                  style={{ background: s.accent }}
                />
                <div className="flex items-center justify-between mb-5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      background: `${s.accent}20`,
                      border: `1px solid ${s.accent}40`,
                    }}
                  >
                    <s.icon className="h-5 w-5" style={{ color: s.accent }} />
                  </div>
                  <span
                    className="text-[10px] font-mono font-semibold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {s.num}
                  </span>
                </div>
                <h3
                  className="font-display font-semibold text-[18px] mb-2"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {s.title}
                </h3>
                <p
                  className="text-[14px] leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {s.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 04 — ENGINE (3 pillars)
         ════════════════════════════════════════════════════════════════ */}
      <section
        id="section-4"
        className="relative py-20 md:py-32 overflow-hidden"
        style={{ background: "var(--color-bg-base)" }}
      >
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mb-14">
            <div className="flex items-center gap-3 mb-5">
              <span
                className="text-[11px] font-mono"
                style={{ color: "var(--color-text-muted)" }}
              >
                04
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
          SECTION 05 — FAQ
         ════════════════════════════════════════════════════════════════ */}
      <section
        id="section-5"
        className="relative py-20 md:py-32 overflow-hidden"
        style={{ background: "var(--color-bg-mist)" }}
      >
        <div className="relative max-w-3xl mx-auto px-6">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <span
                className="text-[11px] font-mono"
                style={{ color: "var(--color-text-muted)" }}
              >
                05
              </span>
              <span
                className="h-px w-10"
                style={{ background: "var(--color-border-strong)" }}
              />
              <span
                className="text-[11px] font-mono uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                FAQ
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
              Common questions.
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <motion.div
                  key={f.q}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: "var(--glass-light-strong)",
                    backdropFilter: "blur(16px) saturate(180%)",
                    WebkitBackdropFilter: "blur(16px) saturate(180%)",
                    border: "1px solid var(--color-border)",
                    boxShadow: "0 4px 16px rgba(40, 30, 20, 0.04)",
                  }}
                >
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left"
                    aria-expanded={open}
                  >
                    <span
                      className="font-display font-medium text-[15px]"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {f.q}
                    </span>
                    <ChevronDown
                      className="h-4 w-4 shrink-0 transition-transform"
                      style={{
                        color: "var(--color-text-muted)",
                        transform: open ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  </button>
                  {open && (
                    <div
                      className="px-5 pb-5 text-[14px] leading-relaxed"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {f.a}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 06 — FINAL CTA
         ════════════════════════════════════════════════════════════════ */}
      <section
        id="section-6"
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
              <Clock
                className="h-3 w-3"
                style={{ color: "var(--color-accent)" }}
              />
              <span>Free during the public beta · 4 min for a 2-hour source</span>
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
              Drop a YouTube link — get ten ready-to-post short-form
              clips in under a minute. Free during the public beta.
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
