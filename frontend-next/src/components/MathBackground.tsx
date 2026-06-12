"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * MathBackground — Floating mathematical notation behind everything.
 * Greek letters, calculus symbols, set theory, probability, code snippets.
 * Slow drift, very low opacity, creates the "scientific engine" feel.
 */
const NOTATIONS = [
  "∇Φ", "Σᵢ", "P(h|x)", "∫₀^∞", "e⁻λt", "f(x) = wx + b",
  "argmax", "log P(y|x)", "softmax", "L = -Σy log ŷ", "∂L/∂w",
  "Θ(t)", "ℝⁿ", "δ → 0", "λ → ∞", "μ ± σ", "cov(X,Y)",
  "T(n) = O(n²)", "∀x ∈ X", "∃ y", "x' = σ(Wx + b)",
  "F = ma", "∇ × B", "Σ xᵢ²", "∫f(x)dx", "lim n→∞",
  "ReLU", "dropout(0.3)", "Adam(lr=1e-4)", "epoch 47/100",
  "Φ-score = 0.97", "k=0.4", "λ=0.618", "τ=12.5s",
  "BCE(p,q)", "KL(p‖q)", "ED", "ΔE = 0.04",
  "ψ(x) = 1/(1+e⁻ˣ)", "0.97", "−0.42", "+1.6σ",
  "Σ wᵢxᵢ + b", "arg min L", "∂/∂θ",
];

export default function MathBackground() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Pre-compute positions deterministically (avoid SSR hydration mismatch)
  const items = NOTATIONS.map((text, i) => {
    const row = i % 6;
    const col = Math.floor(i / 6);
    const top = 5 + row * 14 + (i % 3) * 5;
    const left = 2 + col * 17 + ((i * 7) % 11);
    const delay = (i * 0.4) % 4;
    const duration = 18 + (i % 4) * 4;
    const size = i % 5 === 0 ? 44 : i % 3 === 0 ? 28 : 20;
    return { text, top, left, delay, duration, size };
  });

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {items.map((item, i) => (
        <motion.span
          key={i}
          className="absolute select-none"
          style={{
            top: `${item.top}%`,
            left: `${item.left}%`,
            fontSize: `${item.size}px`,
            color: i % 4 === 0
              ? "rgba(217, 70, 239, 0.18)"  // fuchsia pop
              : i % 4 === 1
              ? "rgba(139, 92, 246, 0.15)"   // violet
              : i % 4 === 2
              ? "rgba(20, 184, 166, 0.14)"   // teal
              : "rgba(251, 113, 133, 0.16)", // coral
            fontStyle: item.text.includes("=") || item.text.includes("→") || item.text.includes("ℝ") ? "italic" : "normal",
            fontFamily: item.text.match(/[∇∫Σ∂∞ΘΦλπψσ∀∃∈]/) ? "var(--font-serif)" : "var(--font-mono)",
            fontWeight: 400,
            whiteSpace: "nowrap",
            letterSpacing: "-0.02em",
          }}
          animate={{
            y: [0, -16, 0, 10, 0],
            opacity: [0.6, 1, 0.7, 0.5, 0.6],
            rotate: [0, i % 2 === 0 ? 4 : -4, 0],
          }}
          transition={{
            duration: item.duration,
            delay: item.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {item.text}
        </motion.span>
      ))}
    </div>
  );
}
