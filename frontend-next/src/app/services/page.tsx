"use client";

/**
 * /services — What the engine does.
 *
 * Re-skinned in v5.1 to match the cream-glass aesthetic.
 */

import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

const SERVICES = [
  {
    num: "01",
    symbol: "Φ",
    title: "YouTube Clip Extraction",
    desc: "Surgical extraction from YouTube URLs with automatic subtitle generation and face tracking. Whisper large-v3 transcription, 4-stage scoring, 9:16 re-frame in 47 seconds.",
    metrics: ["1080p output", "Auto-captioning", "YOLO face tracking", "Word-by-word captions"],
    gradient: "linear-gradient(135deg, #FB7185 0%, #D946EF 100%)",
  },
  {
    num: "02",
    symbol: "Δv",
    title: "Local File Processing",
    desc: "Upload MP4, AVI, MOV, or WebM files. Full pipeline runs locally on your hardware — no cloud round-trip for sensitive footage. Batch mode handles 50 files in parallel.",
    metrics: ["Multi-format", "Batch mode", "No file-size cap", "Local-only option"],
    gradient: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)",
  },
  {
    num: "03",
    symbol: "ε",
    title: "AI Virality Scoring",
    desc: "Each clip is scored on semantic hooks, energy peaks, and visual engagement metrics. Claude Haiku 4.5 picks the top 10 from 47 candidates. 97.3% caption accuracy on the test set.",
    metrics: ["Real-time scoring", "Hook detection", "Trend analysis", "A/B/C/D title variants"],
    gradient: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
  },
  {
    num: "04",
    symbol: "Λ",
    title: "Custom Hook Calibration",
    desc: "Train the engine on your voice. Upload 5 example clips, the system learns your style, and the next batch matches it. Pro and Elite only.",
    metrics: ["5-clip onboarding", "Style transfer", "Brand voice", "Per-creator rubric"],
    gradient: "linear-gradient(135deg, #FBBF24 0%, #FB923C 100%)",
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

export default function ServicesPage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden pt-32 pb-20">
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
          <SectionMarker num="01" label="Services" />

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="font-display font-semibold tracking-tight max-w-5xl mx-auto"
            style={{ fontSize: "clamp(2.75rem, 6vw, 5.5rem)", lineHeight: 0.98 }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Everything you need to </span>
            <span className="hero-text text-gradient-sunset" style={{ fontSize: "1.1em" }}>ship clips</span>
            <span style={{ color: "var(--color-text-primary)" }}>.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-8 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Four production-grade services. Pick one, pick all. Same engine, same dashboard, same billing.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/signup" className="btn-primary btn-shine inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Try the engine
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/plans" className="btn-ghost inline-flex items-center gap-2">
              See plans
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Services grid */}
      <section className="relative py-32 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>02</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>The four services</span>
            </div>
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>One engine. </span>
              <span className="hero-text text-gradient-ocean">Four surfaces.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {SERVICES.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="glass-card hover-glow p-7 group relative overflow-hidden"
              >
                {/* Big background symbol */}
                <span
                  className="absolute -top-6 -right-4 font-display font-semibold select-none pointer-events-none"
                  style={{
                    fontSize: "10rem",
                    lineHeight: 1,
                    color: "transparent",
                    background: "linear-gradient(180deg, rgba(60, 50, 30, 0.08) 0%, rgba(60, 50, 30, 0.02) 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                  }}
                >
                  {s.symbol}
                </span>

                <div className="relative">
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-display font-bold text-white text-lg"
                      style={{ background: s.gradient, boxShadow: "0 4px 12px rgba(217, 70, 239, 0.20)" }}
                    >
                      {s.num}
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                        Service {s.num}
                      </p>
                      <h3
                        className="text-[18px] font-semibold mt-0.5"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {s.title}
                      </h3>
                    </div>
                  </div>
                  <p className="text-[14px] leading-relaxed mb-5" style={{ color: "var(--color-text-secondary)" }}>
                    {s.desc}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {s.metrics.map((m) => (
                      <span
                        key={m}
                        className="text-[10px] font-mono px-2 py-1 rounded-full"
                        style={{
                          background: "rgba(6, 182, 212, 0.08)",
                          color: "#0891B2",
                          border: "1px solid rgba(6, 182, 212, 0.15)",
                        }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>03</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Get started</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
          </div>
          <h2
            className="font-display font-semibold tracking-tight"
            style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)", lineHeight: 1.02 }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Try the engine </span>
            <span className="hero-text text-gradient-sunset">today.</span>
          </h2>
          <p className="mt-5 text-lg" style={{ color: "var(--color-text-secondary)" }}>
            Free for 60 minutes of source video a month. No card required.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary btn-shine inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Start clipping
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/brands" className="btn-ghost inline-flex items-center gap-2">
              For brands
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
