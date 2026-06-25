"use client";

/**
 * HeroNature — Autosend-style hero with Ghibli landscape.
 * Light mode: cream bg + Ghibli landscape + mountain silhouettes at bottom.
 * Clean serif headline, descriptive copy, paste URL input overlaid.
 */

import { motion } from "framer-motion";
import { ArrowRight, Link2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
      className="w-full max-w-xl mx-auto flex items-stretch gap-0 rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        border: "1px solid rgba(255,255,255,0.95)",
        boxShadow: "0 8px 40px rgba(59,130,246,0.12), 0 2px 8px rgba(59,130,246,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
      }}
    >
      <div
        className="flex items-center justify-center pl-5 pr-3"
        style={{ color: "rgba(59,130,246,0.45)" }}
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
        style={{ color: "#0F172A", background: "transparent" }}
        aria-label="YouTube URL"
      />
      <button
        type="submit"
        disabled={!url.trim() || !URL_REGEX.test(url.trim()) || submitting}
        className="m-1.5 inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)",
          color: "#FFFFFF",
          boxShadow: "0 4px 16px rgba(59,130,246,0.3)",
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

export default function HeroNature() {
  return (
    <section
      style={{
        background: "#EFF6FF",
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ghibli landscape — full bleed, light tint */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ghibli-hero.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{
          opacity: 0.55,
          filter: "saturate(1.05)",
          objectPosition: "center 30%",
        }}
      />

      {/* Gradient overlay — light at top, dark forest at bottom */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, rgba(239,246,255,0.65) 0%, rgba(239,246,255,0.35) 35%, rgba(5,46,22,0.72) 100%)",
        }}
      />

      {/* Mountain silhouettes at bottom — Autosend style */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: "320px" }}
      >
        <svg
          viewBox="0 0 1440 320"
          preserveAspectRatio="xMidYMax slice"
          className="w-full h-full"
          style={{ display: "block" }}
        >
          {/* Far mountains — misty blue-grey */}
          <path
            d="M0,320 L0,200 Q180,140 360,175 Q540,210 720,150 Q900,90 1080,135 Q1260,180 1440,140 L1440,320 Z"
            fill="#1e3a5f"
            opacity="0.35"
          />
          {/* Mid mountains — forest green */}
          <path
            d="M0,320 L0,240 Q120,190 240,220 Q360,250 540,200 Q720,150 900,195 Q1080,240 1260,200 Q1380,170 1440,190 L1440,320 Z"
            fill="#14532d"
            opacity="0.55"
          />
          {/* Foreground hills — darkest, deep forest */}
          <path
            d="M0,320 L0,270 Q80,240 160,265 Q240,290 400,255 Q560,220 720,260 Q880,300 1040,255 Q1200,210 1360,245 Q1420,260 1440,255 L1440,320 Z"
            fill="#052e16"
            opacity="0.82"
          />
          {/* Mist gradient overlay */}
          <defs>
            <linearGradient id="heroMist" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#052e16" stopOpacity="0" />
              <stop offset="100%" stopColor="#052e16" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <rect x="0" y="160" width="1440" height="160" fill="url(#heroMist)" />
        </svg>
      </div>

      {/* Main content — centered, floating over landscape */}
      <div
        className="relative z-10 max-w-4xl mx-auto px-6 pt-24 md:pt-32"
        style={{ textAlign: "center" }}
      >
        {/* Beta badge */}
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
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.18)",
              color: "#3B82F6",
            }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                style={{ background: "#3B82F6" }}
              />
              <span
                className="relative inline-flex rounded-full h-1.5 w-1.5"
                style={{ background: "#3B82F6" }}
              />
            </span>
            v2.0 · Public beta · Free while in beta
          </span>
        </motion.div>

        {/* Headline — Autosend style: serif italic, descriptive */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mb-6"
        >
          <h1
            className="font-fraunces-italic font-semibold"
            style={{
              fontSize: "clamp(2.4rem, 5.5vw, 4.2rem)",
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: "#0F172A",
            }}
          >
            Turn one video into{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              10 viral clips
            </span>
            ,
            <br />
            picked by AI.
          </h1>
        </motion.div>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-base md:text-lg max-w-lg mx-auto mb-10 leading-relaxed"
          style={{ color: "#475569" }}
        >
          RelatiV watches your video, scores every moment for hook strength,
          and delivers 10 ready-to-post clips — with captions, titles, and
          hashtags — in 60 seconds.
        </motion.p>

        {/* Paste URL input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="mb-8"
        >
          <HeroInput />
        </motion.div>

        {/* Trust line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-4"
          style={{ marginBottom: "7rem" }}
        >
          {TRUST_ITEMS.map((item) => (
            <span
              key={item}
              className="flex items-center gap-1.5 text-[11px] font-mono"
              style={{ color: "#64748B" }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6l3 3 5-5"
                  stroke="#3B82F6"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {item}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
