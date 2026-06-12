"use client";

import { motion } from "framer-motion";

/**
 * HookCurve — Animated SVG chart showing the AI's hook-scoring algorithm
 * in real time. Energy peaks (where clips should be made) are highlighted
 * in vibrant gradients. The curve "draws itself" on mount.
 */
export default function HookCurve() {
  // Sample energy values (normalized 0-1) — the "audio energy over time"
  const points = [
    0.15, 0.18, 0.22, 0.31, 0.45, 0.52, 0.48, 0.38, 0.25, 0.32,
    0.58, 0.72, 0.85, 0.91, 0.78, 0.65, 0.55, 0.42, 0.48, 0.62,
    0.88, 0.96, 0.92, 0.74, 0.51, 0.38, 0.29, 0.34, 0.46, 0.58,
    0.71, 0.84, 0.93, 0.89, 0.76, 0.62, 0.51, 0.43, 0.37, 0.31,
  ];

  const w = 400;
  const h = 120;
  const dx = w / (points.length - 1);

  // Build path
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * dx} ${h - p * h * 0.85}`)
    .join(" ");

  // Build area fill
  const areaD = `${pathD} L ${w} ${h} L 0 ${h} Z`;

  // Highlighted peak indices (where the algorithm would cut)
  const peaks = [
    { idx: 12, score: 0.91, label: "Φ=0.91" },
    { idx: 21, score: 0.96, label: "Φ=0.96" },
    { idx: 32, score: 0.93, label: "Φ=0.93" },
  ];

  return (
    <div className="relative w-full" style={{ aspectRatio: `${w} / ${h}` }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="curve-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="33%" stopColor="#D946EF" />
            <stop offset="66%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D946EF" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#D946EF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((y) => (
          <line
            key={y}
            x1="0"
            y1={h * y}
            x2={w}
            y2={h * y}
            stroke="rgba(60, 50, 30, 0.06)"
            strokeWidth="0.5"
            strokeDasharray="2 4"
          />
        ))}

        {/* Filled area (animated draw-in) */}
        <motion.path
          d={areaD}
          fill="url(#curve-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.5 }}
        />

        {/* Curve line (draws itself) */}
        <motion.path
          d={pathD}
          fill="none"
          stroke="url(#curve-stroke)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />

        {/* Threshold line (Φ=0.7) */}
        <motion.line
          x1="0"
          y1={h - 0.7 * h * 0.85}
          x2={w}
          y2={h - 0.7 * h * 0.85}
          stroke="rgba(217, 70, 239, 0.4)"
          strokeWidth="0.8"
          strokeDasharray="3 3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.5 }}
        />
        <motion.text
          x={w - 4}
          y={h - 0.7 * h * 0.85 - 3}
          fontSize="8"
          fill="#D946EF"
          textAnchor="end"
          fontFamily="var(--font-mono)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 2, duration: 0.5 }}
        >
          Φ-threshold = 0.70
        </motion.text>

        {/* Peak markers */}
        {peaks.map((peak, i) => {
          const x = peak.idx * dx;
          const y = h - peak.score * h * 0.85;
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2 + i * 0.2, type: "spring" }}
            >
              <circle cx={x} cy={y} r="5" fill="white" stroke="#D946EF" strokeWidth="2" />
              <circle
                cx={x}
                cy={y}
                r="5"
                fill="none"
                stroke="#D946EF"
                strokeWidth="1"
                opacity="0.5"
              >
                <animate
                  attributeName="r"
                  from="5"
                  to="12"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.6"
                  to="0"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
              <text
                x={x}
                y={y - 10}
                fontSize="8"
                fill="#D946EF"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontWeight="600"
              >
                {peak.label}
              </text>
            </motion.g>
          );
        })}

        {/* Time axis labels */}
        <text x="0" y={h - 2} fontSize="7" fill="rgba(60, 50, 30, 0.4)" fontFamily="var(--font-mono)">
          0:00
        </text>
        <text x={w} y={h - 2} fontSize="7" fill="rgba(60, 50, 30, 0.4)" textAnchor="end" fontFamily="var(--font-mono)">
          1:32:00
        </text>
      </svg>
    </div>
  );
}
