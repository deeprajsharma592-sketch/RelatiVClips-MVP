"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

export default function OwnYourTaste() {
  const containerRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  // Track scroll progress as the section enters the viewport until it reaches center
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center 48%"],
  });

  // Transparency decreases (opacity increases from a soft, glassy 0.35 to crisp 1.0)
  const containerOpacity = useTransform(scrollYProgress, [0.05, 0.95], [0.38, 1]);
  const containerScale = useTransform(scrollYProgress, [0.05, 0.95], [0.94, 1]);
  const glassBorderOpacity = useTransform(scrollYProgress, [0.1, 0.9], [0.12, 0.3]);
  const glassGlow = useTransform(scrollYProgress, [0.2, 0.95], [0, 1]);

  // Fluid fill: rises from bottom (100% inset) to top (0% inset) like liquid entering a glass vessel
  const fluidClip = useTransform(
    scrollYProgress,
    [0.1, 0.95],
    ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  );

  // Meniscus glow position following the fluid surface
  const meniscusBottom = useTransform(scrollYProgress, [0.1, 0.95], ["0%", "100%"]);
  const meniscusOpacity = useTransform(scrollYProgress, [0.1, 0.25, 0.88, 0.98], [0, 1, 1, 0]);

  return (
    <section
      ref={containerRef}
      className="relative w-full py-20 sm:py-28 md:py-36 flex flex-col items-center justify-center bg-black overflow-hidden select-none"
      aria-label="Own Your Taste"
    >
      {/* Ambient background glass aura */}
      <motion.div
        style={reduceMotion ? { opacity: 0.6 } : { opacity: glassGlow }}
        className="pointer-events-none absolute w-[420px] sm:w-[680px] h-[260px] sm:h-[360px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.18)_0%,rgba(147,51,234,0.1)_45%,transparent_75%)] blur-[90px]"
      />

      {/* ── Apple Vision Pro Glass Capsule ── */}
      <motion.div
        style={
          reduceMotion
            ? { opacity: 1, scale: 1 }
            : { opacity: containerOpacity, scale: containerScale }
        }
        className="relative group inline-flex flex-col items-center justify-center px-7 py-6 sm:px-14 sm:py-9 rounded-[28px] sm:rounded-[36px] bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-black/60 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.4)] max-w-[94vw]"
      >
        {/* Specular top rim highlight (Apple Glass signature) */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />

        {/* Ambient subtle eyebrow */}
        <span className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.25em] text-zinc-400/80 mb-2">
          EDITORIAL DNA
        </span>

        {/* ── Master Typography: "Own Your Taste" ── */}
        <div className="relative flex items-center justify-center">
          {/* Base Layer: Translucent Apple Glass Hollow Outline */}
          <h2
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-black tracking-[-0.035em] leading-none text-white/20 select-none"
            style={{
              WebkitTextStroke: "1.5px rgba(255, 255, 255, 0.35)",
              textShadow: "0 0 35px rgba(255, 255, 255, 0.08)",
            }}
          >
            Own Your Taste
          </h2>

          {/* Foreground Layer: Fluid Liquid Fill (Scroll-Driven Rising Meniscus) */}
          <motion.div
            style={reduceMotion ? undefined : { clipPath: fluidClip }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            aria-hidden="true"
          >
            <span className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-black tracking-[-0.035em] leading-none bg-gradient-to-t from-sky-400 via-indigo-300 to-white bg-clip-text text-transparent [filter:drop-shadow(0_0_30px_rgba(56,189,248,0.55))]">
              Own Your Taste
            </span>

            {/* Glowing Meniscus line riding the rising liquid surface */}
            {!reduceMotion && (
              <motion.div
                style={{
                  bottom: meniscusBottom,
                  opacity: meniscusOpacity,
                }}
                className="absolute inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent blur-[1px] shadow-[0_0_16px_rgba(56,189,248,0.9)]"
              />
            )}
          </motion.div>
        </div>

        {/* Specular bottom rim highlight */}
        <div className="pointer-events-none absolute inset-x-12 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </motion.div>
    </section>
  );
}
