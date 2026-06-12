"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * ParticleField — Animated particle network. Nodes are connected by lines
 * when they're close enough. Creates an "AI brain" feel without using
 * heavy WebGL. Pure SVG + framer-motion.
 */
const NODES = 24;

export default function ParticleField({ density = 0.3 }: { density?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Deterministic positions for SSR
  const nodes = Array.from({ length: NODES }, (_, i) => {
    const seed = (i * 9301 + 49297) % 233280;
    const x = (seed / 233280) * 100;
    const y = ((seed * 1.7) % 233280 / 233280) * 100;
    return { x, y, delay: (i * 0.13) % 2, size: i % 4 === 0 ? 4 : 2.5 };
  });

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* Connection lines */}
        {nodes.map((a, i) =>
          nodes.slice(i + 1).map((b, j) => {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 22) return null;
            const opacity = (1 - dist / 22) * 0.18 * density;
            return (
              <motion.line
                key={`${i}-${j}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="url(#particle-gradient)"
                strokeWidth="0.15"
                initial={{ opacity: 0 }}
                animate={{ opacity: [opacity * 0.5, opacity, opacity * 0.5] }}
                transition={{
                  duration: 4 + ((i + j) % 3),
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            );
          })
        )}
        <defs>
          <linearGradient id="particle-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D946EF" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.4" />
          </linearGradient>
        </defs>
      </svg>
      {/* Nodes */}
      {nodes.map((n, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            top: `${n.y}%`,
            left: `${n.x}%`,
            width: `${n.size}px`,
            height: `${n.size}px`,
            background: i % 3 === 0
              ? "radial-gradient(circle, #FB7185 0%, transparent 70%)"
              : i % 3 === 1
              ? "radial-gradient(circle, #8B5CF6 0%, transparent 70%)"
              : "radial-gradient(circle, #06B6D4 0%, transparent 70%)",
            boxShadow: n.size > 3 ? "0 0 8px currentColor" : "none",
          }}
          animate={{
            y: [0, -8, 0, 4, 0],
            opacity: [0.4, 0.9, 0.5, 0.7, 0.4],
          }}
          transition={{
            duration: 6 + (i % 4),
            delay: n.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
