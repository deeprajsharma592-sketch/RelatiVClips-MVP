"use client";

/**
 * HeroNew — 3D self-explanatory hero section
 *
 * Layout: Left = headline + URL input  |  Right = 3D phone + floating clip cards
 *
 * 3D scene: CSS perspective on the wrapper, individual cards use
 * rotateX/rotateY to create depth. Framer Motion handles float loops.
 * Zero extra dependencies — uses only framer-motion (already installed).
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  Check,
  Link2,
  Sparkles,
  Mic,
  Brain,
  Wand2,
  Play,
} from "lucide-react";
import BentoGrid from "@/components/BentoGrid";

// ─── URL validation ────────────────────────────────────────────────────────
const URL_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/;

// ─── Trust badges ─────────────────────────────────────────────────────────
const TRUST = [
  "No signup required",
  "Any public YouTube link",
  "9:16 · 1:1 · 16:9 renders",
  "Free during beta",
];

// ─── Pipeline steps shown inside phone ───────────────────────────────────
const PIPELINE_STEPS = [
  { icon: Mic, label: "Audio analysed", color: "#D946EF", done: true },
  { icon: Brain, label: "10 hooks found", color: "#F59E0B", done: true },
  { icon: Wand2, label: "Captions written", color: "#06B6D4", done: true },
  { icon: Sparkles, label: "Clips rendered", color: "#10B981", done: false },
];

// ─── Floating clip card data ───────────────────────────────────────────────
const FLOAT_CARDS = [
  {
    id: 1,
    label: "HOOK MOMENT",
    caption: '"This changed everything about how I—"',
    duration: "0:47",
    color: "#D946EF",
    // 3D position relative to phone centre
    style: {
      top: "-60px",
      left: "-160px",
      rotateZ: -8,
      rotateY: 15,
      rotateX: -5,
    },
    floatDelay: 0,
  },
  {
    id: 2,
    label: "VIRAL CLIP",
    caption: '"Nobody talks about the real reason—"',
    duration: "1:02",
    color: "#F59E0B",
    style: {
      bottom: "60px",
      right: "-150px",
      rotateZ: 6,
      rotateY: -12,
      rotateX: 5,
    },
    floatDelay: 0.4,
  },
  {
    id: 3,
    label: "STORY ARC",
    caption: '"Three years ago I was completely—"',
    duration: "0:58",
    color: "#06B6D4",
    style: {
      bottom: "-50px",
      left: "-120px",
      rotateZ: 4,
      rotateY: 10,
      rotateX: -8,
    },
    floatDelay: 0.8,
  },
];

// ─── Sub-components ────────────────────────────────────────────────────────

function HeroInput() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const valid = URL_REGEX.test(url.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    router.push(`/process?url=${encodeURIComponent(url.trim())}`);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className="flex items-stretch rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(20px)",
          boxShadow: valid
            ? "0 0 0 1px rgba(217,70,239,0.4), 0 8px 32px rgba(217,70,239,0.15)"
            : "0 8px 32px rgba(0,0,0,0.4)",
          transition: "box-shadow 0.2s ease",
        }}
      >
        <div
          className="flex items-center pl-5 pr-3"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          <Link2 className="h-4 w-4" />
        </div>
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="youtube.com/watch?v=..."
          disabled={submitting}
          className="flex-1 min-w-0 bg-transparent py-4 pr-2 text-[15px] outline-none placeholder:opacity-40"
          style={{ color: "#fff" }}
          aria-label="YouTube URL"
        />
        <button
          type="submit"
          disabled={!valid || submitting}
          className="m-2 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, #D946EF 0%, #F59E0B 100%)",
            color: "#fff",
            boxShadow: "0 4px 16px rgba(217,70,239,0.35)",
          }}
        >
          {submitting ? (
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          ) : (
            <>
              <span>Get 10 clips</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

/** A single floating clip card orbiting the phone */
function FloatCard({
  card,
}: {
  card: (typeof FLOAT_CARDS)[number];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: [0, -10, 0],
        rotateZ: card.style.rotateZ,
      }}
      transition={{
        opacity: { duration: 0.5, delay: 0.6 + card.floatDelay },
        scale: { duration: 0.5, delay: 0.6 + card.floatDelay },
        y: {
          duration: 3.5 + card.floatDelay * 0.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: card.floatDelay,
        },
      }}
      className="absolute w-[155px] rounded-2xl overflow-hidden"
      style={{
        ...card.style,
        rotateZ: undefined, // handled by Framer
        background: "rgba(15,10,20,0.85)",
        border: `1px solid ${card.color}40`,
        backdropFilter: "blur(16px)",
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${card.color}20`,
        transformStyle: "preserve-3d",
        perspective: "800px",
        transform: `rotateY(${card.style.rotateY}deg) rotateX(${card.style.rotateX}deg) rotateZ(${card.style.rotateZ}deg)`,
        zIndex: 2,
      }}
    >
      {/* Thumbnail placeholder */}
      <div
        className="h-[88px] w-full relative"
        style={{
          background: `linear-gradient(135deg, ${card.color}22 0%, rgba(0,0,0,0.6) 100%)`,
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ opacity: 0.5 }}
        >
          <Play className="h-6 w-6 fill-white text-white" />
        </div>
        {/* Fake waveform bars */}
        <div className="absolute bottom-2 left-2 flex items-end gap-[2px]">
          {[6, 12, 8, 16, 10, 14, 7, 13, 9, 11].map((h, i) => (
            <div
              key={i}
              className="w-[2px] rounded-full"
              style={{
                height: `${h}px`,
                background: card.color,
                opacity: 0.7,
              }}
            />
          ))}
        </div>
        {/* Duration badge */}
        <div
          className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-semibold"
          style={{
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            backdropFilter: "blur(8px)",
          }}
        >
          {card.duration}
        </div>
      </div>
      {/* Card body */}
      <div className="p-3">
        <div
          className="text-[8px] font-mono font-bold tracking-widest mb-1"
          style={{ color: card.color }}
        >
          {card.label}
        </div>
        <p
          className="text-[10px] leading-snug"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          {card.caption}
        </p>
      </div>
    </motion.div>
  );
}

/** The 3D phone + floating cards scene */
function PhoneScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse-tracked 3D tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-1, 1], [8, -8]), {
    stiffness: 80,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-1, 1], [-12, 12]), {
    stiffness: 80,
    damping: 20,
  });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    mouseX.set(x);
    mouseY.set(y);
  };
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center"
      style={{ perspective: "1200px", width: "100%", height: "560px" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Glow behind phone */}
      <div
        aria-hidden
        className="absolute"
        style={{
          width: "320px",
          height: "320px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(217,70,239,0.25) 0%, transparent 70%)",
          filter: "blur(40px)",
          zIndex: 0,
        }}
      />

      {/* Phone shell — 3D tilts with mouse */}
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
          position: "relative",
          zIndex: 1,
        }}
        initial={{ opacity: 0, y: 30, rotateX: 15 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Phone body */}
        <div
          className="relative"
          style={{
            width: "220px",
            height: "440px",
            borderRadius: "36px",
            background:
              "linear-gradient(160deg, #1a1a2e 0%, #0d0d1a 50%, #050508 100%)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow:
              "0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1)",
            overflow: "hidden",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Notch */}
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full z-10"
            style={{
              width: "70px",
              height: "20px",
              background: "#050508",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />

          {/* Screen content */}
          <div
            className="absolute inset-0 flex flex-col"
            style={{ padding: "48px 0 20px" }}
          >
            {/* Video fill */}
            <div
              className="flex-1 relative overflow-hidden"
              style={{
                background:
                  "linear-gradient(180deg, rgba(30,10,50,0.95) 0%, rgba(10,5,20,0.98) 100%)",
              }}
            >
              {/* Fake speaker face silhouette */}
              <div
                aria-hidden
                className="absolute inset-0 flex items-center justify-center"
                style={{ opacity: 0.15 }}
              >
                <svg
                  viewBox="0 0 100 160"
                  fill="none"
                  width="100"
                  style={{ filter: "blur(2px)" }}
                >
                  <ellipse cx="50" cy="55" rx="30" ry="35" fill="#fff" />
                  <path
                    d="M10 160 Q10 110 50 110 Q90 110 90 160"
                    fill="#fff"
                  />
                </svg>
              </div>

              {/* Animated caption words */}
              <motion.div
                className="absolute bottom-8 left-3 right-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <CaptionWords />
              </motion.div>

              {/* Pipeline progress */}
              <motion.div
                className="absolute top-4 left-3 right-3 space-y-1.5"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.4 }}
              >
                {PIPELINE_STEPS.map((step, i) => (
                  <motion.div
                    key={step.label}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.3 + i * 0.12 }}
                  >
                    <div
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{
                        background: step.done
                          ? `${step.color}25`
                          : "rgba(255,255,255,0.06)",
                        border: `1px solid ${step.done ? step.color + "60" : "rgba(255,255,255,0.1)"}`,
                      }}
                    >
                      <step.icon
                        className="h-2.5 w-2.5"
                        style={{ color: step.done ? step.color : "rgba(255,255,255,0.3)" }}
                      />
                    </div>
                    <span
                      className="text-[9px] font-mono"
                      style={{
                        color: step.done
                          ? "rgba(255,255,255,0.8)"
                          : "rgba(255,255,255,0.3)",
                      }}
                    >
                      {step.label}
                    </span>
                    {step.done && (
                      <Check
                        className="h-2.5 w-2.5 ml-auto"
                        style={{ color: step.color }}
                      />
                    )}
                    {!step.done && (
                      <motion.div
                        className="ml-auto"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      >
                        <div
                          className="w-1 h-1 rounded-full"
                          style={{ background: step.color }}
                        />
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>

          {/* Screen glare */}
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 h-1/3 pointer-events-none"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.06) 0%, transparent 100%)",
              borderRadius: "36px 36px 0 0",
            }}
          />
        </div>

        {/* Floating clip cards */}
        {FLOAT_CARDS.map((card) => (
          <FloatCard key={card.id} card={card} />
        ))}
      </motion.div>
    </div>
  );
}

/** Word-by-word animated captions cycling through sample phrases */
function CaptionWords() {
  const LINES = [
    ["This", "moment", "changed", "EVERYTHING"],
    ["Nobody", "talks", "about", "the", "real", "reason"],
    ["Three", "years", "ago", "I", "was", "nobody"],
  ];
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setLineIdx((i) => (i + 1) % LINES.length),
      3000,
    );
    return () => clearInterval(id);
  }, []);

  const line = LINES[lineIdx];

  return (
    <div
      className="text-center px-2"
      style={{
        background: "rgba(0,0,0,0.5)",
        borderRadius: "8px",
        padding: "8px 6px",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-1">
        {line.map((word, i) => (
          <motion.span
            key={`${lineIdx}-${i}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.25 }}
            className="text-[13px] font-bold leading-tight"
            style={{
              color: word === word.toUpperCase() && word.length > 3
                ? "#D946EF"
                : "#FFFFFF",
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            }}
          >
            {word}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────

