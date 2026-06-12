"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useSpring, useMotionValueEvent } from "framer-motion";

const SECTIONS = [
  { num: "01", label: "Hero" },
  { num: "02", label: "Trust" },
  { num: "03", label: "Demo" },
  { num: "04", label: "Engine" },
  { num: "05", label: "Steps" },
  { num: "06", label: "Preview" },
  { num: "07", label: "Hook" },
  { num: "08", label: "Use cases" },
  { num: "09", label: "Brands" },
  { num: "10", label: "Pricing" },
  { num: "11", label: "FAQ" },
  { num: "12", label: "CTA" },
];

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });
  const [activeIdx, setActiveIdx] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(SECTIONS.length - 1, Math.floor(v * SECTIONS.length));
    setActiveIdx(idx);
  });

  return (
    <>
      {/* Top progress bar — thin, edge-to-edge */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] z-[60] origin-left"
        style={{
          scaleX: scaleY,
          background: "linear-gradient(90deg, #FB7185 0%, #D946EF 50%, #8B5CF6 100%)",
          boxShadow: "0 0 8px rgba(217, 70, 239, 0.5)",
        }}
        aria-hidden
      />

      {/* Right-edge section tracker — desktop only */}
      <nav
        className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-2.5"
        aria-label="Page sections"
      >
        {SECTIONS.map((s, i) => (
          <a
            key={s.num}
            href={`#section-${i}`}
            className="group flex items-center gap-2.5"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(`section-${i}`);
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span
              className="text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-200 tabular-nums"
              style={{
                color: activeIdx === i ? "var(--color-accent)" : "var(--color-text-muted)",
              }}
            >
              {s.num} · {s.label}
            </span>
            <span
              className="block rounded-full transition-all duration-300"
              style={{
                width: activeIdx === i ? "20px" : "6px",
                height: "2px",
                background: activeIdx === i ? "var(--gradient-sunset)" : "var(--color-border-strong)",
                boxShadow: activeIdx === i ? "0 0 8px rgba(217, 70, 239, 0.4)" : "none",
              }}
            />
          </a>
        ))}
      </nav>
    </>
  );
}
