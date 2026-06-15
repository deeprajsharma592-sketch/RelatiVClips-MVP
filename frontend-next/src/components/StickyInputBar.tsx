"use client";

/**
 * StickyInputBar — The "paste URL" bar that appears on scroll.
 *
 * Slides in from the top once the user scrolls past the hero section
 * (default: 320px from top). Glassmorphic background, compact input
 * + "Get clips" button. Stays visible while browsing the rest of
 * the page so the CTA is always one click away.
 *
 * The bar is positioned below the existing Header, not over it —
 * so the user keeps access to navigation at all times.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import PasteLinkInput from "./PasteLinkInput";

interface StickyInputBarProps {
  // Show trigger threshold (px from top). Default 320 — just past hero.
  threshold?: number;
}

export default function StickyInputBar({ threshold = 320 }: StickyInputBarProps) {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > threshold);
  });

  // Reduced-motion respect — show immediately if user prefers no motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="sticky-input-bar"
          initial={prefersReducedMotion ? { opacity: 0 } : { y: -80, opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { y: -80, opacity: 0 }}
          transition={{
            type: prefersReducedMotion ? "tween" : "spring",
            stiffness: 260,
            damping: 28,
            mass: 0.6,
          }}
          className="fixed top-[68px] inset-x-0 z-40"
          // Top = 68px to clear the existing Header. Adjust if Header height changes.
          style={{ pointerEvents: "none" }}
        >
          <div
            className="relative"
            style={{
              background: "var(--glass-light-strong)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              borderBottom: "1px solid var(--color-border)",
              boxShadow: "0 6px 24px rgba(40, 30, 20, 0.06)",
            }}
          >
            <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3" style={{ pointerEvents: "auto" }}>
              <PasteLinkInput
                variant="sticky"
                className="flex-1"
              />
              <span
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider whitespace-nowrap"
                style={{
                  background: "var(--glass-light)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
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
                Beta
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
