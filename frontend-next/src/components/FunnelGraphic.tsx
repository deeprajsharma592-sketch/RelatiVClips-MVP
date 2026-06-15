"use client";

/**
 * FunnelGraphic — Static, unmoving glassmorphic funnel SVG.
 *
 * This is the centerpiece of the new landing page hero. It uses real
 * glassmorphism (backdrop-filter blur) over a layered gradient body
 * with subtle inner glow + accent particles. The whole composition
 * is intentionally static (no transforms, no animation) so it
 * reads as a "fixed piece of the brand", not another parallax layer.
 *
 * The funnel represents: 1 long-form video → 10 short-form clips.
 * Wide at top (one source), narrow at bottom (refined output).
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
        viewBox="0 0 520 620"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2001/svg"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Outer glass body gradient — warm cream → fuchsia → gold */}
          <linearGradient id="funnelBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(252, 211, 77, 0.18)" />
            <stop offset="35%" stopColor="rgba(217, 70, 239, 0.14)" />
            <stop offset="70%" stopColor="rgba(245, 158, 11, 0.16)" />
            <stop offset="100%" stopColor="rgba(217, 70, 239, 0.22)" />
          </linearGradient>

          {/* Inner core — brighter, narrower */}
          <linearGradient id="funnelCore" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 245, 220, 0.55)" />
            <stop offset="50%" stopColor="rgba(255, 210, 240, 0.35)" />
            <stop offset="100%" stopColor="rgba(252, 211, 77, 0.40)" />
          </linearGradient>

          {/* Edge highlight stroke */}
          <linearGradient id="funnelEdge" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(252, 211, 77, 0.85)" />
            <stop offset="50%" stopColor="rgba(217, 70, 239, 0.55)" />
            <stop offset="100%" stopColor="rgba(245, 158, 11, 0.75)" />
          </linearGradient>

          {/* Top rim — wide, golden */}
          <linearGradient id="funnelRim" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(252, 211, 77, 0.45)" />
            <stop offset="100%" stopColor="rgba(252, 211, 77, 0.05)" />
          </linearGradient>

          {/* Bottom spout — narrow, focused */}
          <linearGradient id="funnelSpout" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(217, 70, 239, 0.55)" />
            <stop offset="100%" stopColor="rgba(245, 158, 11, 0.85)" />
          </linearGradient>

          {/* Soft inner shadow blur */}
          <filter id="funnelSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>

          {/* Background grid (subtle, behind the funnel) */}
          <pattern id="funnelGrid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(40, 30, 20, 0.04)" strokeWidth="0.5" />
          </pattern>

          {/* Clip path matching the funnel shape for grid + accents */}
          <clipPath id="funnelClip">
            <path d="
              M 60 60
              L 460 60
              C 460 60 430 240 380 380
              C 340 480 310 540 260 560
              C 210 540 180 480 140 380
              C 90 240 60 60 60 60
              Z
            " />
          </clipPath>
        </defs>

        {/* Subtle grid fill inside funnel — adds texture without noise */}
        <g clipPath="url(#funnelClip)">
          <rect x="0" y="0" width="520" height="620" fill="url(#funnelGrid)" />
        </g>

        {/* Funnel body — main glass surface */}
        <path
          d="
            M 60 60
            L 460 60
            C 460 60 430 240 380 380
            C 340 480 310 540 260 560
            C 210 540 180 480 140 380
            C 90 240 60 60 60 60
            Z
          "
          fill="url(#funnelBody)"
          stroke="url(#funnelEdge)"
          strokeWidth="1.25"
          filter="url(#funnelSoft)"
        />

        {/* Inner core — narrower highlight to suggest depth */}
        <path
          d="
            M 110 100
            L 410 100
            C 410 100 386 240 348 360
            C 316 444 290 500 260 518
            C 230 500 204 444 172 360
            C 134 240 110 100 110 100
            Z
          "
          fill="url(#funnelCore)"
          opacity="0.55"
        />

        {/* Top rim ellipse — wide opening */}
        <ellipse
          cx="260"
          cy="60"
          rx="200"
          ry="14"
          fill="url(#funnelRim)"
          stroke="rgba(252, 211, 77, 0.55)"
          strokeWidth="1"
        />
        <ellipse
          cx="260"
          cy="60"
          rx="186"
          ry="9"
          fill="rgba(255, 255, 255, 0.35)"
        />

        {/* Bottom spout ellipse — narrow output */}
        <ellipse
          cx="260"
          cy="560"
          rx="44"
          ry="6"
          fill="url(#funnelSpout)"
          stroke="rgba(245, 158, 11, 0.75)"
          strokeWidth="1"
        />

        {/* Central vertical "flow" line — the path through the funnel */}
        <line
          x1="260"
          y1="68"
          x2="260"
          y2="555"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="0.75"
          strokeDasharray="2 6"
        />

        {/* Accent particles inside the funnel — fixed, not animated */}
        <g opacity="0.9">
          <circle cx="180" cy="160" r="2.5" fill="rgba(252, 211, 77, 0.85)" />
          <circle cx="340" cy="200" r="2" fill="rgba(217, 70, 239, 0.85)" />
          <circle cx="220" cy="280" r="1.5" fill="rgba(245, 158, 11, 0.85)" />
          <circle cx="300" cy="320" r="2.5" fill="rgba(252, 211, 77, 0.75)" />
          <circle cx="260" cy="400" r="2" fill="rgba(255, 119, 233, 0.85)" />
          <circle cx="245" cy="460" r="1.5" fill="rgba(252, 211, 77, 0.75)" />
          <circle cx="275" cy="500" r="2" fill="rgba(245, 158, 11, 0.85)" />
        </g>

        {/* Φ symbol floating above the funnel mouth — brand mark */}
        <g transform="translate(260, 32)">
          <circle r="14" fill="rgba(255, 255, 255, 0.85)" stroke="rgba(252, 211, 77, 0.7)" strokeWidth="1" />
          <text
            x="0"
            y="1"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="16"
            fontWeight="600"
            fontFamily="ui-serif, Georgia, serif"
            fill="#1A1814"
          >
            Φ
          </text>
        </g>

        {/* "Output" label below spout */}
        <g transform="translate(260, 590)">
          <rect x="-32" y="-9" width="64" height="18" rx="9" fill="rgba(255, 255, 255, 0.7)" stroke="rgba(40, 30, 20, 0.12)" strokeWidth="0.5" />
          <text
            x="0"
            y="1"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fontWeight="600"
            fontFamily="ui-monospace, SFMono-Regular, monospace"
            letterSpacing="0.12em"
            fill="#3A3530"
          >
            10× CLIPS
          </text>
        </g>

        {/* "Source" label above rim */}
        <g transform="translate(260, 14)">
          <rect x="-44" y="-9" width="88" height="18" rx="9" fill="rgba(255, 255, 255, 0.7)" stroke="rgba(40, 30, 20, 0.12)" strokeWidth="0.5" />
          <text
            x="0"
            y="1"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fontWeight="600"
            fontFamily="ui-monospace, SFMono-Regular, monospace"
            letterSpacing="0.12em"
            fill="#3A3530"
          >
            1× SOURCE
          </text>
        </g>
      </svg>
    </div>
  );
}
