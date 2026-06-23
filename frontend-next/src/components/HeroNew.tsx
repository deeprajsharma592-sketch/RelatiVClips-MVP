"use client";

/**
 * HeroNew — Full-width dark premium hero, Magic UI / Aceternity style.
 * Replaces the current hero on page.tsx.
 *
 * Layout:
 *   Full-bleed dark background with subtle noise texture
 *   Large badge + massive stacked headline (Bebas Neue)
 *   Subheadline + input row
 *   BentoGrid integrated below headline
 *   Background: #050506 (near-black, not pure black)
 */

import { motion } from "framer-motion";
import { ArrowRight, Link2, Sparkles, Check } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BentoGrid from "@/components/BentoGrid";

const URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;

// Simple paste input for this hero
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
      className="w-full max-w-xl flex items-stretch gap-0 rounded-full overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 0 0 0 rgba(217,70,239,0), 0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-center justify-center pl-5 pr-3" style={{ color: "rgba(255,255,255,0.4)" }}>
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
        className="m-1.5 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, #D946EF 0%, #F59E0B 100%)",
          color: "#FFFFFF",
          boxShadow: "0 4px 16px rgba(217,70,239,0.4)",
        }}
      >
        {submitting ? (
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
        ) : (
          <>
            <span>Get 10 clips in 60s</span>
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
  "Free during the beta",
];

export default function HeroNew() {
  return (
    <section
      style={{
        background: "#050506",
        minHeight: "100vh",
      }}
    >
      {/* Noise texture overlay */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Gradient glow — top right */}
      <div
        aria-hidden
        className="absolute top-0 right-0 w-[600px] h-[400px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 80% 20%, rgba(217,70,239,0.12) 0%, transparent 60%)",
        }}
      />

      {/* Gradient glow — bottom left */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 w-[500px] h-[300px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 20% 80%, rgba(245,158,11,0.08) 0%, transparent 60%)",
        }}
      />

      {/* Main content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-28 md:pt-36 pb-0">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono font-medium"
            style={{
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.25)",
              color: "#10B981",
            }}
          >
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
            Public beta · Free while in beta
          </span>
        </motion.div>

        {/* Headline */}
        <div className="mb-10">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="font-bebas leading-[0.92] mb-0"
            style={{
              fontSize: "clamp(5.5rem, 16vw, 13rem)",
              letterSpacing: "0.005em",
              color: "#FFFFFF",
            }}
          >
            PASTE A URL.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-bebas leading-[0.92]"
            style={{
              fontSize: "clamp(5.5rem, 16vw, 13rem)",
              letterSpacing: "0.005em",
              color: "#D946EF",
            }}
          >
            GET 10 CLIPS.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="font-bebas leading-[0.92]"
            style={{
              fontSize: "clamp(5.5rem, 16vw, 13rem)",
              letterSpacing: "0.005em",
              color: "#FFFFFF",
            }}
          >
            ZERO EDITING.
          </motion.p>
        </div>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="text-base md:text-lg max-w-lg mb-8 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          RelatiV watches, listens, and finds the moments that{" "}
          <span style={{ color: "#FFFFFF" }}>hook</span>. Then writes the
          caption, the title, and the hashtags.
        </motion.p>

        {/* Input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28 }}
          className="mb-6"
        >
          <HeroInput />
        </motion.div>

        {/* Trust line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="flex flex-wrap items-center gap-4 mb-16"
        >
          {TRUST_ITEMS.map((item, i) => (
            <span
              key={item}
              className="flex items-center gap-1.5 text-[11px] font-mono"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              <Check className="h-3 w-3" style={{ color: "#10B981" }} />
              {item}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Bento Grid — full width, dark cards */}
      <div className="relative z-10 bg-[#050506]">
        <div className="max-w-6xl mx-auto px-6 pb-24">
          <BentoGrid />
        </div>
      </div>

      {/* Bottom fade into site */}
      <div
        aria-hidden
        className="h-24"
        style={{
          background: "linear-gradient(to bottom, #050506 0%, transparent 100%)",
        }}
      />
    </section>
  );
}
