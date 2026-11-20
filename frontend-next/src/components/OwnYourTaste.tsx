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

  // As you scroll: transparency decreases (opacity rises from subtle 0.35 to vibrant 1.0)
  const textOpacity = useTransform(scrollYProgress, [0.05, 0.85], [0.35, 1]);
  const textScale = useTransform(scrollYProgress, [0.05, 0.85], [0.96, 1]);

  // Fluid liquid rises from bottom (100% inset) to top (0% inset) filling the glass letters
  const fluidClip = useTransform(
    scrollYProgress,
    [0.1, 0.85],
    ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  );

  return (
    <section
      ref={containerRef}
      className="relative w-full py-24 sm:py-32 md:py-44 flex items-center justify-center bg-black overflow-hidden select-none"
      aria-label="Own Your Taste"
    >
      {/* ── ONLY THE TEXT: Apple Glass Effect + Liquid Scroll Fill (No box / No container) ── */}
      <motion.div
        style={
          reduceMotion
            ? { opacity: 1, scale: 1 }
            : { opacity: textOpacity, scale: textScale }
        }
        className="relative inline-block text-center px-4"
      >
        {/* Base Layer: Apple Glass Text (Translucent, Frosted Specular Rim) */}
        <h2
          className="block text-[clamp(2.8rem,9vw,9rem)] font-display font-black tracking-[-0.04em] leading-none whitespace-nowrap select-none text-transparent"
          style={{
            WebkitTextStroke: "1.5px rgba(255, 255, 255, 0.35)",
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.25) 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            textShadow: "0 0 35px rgba(255, 255, 255, 0.08)",
          }}
        >
          Own Your Taste
        </h2>

        {/* Foreground Layer: Liquid Fluid Fill (Fills Up From Bottom on Scroll) */}
        <motion.div
          style={reduceMotion ? undefined : { clipPath: fluidClip }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          aria-hidden="true"
        >
          <span className="block text-[clamp(2.8rem,9vw,9rem)] font-display font-black tracking-[-0.04em] leading-none whitespace-nowrap bg-gradient-to-t from-sky-400 via-indigo-300 to-white bg-clip-text text-transparent [-webkit-background-clip:_text] [-webkit-text-fill-color:_transparent] [filter:drop-shadow(0_0_35px_rgba(56,189,248,0.55))]">
            Own Your Taste
          </span>
        </motion.div>
      </motion.div>
    </section>
  );
}
