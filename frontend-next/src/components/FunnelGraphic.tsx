"use client";

/**
 * FunnelGraphic — Premium glassmorphic funnel (v3).
 *
 * Improvements over v2:
 *  - STRONGER color saturation (50-70% opacity, was 18-30%) for true glass feel
 *  - Visible "behind the glass" grid pattern (subtle, not in your face)
 *  - Multi-layer rim: outer halo + glass body + inner highlight
 *  - 13 floating particles in a vertical flow pattern
 *  - Drop-shadow + filter blur on the body
 *  - "Video frames" stack at the rim (top) and "clips" stack at the spout (bottom)
 *    so the funnel reads as actively processing, not just a static shape
 *  - Stronger gold halo glow around the top rim
 *
 * Static, anchored at the bottom of the left hero column. The paste URL
 * sits above it and visually "feeds" the top rim via a small "drip" tube
 * (rendered separately in page.tsx).
 */

interface FunnelGraphicProps {
  className?: string;
}

export default function FunnelGraphic({ className = "" }: FunnelGraphicProps) {
  return (
    <div
      className={`pointer-events-none select-none ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 600 820"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2001/svg"
        style={{
          overflow: "visible",
          filter: "drop-shadow(0 30px 50px rgba(217, 70, 239, 0.18)) drop-shadow(0 10px 30px rgba(252, 211, 77, 0.10))",
        }}
      >
        <defs>
          {/* MAIN GLASS BODY — strong, saturated, real glass feel */}
          <linearGradient id="funnelBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(252, 211, 77, 0.70)" />
            <stop offset="22%" stopColor="rgba(255, 119, 233, 0.45)" />
            <stop offset="48%" stopColor="rgba(217, 70, 239, 0.55)" />
            <stop offset="78%" stopColor="rgba(245, 158, 11, 0.65)" />
            <stop offset="100%" stopColor="rgba(245, 158, 11, 0.80)" />
          </linearGradient>

          {/* INNER CORE — bright, narrow, suggests glass depth */}
          <linearGradient id="funnelCore" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.80)" />
            <stop offset="35%" stopColor="rgba(255, 220, 245, 0.45)" />
            <stop offset="70%" stopColor="rgba(252, 211, 77, 0.55)" />
            <stop offset="100%" stopColor="rgba(245, 158, 11, 0.70)" />
          </linearGradient>

          {/* EDGE STROKE — bright 3-stop gradient */}
          <linearGradient id="funnelEdge" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D" stopOpacity="1" />
            <stop offset="50%" stopColor="#D946EF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="1" />
          </linearGradient>

          {/* TOP RIM GLOW — radial gold */}
          <radialGradient id="funnelRimGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(252, 211, 77, 0.85)" />
            <stop offset="40%" stopColor="rgba(252, 211, 77, 0.35)" />
            <stop offset="100%" stopColor="rgba(252, 211, 77, 0)" />
          </radialGradient>

          {/* BOTTOM SPOUT GRADIENT */}
          <linearGradient id="funnelSpout" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D946EF" stopOpacity="1" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="1" />
          </linearGradient>

          {/* BEHIND THE GLASS — subtle grid pattern (visible through transparency) */}
          <pattern id="funnelGrid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(40, 30, 20, 0.10)" strokeWidth="0.6" />
          </pattern>

          {/* Video frame thumbnail mock (for the "input" stack) */}
          <linearGradient id="videoMock1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD166" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="videoMock2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF77E9" />
            <stop offset="100%" stopColor="#D946EF" />
          </linearGradient>
          <linearGradient id="videoMock3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>

          {/* Clip output thumbnail mock (for the "output" stack) */}
          <linearGradient id="clipMock1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <linearGradient id="clipMock2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <linearGradient id="clipMock3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D946EF" />
          </linearGradient>

          {/* Halo blur for outer glow */}
          <filter id="funnelHalo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="18" />
          </filter>

          {/* Soft blur for body */}
          <filter id="funnelSoft" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>

          {/* Drop shadow filter */}
          <filter id="funnelShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="8" />
            <feOffset dx="0" dy="12" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.25" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Clip path for the grid (matches the funnel body) */}
          <clipPath id="funnelClip">
            <path d="
              M 80 60
              L 520 60
              C 520 60 460 350 360 600
              C 340 660 320 720 300 760
              C 280 720 260 660 240 600
              C 140 350 80 60 80 60
              Z
            " />
          </clipPath>
        </defs>

        {/* ─── OUTER GOLD HALO (around the top rim) ─── */}
        <ellipse
          cx="300"
          cy="55"
          rx="320"
          ry="50"
          fill="url(#funnelRimGlow)"
          filter="url(#funnelHalo)"
          opacity="0.85"
        />

        {/* ─── INPUT VIDEO THUMBNAIL STACK (left of rim) ───
            Three small "video card" mockups at the top-left, showing
            the user that real video URLs get dropped in here. */}
        <g transform="translate(40, 90)">
          {/* Card 1 (back) */}
          <g transform="rotate(-8 0 30)">
            <rect x="0" y="0" width="68" height="44" rx="6" fill="url(#videoMock2)" opacity="0.85" />
            <rect x="0" y="0" width="68" height="44" rx="6" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
            <circle cx="34" cy="22" r="6" fill="rgba(255,255,255,0.95)" />
            <polygon points="32,19 32,25 38,22" fill="#D946EF" />
          </g>
          {/* Card 2 (middle) */}
          <g transform="rotate(-3 0 50) translate(0, 30)">
            <rect x="0" y="0" width="68" height="44" rx="6" fill="url(#videoMock3)" opacity="0.9" />
            <rect x="0" y="0" width="68" height="44" rx="6" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
            <circle cx="34" cy="22" r="6" fill="rgba(255,255,255,0.95)" />
            <polygon points="32,19 32,25 38,22" fill="#06B6D4" />
          </g>
          {/* Card 3 (front) */}
          <g transform="rotate(2 0 70) translate(0, 60)">
            <rect x="0" y="0" width="68" height="44" rx="6" fill="url(#videoMock1)" />
            <rect x="0" y="0" width="68" height="44" rx="6" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
            <circle cx="34" cy="22" r="6" fill="rgba(255,255,255,0.95)" />
            <polygon points="32,19 32,25 38,22" fill="#F59E0B" />
          </g>
        </g>

        {/* ─── INPUT VIDEO THUMBNAIL STACK (right of rim) ─── */}
        <g transform="translate(492, 90)">
          <g transform="rotate(8 68 30)">
            <rect x="0" y="0" width="68" height="44" rx="6" fill="url(#videoMock1)" opacity="0.85" />
            <rect x="0" y="0" width="68" height="44" rx="6" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
            <circle cx="34" cy="22" r="6" fill="rgba(255,255,255,0.95)" />
            <polygon points="32,19 32,25 38,22" fill="#F59E0B" />
          </g>
          <g transform="rotate(3 68 50) translate(0, 30)">
            <rect x="0" y="0" width="68" height="44" rx="6" fill="url(#videoMock2)" opacity="0.9" />
            <rect x="0" y="0" width="68" height="44" rx="6" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
            <circle cx="34" cy="22" r="6" fill="rgba(255,255,255,0.95)" />
            <polygon points="32,19 32,25 38,22" fill="#D946EF" />
          </g>
          <g transform="rotate(-2 68 70) translate(0, 60)">
            <rect x="0" y="0" width="68" height="44" rx="6" fill="url(#videoMock3)" />
            <rect x="0" y="0" width="68" height="44" rx="6" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
            <circle cx="34" cy="22" r="6" fill="rgba(255,255,255,0.95)" />
            <polygon points="32,19 32,25 38,22" fill="#06B6D4" />
          </g>
        </g>

        {/* ─── BEHIND THE GLASS — grid pattern (shows the funnel is glass) ─── */}
        <g clipPath="url(#funnelClip)">
          <rect x="0" y="0" width="600" height="820" fill="url(#funnelGrid)" />
        </g>

        {/* ─── MAIN GLASS BODY ─── */}
        <path
          d="
            M 80 60
            L 520 60
            C 520 60 460 350 360 600
            C 340 660 320 720 300 760
            C 280 720 260 660 240 600
            C 140 350 80 60 80 60
            Z
          "
          fill="url(#funnelBody)"
          stroke="url(#funnelEdge)"
          strokeWidth="2.5"
          filter="url(#funnelShadow)"
        />

        {/* ─── INNER CORE — narrower, brighter, gives depth ─── */}
        <path
          d="
            M 130 105
            L 470 105
            C 470 105 418 350 332 580
            C 318 640 305 700 300 720
            C 295 700 282 640 268 580
            C 182 350 130 105 130 105
            Z
          "
          fill="url(#funnelCore)"
          opacity="0.65"
        />

        {/* ─── INNER SPECULAR HIGHLIGHT — a bright streak on the top-left
              of the glass body, like sunlight reflecting off glass ─── */}
        <path
          d="
            M 130 110
            C 130 110 145 200 175 320
            C 195 400 215 470 220 510
          "
          stroke="rgba(255, 255, 255, 0.55)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />

        {/* ─── TOP RIM — wide opening (multi-layer for depth) ─── */}
        <ellipse
          cx="300"
          cy="60"
          rx="220"
          ry="22"
          fill="url(#funnelRimGlow)"
          stroke="#FCD34D"
          strokeWidth="2"
        />
        <ellipse
          cx="300"
          cy="60"
          rx="200"
          ry="13"
          fill="rgba(255, 255, 255, 0.65)"
        />
        <ellipse
          cx="300"
          cy="60"
          rx="180"
          ry="7"
          fill="rgba(255, 255, 255, 0.85)"
        />

        {/* ─── BOTTOM SPOUT — narrow output ─── */}
        <ellipse
          cx="300"
          cy="760"
          rx="48"
          ry="10"
          fill="url(#funnelSpout)"
          stroke="#F59E0B"
          strokeWidth="2"
        />
        <ellipse
          cx="300"
          cy="760"
          rx="36"
          ry="5"
          fill="rgba(255, 255, 255, 0.7)"
        />

        {/* ─── OUTPUT CLIP STACK (below the spout) ───
            Three small "9:16 clip card" mockups falling out the spout. */}
        <g transform="translate(264, 778)">
          {/* Clip 1 (left, behind) */}
          <g transform="rotate(-12 18 25)">
            <rect x="0" y="0" width="24" height="40" rx="3" fill="url(#clipMock1)" />
            <rect x="0" y="0" width="24" height="40" rx="3" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />
            <circle cx="12" cy="20" r="3" fill="rgba(255,255,255,0.95)" />
          </g>
          {/* Clip 2 (middle, front) */}
          <g transform="translate(24, 0)">
            <rect x="0" y="0" width="24" height="40" rx="3" fill="url(#clipMock2)" />
            <rect x="0" y="0" width="24" height="40" rx="3" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.6" />
            <circle cx="12" cy="20" r="3" fill="rgba(255,255,255,0.95)" />
            <polygon points="10,17 10,23 16,20" fill="#A78BFA" />
          </g>
          {/* Clip 3 (right, behind) */}
          <g transform="rotate(12 66 25) translate(48, 0)">
            <rect x="0" y="0" width="24" height="40" rx="3" fill="url(#clipMock3)" opacity="0.9" />
            <rect x="0" y="0" width="24" height="40" rx="3" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />
            <circle cx="12" cy="20" r="3" fill="rgba(255,255,255,0.95)" />
          </g>
        </g>

        {/* ─── CENTER FLOW LINE — data flowing down ─── */}
        <line
          x1="300"
          y1="78"
          x2="300"
          y2="755"
          stroke="rgba(255, 255, 255, 0.55)"
          strokeWidth="1"
          strokeDasharray="3 9"
        />

        {/* ─── FLOATING PARTICLES — 13 video frames flowing through ─── */}
        <g>
          <circle cx="190" cy="170" r="7" fill="#FCD34D" opacity="0.95" />
          <circle cx="410" cy="190" r="6" fill="#D946EF" opacity="0.95" />
          <circle cx="220" cy="270" r="5" fill="#F59E0B" opacity="0.95" />
          <circle cx="380" cy="300" r="7" fill="#FCD34D" opacity="0.90" />
          <circle cx="300" cy="370" r="5" fill="#FF77E9" opacity="0.95" />
          <circle cx="240" cy="430" r="5" fill="#F59E0B" opacity="0.95" />
          <circle cx="360" cy="450" r="6" fill="#FCD34D" opacity="0.85" />
          <circle cx="270" cy="525" r="5" fill="#FF77E9" opacity="0.95" />
          <circle cx="330" cy="555" r="4" fill="#F59E0B" opacity="0.95" />
          <circle cx="290" cy="620" r="4" fill="#FCD34D" opacity="0.85" />
          <circle cx="310" cy="675" r="3" fill="#F59E0B" opacity="0.95" />
          <circle cx="300" cy="715" r="3" fill="#D946EF" opacity="0.85" />
          <circle cx="300" cy="740" r="2.5" fill="#FCD34D" opacity="0.95" />
        </g>

        {/* ─── Φ SYMBOL ABOVE THE RIM — brand mark ─── */}
        <g transform="translate(300, 22)">
          <circle r="22" fill="rgba(255, 255, 255, 0.98)" stroke="#FCD34D" strokeWidth="2" />
          <text
            x="0"
            y="2"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="24"
            fontWeight="700"
            fontFamily="ui-serif, Georgia, serif"
            fill="#1A1814"
          >
            Φ
          </text>
        </g>
      </svg>
    </div>
  );
}
