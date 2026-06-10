"use client";

import { useRef, useEffect, useState } from "react";
import { useInView } from "framer-motion";

interface AnimatedCounterProps {
  from?: number;
  to: number;
  suffix?: string;
  decimals?: number;
  label?: string;
  symbol?: string;
}

export default function AnimatedCounter({
  from = 0,
  to,
  suffix = "",
  decimals = 0,
  label,
  symbol,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (!isInView) return;

    const duration = 2000;
    const start = performance.now();
    const range = to - from;

    let rafId: number;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(from + range * eased);

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isInView, from, to]);

  return (
    <div ref={ref} className="text-center">
      {symbol && (
        <span className="font-mono text-xs text-accent-secondary">[{symbol}]</span>
      )}
      <p className="text-2xl md:text-3xl font-display font-bold text-white mt-1 tabular-nums">
        {count.toFixed(decimals)}{suffix}
      </p>
      {label && (
        <p className="text-xs text-text-muted font-sans mt-1">{label}</p>
      )}
    </div>
  );
}
