"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * PremiumGrid — Architectural grid + sparse math glyphs in safe gutters.
 *
 * Three layers, each very low opacity, no rotation, no big drift:
 *   1. Dot grid (32px × 32px) — engineering blueprint feel
 *   2. 12-column vertical lines — anchored to the page grid
 *   3. Math glyphs — only in the outer gutters, never where text lives
 *   4. Corner crosshairs (4 corners) — Linear/Vercel section markers
 *
 * Math glyphs are restricted to a 2×6 sparse grid in the OUTER columns
 * (left: 0-8%, right: 92-100%) and the top/bottom 8% of the section.
 * This guarantees they never bump into readable content.
 */

const GLYPHS = [
  "∇Φ", "Σᵢ", "P(h|x)", "λ=0.618",
  "e⁻λt", "f(x) = wx + b", "argmax", "τ=12.5s",
  "softmax", "L = -Σy log ŷ", "∂L/∂w", "μ ± σ",
];

// Sparse gutter positions: only outer columns (4% / 96%) and top/bottom
// Each item has explicit (top, left) in % — never in the content zone
const GUTTER_POSITIONS: Array<{ top: number; left: number; size: number; opacity: number }> = [
  // Top zone (top 6-10%)
  { top: 6, left: 3, size: 18, opacity: 0.07 },
  { top: 8, left: 96, size: 16, opacity: 0.06 },
  { top: 5, left: 50, size: 14, opacity: 0.04 },
  // Bottom zone (bottom 6-10%)
  { top: 92, left: 4, size: 16, opacity: 0.06 },
  { top: 94, left: 95, size: 18, opacity: 0.07 },
  // Far-left gutter (left: 1-3%)
  { top: 25, left: 1.5, size: 16, opacity: 0.05 },
  { top: 50, left: 1, size: 18, opacity: 0.06 },
  { top: 75, left: 1.5, size: 14, opacity: 0.04 },
  // Far-right gutter (left: 97-99%)
  { top: 25, left: 98, size: 18, opacity: 0.06 },
  { top: 50, left: 99, size: 16, opacity: 0.05 },
  { top: 75, left: 98, size: 14, opacity: 0.04 },
  // Center-vertical safe zones (between 35-65% top, but outside content width)
  { top: 38, left: 1.5, size: 12, opacity: 0.04 },
  { top: 62, left: 98, size: 12, opacity: 0.04 },
];

interface PremiumGridProps {
  /** Show the dot grid pattern background */
  showDots?: boolean;
  /** Show 12-column vertical lines */
  showColumns?: boolean;
  /** Show corner crosshairs (4) */
  showCrosshairs?: boolean;
  /** Show math glyphs in gutters */
  showGlyphs?: boolean;
  /** Optional: which corner crosshairs to show */
  crosshairCorners?: Array<"tl" | "tr" | "bl" | "br">;
}

export default function PremiumGrid({
  showDots = true,
  showColumns = true,
  showCrosshairs = true,
  showGlyphs = true,
  crosshairCorners = ["tl", "tr", "bl", "br"],
}: PremiumGridProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Layer 1: Dot grid (32px squares, 1px dot, 0.06 opacity) */}
      {showDots && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(15, 23, 42, 0.18) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            backgroundPosition: "0 0",
            opacity: 0.5,
            maskImage:
              "linear-gradient(180deg, transparent 0%, black 15%, black 85%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, transparent 0%, black 15%, black 85%, transparent 100%)",
          }}
        />
      )}

      {/* Layer 2: 12-column vertical lines (1px, 0.04 opacity) */}
      {showColumns && (
        <div
          className="absolute inset-0 mx-auto"
          style={{ maxWidth: "1280px", opacity: 0.35 }}
        >
          {Array.from({ length: 13 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px"
              style={{
                left: `${(i / 12) * 100}%`,
                background: "rgba(15, 23, 42, 0.08)",
              }}
            />
          ))}
        </div>
      )}

      {/* Layer 3: Corner crosshairs (Linear/Vercel-style section markers) */}
      {showCrosshairs && (
        <>
          {crosshairCorners.includes("tl") && <Crosshair pos="tl" />}
          {crosshairCorners.includes("tr") && <Crosshair pos="tr" />}
          {crosshairCorners.includes("bl") && <Crosshair pos="bl" />}
          {crosshairCorners.includes("br") && <Crosshair pos="br" />}
        </>
      )}

      {/* Layer 4: Math glyphs in gutters only — sparse, no overlap with text */}
      {showGlyphs && (
        <div className="absolute inset-0">
          {GUTTER_POSITIONS.map((p, i) => (
            <span
              key={i}
              className="absolute select-none whitespace-nowrap"
              style={{
                top: `${p.top}%`,
                left: `${p.left}%`,
                fontSize: `${p.size}px`,
                fontFamily: "var(--font-mono)",
                color: `rgba(15, 23, 42, ${p.opacity})`,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                transform: "translate(-50%, -50%)",
                fontStyle: i % 3 === 0 ? "italic" : "normal",
              }}
            >
              {GLYPHS[i % GLYPHS.length]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small crosshair in a corner — Linear/Vercel-style section marker */
function Crosshair({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const style: React.CSSProperties = {
    position: "absolute",
    width: "12px",
    height: "12px",
    opacity: 0.25,
  };
  if (pos === "tl") Object.assign(style, { top: "8px", left: "8px" });
  if (pos === "tr") Object.assign(style, { top: "8px", right: "8px" });
  if (pos === "bl") Object.assign(style, { bottom: "8px", left: "8px" });
  if (pos === "br") Object.assign(style, { bottom: "8px", right: "8px" });

  return (
    <div style={style}>
      <div
        className="absolute top-1/2 left-0 w-full h-px"
        style={{
          background: "rgba(15, 23, 42, 0.5)",
          transform: "translateY(-50%)",
        }}
      />
      <div
        className="absolute left-1/2 top-0 h-full w-px"
        style={{
          background: "rgba(15, 23, 42, 0.5)",
          transform: "translateX(-50%)",
        }}
      />
    </div>
  );
}
