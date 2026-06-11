"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

const RINGS = [
  { radius: 120, speed: 12, stroke: "#D946EF", opacity: 0.25, dash: "4 10" },
  { radius: 200, speed: 18, stroke: "#FFD166", opacity: 0.15, dash: "2 14" },
  { radius: 280, speed: 25, stroke: "#D946EF", opacity: 0.08, dash: "1 18" },
];

const ORBIT_NODES = [
  { radius: 120, count: 6, speed: 12, size: 3, color: "#D946EF" },
  { radius: 200, count: 8, speed: 18, size: 2.5, color: "#FFD166" },
  { radius: 280, count: 10, speed: 25, size: 2, color: "#D946EF" },
];

// Deterministic pseudo-random — same seed produces the same sequence.
// Avoids Math.random() in useMemo factory (which re-rolls on every render
// under React.StrictMode dev double-invocation, breaking HMR + lint).
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export default function HeroBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 40, damping: 15 });
  const springY = useSpring(mouseY, { stiffness: 40, damping: 15 });

  const cx = 400;
  const cy = 380;

  // Pre-compute particle scatter from a deterministic seed so values are
  // stable across renders and across React.StrictMode double-invocation.
  const particles = useMemo(() => {
    const rand = seededRandom(0xc0ffee);
    return Array.from({ length: 40 }, (_, i) => {
      const angle = rand() * 360;
      const dist = 50 + rand() * 350;
      const rad = (angle * Math.PI) / 180;
      return {
        x: cx + dist * Math.cos(rad),
        y: cy + dist * Math.sin(rad),
        size: 0.8 + rand() * 1.2,
        dur: 3 + rand() * 4,
        begin: rand() * 3,
        color: i % 3 === 0 ? "#D946EF" : "#FFD166",
        opacity: 0.08 + rand() * 0.12,
      };
    });
  }, []);

  // The static decoration below uses Math.cos/sin for the grid + rings +
  // orbit nodes. The values are deterministic constants, but V8 and x86-64
  // IEEE 754 round 1 ULP differently in the last digit, which trips
  // React 19 + Next 16's stricter hydration check. Gate on a mounted flag
  // so the server renders nothing here and the client renders the full thing.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 16;
      mouseX.set(x);
      mouseY.set(y);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ x: springX, y: springY }}
    >
      {/* Background gradient glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 700px 500px at 50% 45%, rgba(217,70,239,0.07) 0%, rgba(255,209,102,0.03) 40%, transparent 70%)",
        }}
      />
      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#000000] via-transparent to-[#000000] opacity-60" />

      <svg
        viewBox="0 0 800 800"
        className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[1000px]"
        preserveAspectRatio="xMidYMid meet"
        suppressHydrationWarning
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowSoft">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D946EF" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#FFD166" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#D946EF" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Static decoration (perspective grid + rings + orbits + core) is
            only rendered after mount to avoid SSR/CSR 1-ULP float diffs in
            the trig results. Server renders an empty SVG; client fills it. */}
        {mounted && (
          <>
        {/* Perspective Grid Floor */}
        <g opacity={0.035}>
          {Array.from({ length: 14 }, (_, i) => {
            const yOff = 80 + i * 28;
            const spread = 40 + i * 28;
            return (
              <line
                key={`h-${i}`}
                x1={cx - spread}
                y1={cy + yOff}
                x2={cx + spread}
                y2={cy + yOff}
                stroke="#D946EF"
                strokeWidth={0.5}
              />
            );
          })}
          {Array.from({ length: 10 }, (_, i) => {
            const angle = -60 + (i / 9) * 120;
            const rad = (angle * Math.PI) / 180;
            const len = 350;
            return (
              <line
                key={`r-${i}`}
                x1={cx}
                y1={cy + 80}
                x2={cx + len * Math.cos(rad)}
                y2={cy + 80 + len * Math.sin(rad)}
                stroke="#D946EF"
                strokeWidth={0.5}
              />
            );
          })}
        </g>

        {/* Orbital Rings */}
        {RINGS.map((ring, i) => (
          <g key={`ring-${i}`}>
            <circle
              cx={cx}
              cy={cy}
              r={ring.radius}
              fill="none"
              stroke={ring.stroke}
              strokeWidth={i === 0 ? 1.2 : 1}
              strokeDasharray={ring.dash}
              opacity={ring.opacity}
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 ${cx} ${cy}`}
                to={`360 ${cx} ${cy}`}
                dur={`${ring.speed}s`}
                repeatCount="indefinite"
              />
            </circle>
            {i === 0 && (
              <path
                d={`M ${cx - ring.radius * 0.4} ${cy - ring.radius * 0.92} A ${ring.radius} ${ring.radius} 0 0 1 ${cx + ring.radius * 0.4} ${cy - ring.radius * 0.92}`}
                fill="none"
                stroke="url(#arcGrad)"
                strokeWidth={1.5}
                opacity={0.5}
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`0 ${cx} ${cy}`}
                  to={`360 ${cx} ${cy}`}
                  dur={`${ring.speed}s`}
                  repeatCount="indefinite"
                />
              </path>
            )}
          </g>
        ))}

        {/* Orbiting Nodes */}
        {ORBIT_NODES.map((orbit, oi) => (
          <g key={`orbit-${oi}`} filter="url(#glow)">
            <g>
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 ${cx} ${cy}`}
                to={`360 ${cx} ${cy}`}
                dur={`${orbit.speed}s`}
                repeatCount="indefinite"
              />
              {Array.from({ length: orbit.count }, (_, ni) => {
                const angle = (ni / orbit.count) * 360;
                const rad = ((angle - 90) * Math.PI) / 180;
                const nx = cx + orbit.radius * Math.cos(rad);
                const ny = cy + orbit.radius * Math.sin(rad);
                return (
                  <g key={`n-${oi}-${ni}`}>
                    <circle cx={nx} cy={ny} r={orbit.size} fill={orbit.color} opacity={0.9} />
                    <circle
                      cx={nx}
                      cy={ny}
                      r={orbit.size + 3}
                      fill={orbit.color}
                      opacity={0.15}
                    />
                  </g>
                );
              })}
            </g>
          </g>
        ))}

        {/* Center Core */}
        <g filter="url(#glowSoft)">
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${cx} ${cy}`}
              to={`360 ${cx} ${cy}`}
              dur="30s"
              repeatCount="indefinite"
            />
            <polygon
              points={`${cx},${cy - 50} ${cx + 30},${cy} ${cx},${cy + 50} ${cx - 30},${cy}`}
              fill="none"
              stroke="#D946EF"
              strokeWidth={1.2}
              opacity={0.25}
            />
            <polygon
              points={`${cx},${cy - 25} ${cx + 15},${cy} ${cx},${cy + 25} ${cx - 15},${cy}`}
              fill="#D946EF"
              opacity={0.12}
            />
          </g>

          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${cx} ${cy}`}
              to={`-360 ${cx} ${cy}`}
              dur="20s"
              repeatCount="indefinite"
            />
            <polygon
              points={Array.from({ length: 6 }, (_, i) => {
                const angle = (i / 6) * 360 - 30;
                const rad = (angle * Math.PI) / 180;
                const r = 35;
                return `${cx + r * Math.cos(rad)},${cy + r * Math.sin(rad)}`;
              }).join(" ")}
              fill="none"
              stroke="#FFD166"
              strokeWidth={0.8}
              opacity={0.2}
            />
          </g>

          <circle cx={cx} cy={cy} r={3} fill="#FFD166" opacity={0.9}>
            <animate attributeName="r" values="2;6;2" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.9;0.2;0.9" dur="3s" repeatCount="indefinite" />
          </circle>
        </g>
          </>
        )}

        {/* Ambient particle scatter */}
        {particles.map((p, i) => (
            <circle
              key={`p-${i}`}
              cx={p.x}
              cy={p.y}
              r={p.size}
              fill={p.color}
              opacity={p.opacity}
            >
              <animate
                attributeName="opacity"
                values={`${0.05};${0.2};${0.05}`}
                dur={`${p.dur}s`}
                begin={`${p.begin}s`}
                repeatCount="indefinite"
              />
            </circle>
        ))}
      </svg>

      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#000000] via-[#000000]/80 to-transparent" />
    </motion.div>
  );
}