export default function HeroNew() {
  return (
    <section
      style={{
        background: "#050506",
        minHeight: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ── Background atmosphere ─────────────────────────────────────────── */}
      {/* Noise grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      {/* Purple glow — top right */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: 0,
          right: 0,
          width: "50%",
          height: "70%",
          background:
            "radial-gradient(ellipse at 80% 10%, rgba(217,70,239,0.14) 0%, transparent 65%)",
        }}
      />
      {/* Amber glow — bottom left */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: 0,
          left: 0,
          width: "40%",
          height: "50%",
          background:
            "radial-gradient(ellipse at 10% 90%, rgba(245,158,11,0.08) 0%, transparent 60%)",
        }}
      />
      {/* Subtle grid lines */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.025,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div
        className="relative z-10 max-w-7xl mx-auto px-6"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))",
          alignItems: "center",
          minHeight: "100vh",
          gap: "60px",
          paddingTop: "80px",
          paddingBottom: "80px",
        }}
      >
        {/* ── LEFT: copy + input ─────────────────────────────────────────── */}
        <div>
          {/* Beta badge */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
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
              Public beta · free while in beta
            </span>
          </motion.div>

          {/* Headline */}
          <div className="mb-8">
            {[
              { text: "PASTE A URL.", color: "#FFFFFF" },
              { text: "GET 10 CLIPS.", color: "#D946EF" },
              { text: "ZERO EDITING.", color: "#FFFFFF" },
            ].map(({ text, color }, i) => (
              <motion.p
                key={text}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.55, delay: 0.08 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="font-bebas leading-[0.9]"
                style={{
                  fontSize: "clamp(3.5rem, 8vw, 7rem)",
                  letterSpacing: "0.01em",
                  color,
                }}
              >
                {text}
              </motion.p>
            ))}
          </div>

          {/* Sub-copy */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.32 }}
            className="text-base max-w-sm mb-8 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Drop any YouTube link. RelatiV{" "}
            <span style={{ color: "rgba(255,255,255,0.85)" }}>listens</span>,{" "}
            <span style={{ color: "rgba(255,255,255,0.85)" }}>reads the transcript</span>,
            and picks the 10 moments most likely to go viral.{" "}
            <span style={{ color: "rgba(255,255,255,0.85)" }}>Auto-captions included.</span>
          </motion.p>

          {/* Input */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.4 }}
            className="mb-6"
          >
            <HeroInput />
          </motion.div>

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="flex flex-wrap gap-x-5 gap-y-2"
          >
            {TRUST.map((item) => (
              <span
                key={item}
                className="flex items-center gap-1.5 text-[11px] font-mono"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                <Check className="h-3 w-3" style={{ color: "#10B981" }} />
                {item}
              </span>
            ))}
          </motion.div>

          {/* Stat pills */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="flex gap-3 mt-10 flex-wrap"
          >
            {[
              { v: "60s", l: "avg clip time" },
              { v: "10×", l: "output per video" },
              { v: "4 min", l: "for a 2-hr source" },
            ].map((s) => (
              <div
                key={s.v}
                className="flex flex-col items-center px-4 py-3 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span
                  className="font-bebas text-2xl leading-none"
                  style={{ color: "#D946EF" }}
                >
                  {s.v}
                </span>
                <span
                  className="text-[10px] font-mono mt-1"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {s.l}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── RIGHT: 3D phone scene ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "flex", justifyContent: "center" }}
        >
          <PhoneScene />
        </motion.div>
      </div>

      {/* ── How it works — 3 step cards ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className="relative z-10 max-w-7xl mx-auto px-6 pb-12"
      >
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            perspective: "1000px",
          }}
        >
          {[
            {
              step: "01",
              icon: Link2,
              title: "Paste a YouTube URL",
              body: "Any public video. No upload, no account, no editor.",
              color: "#FCD34D",
            },
            {
              step: "02",
              icon: Brain,
              title: "AI finds the hooks",
              body: "Transcribes and scores 10 viral moments from audio + transcript.",
              color: "#D946EF",
            },
            {
              step: "03",
              icon: Wand2,
              title: "Clips ship ready",
              body: "9:16 renders, word-by-word captions, viral title, hashtags — all instant.",
              color: "#F59E0B",
            },
          ].map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 20, rotateX: 10 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.8 + i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="rounded-3xl p-6 relative overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              {/* Accent top bar */}
              <div
                className="absolute top-0 left-6 right-6 h-[1px]"
                style={{
                  background: `linear-gradient(90deg, transparent, ${s.color}60, transparent)`,
                }}
              />
              <div
                className="text-[10px] font-mono mb-4"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                {s.step}
              </div>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                style={{
                  background: `${s.color}15`,
                  border: `1px solid ${s.color}30`,
                }}
              >
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
              <h3
                className="font-semibold text-[15px] mb-2"
                style={{ color: "#FFFFFF" }}
              >
                {s.title}
              </h3>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {s.body}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Bento grid ────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pb-24">
        <BentoGrid />
      </div>

      {/* Bottom fade into main site */}
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
