"use client";

/**
 * AnimatedHeadlinePill
 * 
 * Strict Height Lock Implementation:
 * - EXACT consistent height across ALL phrases (measured from "10 viral clips")
 * - Animates WIDTH ONLY — zero vertical height fluctuation
 * - Box-sizing: border-box with locked min/max height constraints
 * - Identical typography, font-weight, and leading-none across all phrases
 * - Smooth fade + blur horizontal expansion/contraction
 * - Continuous ambient aurora gradient
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PHRASES = [
  "10 viral clips",
  "scroll-stopping Shorts",
  "a week of content",
  "shareable moments",
  "clips worth watching",
];

const DISPLAY_DURATION = 2300; // ms

export default function AnimatedHeadlinePill() {
  const [index, setIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);

    const handleChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let timer: NodeJS.Timeout;

    const startTimer = () => {
      timer = setInterval(() => {
        if (!document.hidden) {
          setIndex((prev) => (prev + 1) % PHRASES.length);
        }
      }, DISPLAY_DURATION);
    };

    startTimer();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        clearInterval(timer);
        startTimer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <span
        className="inline-flex items-center justify-center shrink-0 box-border px-3.5 sm:px-5 lg:px-6 rounded-full border border-white/20 bg-slate-900/80 backdrop-blur-xl shadow-[0_0_25px_rgba(255,255,255,0.14)] text-white whitespace-nowrap leading-none"
        style={{
          height: "var(--pill-height, 64px)",
          minHeight: "var(--pill-height, 64px)",
          maxHeight: "var(--pill-height, 64px)",
        }}
      >
        {PHRASES[0]}
      </span>
    );
  }

  return (
    <motion.span
      layout
      transition={{
        layout: { type: "spring", stiffness: 360, damping: 32, mass: 0.75 },
      }}
      className="relative inline-flex items-center justify-center shrink-0 box-border h-[42px] sm:h-[54px] lg:h-[64px] min-h-[42px] sm:min-h-[54px] lg:min-h-[64px] max-h-[42px] sm:max-h-[54px] lg:max-h-[64px] px-3.5 sm:px-5 lg:px-5.5 rounded-full border border-white/20 backdrop-blur-xl shadow-[0_0_25px_rgba(255,255,255,0.12),inset_0_1px_1px_rgba(255,255,255,0.25)] overflow-hidden select-none whitespace-nowrap"
      style={{
        background: "rgba(15, 23, 42, 0.7)",
        boxSizing: "border-box",
      }}
    >
      {/* ── Continuous Animated Aurora Gradient Layer ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
        <motion.div
          animate={{
            x: ["-20%", "20%", "-20%"],
            y: ["-15%", "15%", "-15%"],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute -inset-full opacity-60 filter blur-xl pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(56, 189, 248, 0.45), transparent 50%), " +
              "radial-gradient(circle at 70% 40%, rgba(168, 85, 247, 0.4), transparent 50%), " +
              "radial-gradient(circle at 50% 80%, rgba(251, 113, 133, 0.3), transparent 55%), " +
              "radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.35), transparent 50%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/30 pointer-events-none" />
      </div>

      {/* ── Text Transition Slot (Fade + Subtle Blur + Vertical Shift) ── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={PHRASES[index]}
          initial={{
            opacity: 0,
            y: 7,
            filter: "blur(5px)",
          }}
          animate={{
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
          }}
          exit={{
            opacity: 0,
            y: -7,
            filter: "blur(5px)",
          }}
          transition={{
            duration: 0.32,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="relative z-10 text-white font-display font-bold whitespace-nowrap drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] leading-none flex items-center justify-center text-[0.85em] sm:text-[0.88em] lg:text-[0.9em]"
        >
          {PHRASES[index]}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}
