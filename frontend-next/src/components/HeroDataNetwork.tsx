"use client";

/**
 * HeroDataNetwork — Cinematic AI Video Transformation Stream Network
 * 
 * Accurately matching the primary visual reference:
 * - Electric blue (#00C8FF, #168BFF) and vivid violet (#8B5CF6, #A78BFA) fanning data streams
 * - Dense digital symbols (+, o, O, 0, 1, x, H, N, micro-nodes) traveling along curved trajectories
 * - Stepped electric bus lines entering the 5 vertical 9:16 clips on the right
 * - High-visibility luminous styling (not faint lines) with pure negative space protecting center text
 */

import React from "react";

// Left Ray Stream Paths (fanning out from left edge toward center)
export const LEFT_RAY_PATHS = [
  { id: "ray-l0", d: "M 40 40 L 260 120 L 440 220 L 580 320 L 680 430", color: "#8B5CF6" },
  { id: "ray-l1", d: "M 40 80 L 280 150 L 460 250 L 600 350 L 700 440", color: "#168BFF" },
  { id: "ray-l2", d: "M 40 130 L 260 200 L 450 300 L 620 390 L 710 445", color: "#00C8FF" },
  { id: "ray-l3", d: "M 40 190 L 280 250 L 460 340 L 630 410 L 715 450", color: "#8B5CF6" },
  { id: "ray-l4", d: "M 40 260 L 290 310 L 480 375 L 640 430 L 720 455", color: "#00C8FF" },
  { id: "ray-l5", d: "M 40 340 L 270 370 L 470 415 L 640 450 L 720 460", color: "#168BFF" },
  { id: "ray-l6", d: "M 40 430 L 280 430 L 480 455 L 640 470 L 720 465", color: "#8B5CF6" },
  { id: "ray-l7", d: "M 40 530 L 290 500 L 490 495 L 640 485 L 720 470", color: "#00C8FF" },
  { id: "ray-l8", d: "M 40 640 L 300 570 L 500 525 L 650 500 L 720 475", color: "#168BFF" },
  { id: "ray-l9", d: "M 40 760 L 320 650 L 520 565 L 660 515 L 720 480", color: "#8B5CF6" },
];

// Right Bus Stream Paths (stepped lines fanning cleanly into the 5 right vertical clips)
export const RIGHT_BUS_PATHS = [
  // Clip 1 (top right)
  { id: "bus-r0", d: "M 720 420 H 850 V 120 H 1270", color: "#00C8FF", targetIdx: 0 },
  { id: "bus-r1", d: "M 720 430 H 870 V 155 H 1280", color: "#168BFF", targetIdx: 0 },
  // Clip 2 (upper mid right - prominent foreground)
  { id: "bus-r2", d: "M 720 435 H 890 V 225 H 1105", color: "#00C8FF", targetIdx: 1 },
  { id: "bus-r3", d: "M 720 440 H 910 V 265 H 1115", color: "#8B5CF6", targetIdx: 1 },
  // Clip 3 (mid right - supporting)
  { id: "bus-r4", d: "M 720 445 H 930 V 330 H 1270", color: "#00C8FF", targetIdx: 2 },
  { id: "bus-r5", d: "M 720 450 H 940 V 365 H 1280", color: "#168BFF", targetIdx: 2 },
  // Clip 4 (lower mid right - prominent foreground)
  { id: "bus-r6", d: "M 720 455 H 920 V 435 H 1120", color: "#00C8FF", targetIdx: 3 },
  { id: "bus-r7", d: "M 720 460 H 900 V 470 H 1130", color: "#8B5CF6", targetIdx: 3 },
  // Clip 5 (bottom right - supporting)
  { id: "bus-r8", d: "M 720 465 H 880 V 540 H 1260", color: "#00C8FF", targetIdx: 4 },
  { id: "bus-r9", d: "M 720 470 H 860 V 580 H 1270", color: "#168BFF", targetIdx: 4 },
];

// Digital Symbols for the left fanning rays (as seen in visual reference)
const GLYPH_STRINGS = [
  "+  o  O  +  o  +  o  O  +",
  "0  1  0  0  1  1  0  1  0",
  "H  O  N  H  O  N  H  O  N",
  "+  x  +  x  +  x  +  x  +",
  "o  O  o  o  O  o  o  O  o",
  "+  +  o  +  +  o  +  +  o",
  "0  1  1  0  1  0  1  1  0",
  "N  H  O  N  H  O  N  H  O",
  "+  o  +  x  +  o  +  x  +",
  "1  0  1  0  1  0  1  0  1",
];

interface HeroDataNetworkProps {
  activeSourceIndex: number;
  pulsePhase: "idle" | "extracting" | "processing" | "distributing";
}

