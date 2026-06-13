"use client";

import { useRef, useEffect, ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
  range?: number;
  as?: "button" | "a";
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * Wraps a button/anchor. The wrapper tracks the mouse (no styling).
 * The inner button/anchor gets the className + onClick + visual styles.
 * The inner element shifts toward the cursor with a spring, giving a
 * "pulled by a magnet" effect.
 */
export default function MagneticButton({
  children,
  className = "",
  strength = 0.25,
  range = 60,
  as = "button",
  href,
  onClick,
  type = "button",
  disabled,
  ariaLabel,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const sx = useSpring(x, { stiffness: 200, damping: 18, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 200, damping: 18, mass: 0.5 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < range) {
        const falloff = 1 - dist / range;
        x.set(dx * strength * falloff);
        y.set(dy * strength * falloff);
      } else {
        x.set(0);
        y.set(0);
      }
    };
    const onLeave = () => {
      x.set(0);
      y.set(0);
    };

    window.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [range, strength, x, y]);

  const inner = (
    <motion.span style={{ x: sx, y: sy, display: "inline-flex" }}>
      {children}
    </motion.span>
  );

  return (
    <div ref={ref} style={{ display: "inline-block" }}>
      {as === "a" ? (
        <a href={href} onClick={onClick} aria-label={ariaLabel} className={className}>
          {inner}
        </a>
      ) : (
        <button
          type={type}
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel}
          className={className}
        >
          {inner}
        </button>
      )}
    </div>
  );
}
