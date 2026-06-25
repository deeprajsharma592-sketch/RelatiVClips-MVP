"use client";

/**
 * HeroNature — Warm dawn hero with mountain silhouettes.
 * Inspired by Autosend / Valley / LlamaIndex SaaS aesthetic.
 * Replaces HeroNew in page.tsx.
 *
 * Design choices:
 *   - Warm dawn gradient: deep indigo → purple → rose → orange
 *   - Layered mountain SVGs at bottom
 *   - One bold serif headline + subtext
 *   - Centered elegant input
 *   - Ambient floating orbs for depth
 */

import { motion } from "framer-motion";
import { ArrowRight, Link2, Sparkles, Check } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BentoGrid from "@/components/BentoGrid";

const URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;

function HeroInput() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!URL_REGEX.test(trimmed)) return;
    setSubmitting(true);
    router.push(`/process?url=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto flex items-stretch gap-0 rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.07)",
        backdropFilter: "blur(32px)",
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
      }}
    >
      <div
        className="flex items-center justify-center pl-5 pr-3"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        <Link2 className="h-4 w-4" />
      </div>
      <input
        type="url"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a YouTube link…"
        disabled={submitting}
        className="flex-1 min-w-0 bg-transparent py-4 pr-2 text-[15px] outline-none"
        style={{
          color: "#FFFFFF",
          background: "transparent",
        }}
        aria-label="YouTube URL"
      />
      <button
        type="submit"
        disabled={!url.trim() || !URL_REGEX.test(url.trim()) || submitting}
        className="m-1.5 inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, #D946EF 0%, #FF77E9 50%, #FFD24A 100%)",
          color: "#FFFFFF",
          boxShadow: "0 4px 20px rgba(217,70,239,0.4)",
        }}
      >
        {submitting ? (
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
        ) : (
          <>
            <span>Get clips</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </>
        )}
      </button>
    </form>
  );
}

const TRUST_ITEMS = [
  "No signup required",
  "Works on any public YouTube link",
  "H.264 output · 9:16 + 1:1 + 16:9",
  "Free during beta",
];

// Floating ambient orbs — decorative depth layer
function AmbientOrbs() {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Large soft orb — top right */}
      <motion.div
        animate={{ y: [0, -20, 0], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 right-20 w-80 h-80 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(217,70,239,0.4) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      {/* Mid orb — left */}
      <motion.div
        animate={{ y: [0, 15, 0], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute top-40 left-10 w-64 h-64 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(255,210,74,0.3) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      {/* Small orb — bottom center */}
      <motion.div
        animate={{ y: [0, -12, 0], opacity: [0.08, 0.15, 0.08] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute bottom-40 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(255,119,233,0.3) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
    </div>
  );
}

// Mountain silhouette SVG layers
function MountainScene() {
  return (
    <div
      aria-hidden
      className="absolute bottom-0 left-0 right-0 pointer-events-none"
      style={{ height: "380px" }}
    >
      <svg
        viewBox="0 0 1440 380"
        preserveAspectRatio="xMidYMax slice"
        className="w-full h-full"
        style={{ display: "block" }}
      >
        {/* Far mountains — lightest, most distant */}
        <path
          d="M0,380 L0,260 Q120,180 240,220 Q360,260 480,190 Q600,120 720,170 Q840,220 960,150 Q1080,80 1200,130 Q1320,180 1440,140 L1440,380 Z"
          fill="#1e0a3a"
          opacity="0.5"
        />
        {/* Mid mountains */}
        <path
          d="M0,380 L0,290 Q80,230 160,260 Q240,290 360,220 Q480,150 600,200 Q720,250 840,180 Q960,110 1080,160 Q1200,210 1320,170 Q1380,150 1440,165 L1440,380 Z"
          fill="#150726"
          opacity="0.7"
        />
        {/* Near mountains — darkest, closest */}
        <path
          d="M0,380 L0,310 Q60,270 120,295 Q180,320 300,265 Q420,210 540,255 Q660,300 780,240 Q900,180 1020,230 Q1140,280 1260,235 Q1380,190 1440,215 L1440,380 Z"
          fill="#0d0418"
          opacity="0.9"
        />
        {/* Mist layer — soft gradient at mountain base */}
        <defs>
          <linearGradient id="mistGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a0533" stopOpacity="0" />
            <stop offset="60%" stopColor="#1a0533" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0d0418" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <rect x="0" y="200" width="1440" height="180" fill="url(#mistGrad)" />
        {/* Subtle stars/dots in sky */}
        {[
          [200, 60], [350, 40], [500, 80], [700, 30], [900, 70],
          [1100, 50], [1300, 65], [150, 90], [450, 55], [1150, 85],
        ].map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r="1.5"
            fill="white"
            opacity={0.3 + (i % 3) * 0.15}
            animate={{ opacity: [0.2 + (i % 3) * 0.1, 0.5 + (i % 3) * 0.1, 0.2 + (i % 3) * 0.1] }}
            transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: i * 0.5 }}
          />
        ))}
      </svg>
    </div>
  );
}

export default function HeroNature() {
  return (
    <section
      style={{
        background: "linear-gradient(180deg, #0f0618 0%, #1a0533 25%, #2d1060 50%, #4c1d95 70%, #7c2d8e 85%, #c026d3 100%)",
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient orbs */}
      <AmbientOrbs />

      {/* Noise texture — very subtle */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Mountain scene at bottom */}
      <MountainScene />

      {/* Main content */}
      <div
        className="relative z-10 max-w-5xl mx-auto px-6 pt-28 md:pt-40 pb-0"
        style={{ textAlign: "center" }}
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
          style={{ display: "flex", justifyContent: "center" }}
        >
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono font-medium"
            style={{
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.25)",
              color: "#34D399",
            }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                style={{ background: "#34D399" }}
              />
              <span
                className="relative inline-flex rounded-full h-1.5 w-1.5"
                style={{ background: "#34D399" }}
              />
            </span>
            v2.0 · Public beta · Free while in beta
          </span>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mb-6"
        >
          <h1
            className="font-bebas leading-[0.9]"
            style={{
              fontSize: "clamp(4rem, 12vw, 10rem)",
              letterSpacing: "0.01em",
              background: "linear-gradient(135deg, #FFFFFF 0%, #F5D0FE 50%, #FFD24A 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            PASTE A URL.
          </h1>
          <h1
            className="font-bebas leading-[0.9]"
            style={{
              fontSize: "clamp(4rem, 12vw, 10rem)",
              letterSpacing: "0.01em",
              color: "#FFFFFF",
            }}
          >
            GET 10 CLIPS.
          </h1>
        </motion.div>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="text-base md:text-lg max-w-md mx-auto mb-10 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          RelatiV watches, listens, and finds the moments that{" "}
          <span style={{ color: "#FFD24A" }}>hook</span>. Then writes
          the caption, the title, and the hashtags. Ready in 60 seconds.
        </motion.p>

        {/* Input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mb-8"
        >
          <HeroInput />
        </motion.div>

        {/* Trust line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.32 }}
          className="flex flex-wrap items-center justify-center gap-4"
          style={{ marginBottom: "6rem" }}
        >
          {TRUST_ITEMS.map((item) => (
            <span
              key={item}
              className="flex items-center gap-1.5 text-[11px] font-mono"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              <Check className="h-3 w-3" style={{ color: "#34D399" }} />
              {item}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Bento Grid — full width, blends with mountain dark */}
      <div className="relative z-10" style={{ background: "#0d0418" }}>
        <div className="max-w-6xl mx-auto px-6 pb-24">
          <BentoGrid />
        </div>
      </div>

      {/* Bottom fade */}
      <div
        aria-hidden
        className="h-24 relative z-10"
        style={{
          background: "linear-gradient(to bottom, #0d0418 0%, #0a0210 100%)",
        }}
      />
    </section>
  );
}