export default function HeroDataNetwork({
  activeSourceIndex,
  pulsePhase,
}: HeroDataNetworkProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none transform-gpu will-change-transform">
      {/* ── TOP-LEFT GLOWING DIGITAL PIXEL GLYPH (Matches reference) ── */}
      <div className="hidden xl:block absolute top-5 left-5 z-10 opacity-80 filter drop-shadow-[0_0_16px_rgba(0,200,255,0.6)]">
        <img
          src="/digital_plus_glyph.png"
          alt=""
          className="w-14 h-auto object-contain mix-blend-screen opacity-90"
        />
      </div>

      <svg
        className="hidden xl:block absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 780"
      >
        <defs>
          {/* Luminous Glow Filters */}
          <filter id="glow-cyan-bright" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="glow-violet-bright" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Center mask guaranteeing clear negative space around center text */}
          <radialGradient id="centerFadeMask" cx="50%" cy="50%" r="42%">
            <stop offset="0%" stopColor="black" />
            <stop offset="55%" stopColor="black" />
            <stop offset="88%" stopColor="white" />
            <stop offset="100%" stopColor="white" />
          </radialGradient>
          <mask id="heroCenterMask">
            <rect width="1440" height="780" fill="url(#centerFadeMask)" />
          </mask>
        </defs>

        {/* ── LEFT ZONE: FANNING ELECTRIC DATA RAYS & DIGITAL GLYPHS ── */}
        <g mask="url(#heroCenterMask)">
          {LEFT_RAY_PATHS.map((ray, idx) => (
            <g key={ray.id}>
              {/* Electric Beam Track */}
              <path
                d={ray.d}
                fill="none"
                stroke={ray.color}
                strokeWidth={idx % 2 === 0 ? "1.8" : "1.2"}
                strokeOpacity="0.55"
                filter="url(#glow-cyan-bright)"
              />
              <path
                d={ray.d}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="0.6"
                strokeOpacity="0.7"
              />

              {/* Digital Glyphs Following the Ray (Exact match to reference) */}
              <text
                fill={ray.color}
                fontSize="9.5"
                fontFamily="monospace"
                fontWeight="bold"
                letterSpacing="5"
                opacity="0.8"
                filter="url(#glow-cyan-bright)"
              >
                <textPath href={`#${ray.id}`} startOffset={`${(idx * 7) % 30}%`}>
                  {GLYPH_STRINGS[idx % GLYPH_STRINGS.length]}
                </textPath>
              </text>

              {/* Moving data packets along rays */}
              <circle r="2.8" fill="#00C8FF" filter="url(#glow-cyan-bright)">
                <animateMotion
                  dur={`${2.2 + (idx % 3) * 0.4}s`}
                  repeatCount="indefinite"
                  path={ray.d}
                  keyPoints="0;1"
                  keyTimes="0;1"
                />
              </circle>
              {idx % 2 === 0 && (
                <rect width="4.5" height="4.5" rx="1" fill="#FFFFFF" opacity="0.9">
                  <animateMotion
                    dur={`${2.6 + (idx % 2) * 0.5}s`}
                    begin="0.8s"
                    repeatCount="indefinite"
                    path={ray.d}
                    keyPoints="0;1"
                    keyTimes="0;1"
                  />
                </rect>
              )}
            </g>
          ))}
        </g>


        {/* ── RIGHT ZONE: STEPPED ELECTRIC BUS LINES & GLYPH DATA ── */}
        <g mask="url(#heroCenterMask)">
          {RIGHT_BUS_PATHS.map((bus, idx) => (
            <g key={bus.id}>
              {/* Stepped Bus Track */}
              <path
                d={bus.d}
                fill="none"
                stroke={bus.color}
                strokeWidth={idx % 2 === 0 ? "1.8" : "1.2"}
                strokeOpacity="0.65"
                filter="url(#glow-cyan-bright)"
              />
              <path
                d={bus.d}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="0.6"
                strokeOpacity="0.75"
              />

              {/* Digital Glyphs along Right Bus Tracks */}
              <text
                fill={bus.color}
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight="bold"
                letterSpacing="4"
                opacity="0.85"
                filter="url(#glow-cyan-bright)"
              >
                <textPath href={`#${bus.id}`} startOffset={`${40 + ((idx * 8) % 35)}%`}>
                  {idx % 2 === 0 ? "+  x  +  o  +  o" : "1  0  1  1  0  1"}
                </textPath>
              </text>

              {/* Corner Connection Node */}
              <circle
                cx={idx < 5 ? 850 + idx * 20 : 860 + (idx - 5) * 20}
                cy={bus.d.includes("V 80") ? 80 : bus.d.includes("V 125") ? 125 : bus.d.includes("V 200") ? 200 : bus.d.includes("V 245") ? 245 : bus.d.includes("V 305") ? 305 : bus.d.includes("V 350") ? 350 : bus.d.includes("V 435") ? 435 : bus.d.includes("V 480") ? 480 : bus.d.includes("V 585") ? 585 : 640}
                r="2.8"
                fill="#00C8FF"
                filter="url(#glow-cyan-bright)"
              />

              {/* Moving data packets into right vertical cards */}
              <circle r="2.8" fill="#00C8FF" filter="url(#glow-cyan-bright)">
                <animateMotion
                  dur={`${2.0 + (idx % 3) * 0.3}s`}
                  repeatCount="indefinite"
                  path={bus.d}
                  keyPoints="0;1"
                  keyTimes="0;1"
                />
              </circle>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
