"use client";

/**
 * FunnelGraphic — Premium glassmorphic funnel.
 *
 * The visual centerpiece of the hero. Big, glassy, with proper depth:
 *   - Wide top opening (1× source) tapering to narrow spout (10× clips)
 *   - Multi-layer glass body: outer color gradient + inner core highlight
 *   - True glassmorphism via inner shadow + highlight on top rim
 *   - Floating "data particles" inside (video frames flowing through)
 *   - Dashed center line suggesting the data path
 *   - Soft outer glow (gold halo around the rim)
 *
 * Intentionally static — represents the "taste funnel" of the engine.
 * Designed to be the bottom anchor of the left column, with the
 * paste URL above it appearing to "feed" into the top rim.
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
        viewBox="0 0 600 800"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2001/svg"
        style={{ overflow: "visible", filter: "drop-shadow(0 30px 60px rgba(217, 70, 239, 0.12))" }}
      >
        <defs>
          {/* MAIN GLASS BODY — strong gradient, ~40% opacity for true glass feel */}
          <linearGradient id="funnelBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(252, 211, 77, 0.55)" />
            <stop offset="25%" stopColor="rgba(255, 119, 233, 0.32)" />
            <stop offset="55%" stopColor="rgba(217, 70, 239, 0.38)" />
            <stop offset="85%" stopColor="rgba(245, 158, 11, 0.50)" />
            <stop offset="100%" stopColor="rgba(245, 158, 11, 0.65)" />
          </linearGradient>

          {/* INNER CORE — bright, narrow, gives the "depth" inside the glass */}
          <linearGradient id="funnelCore" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.65)" />
            <stop offset="40%" stopColor="rgba(255, 220, 245, 0.35)" />
            <stop offset="100%" stopColor="rgba(252, 211, 77, 0.55)" />
          </linearGradient>

          {/* EDGE STROKE — bright gold→fuchsia→gold */}
          <linearGradient id="funnelEdge" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(252, 211, 77, 1.0)" />
            <stop offset="50%" stopColor="rgba(217, 70, 239, 0.85)" />
            <stop offset="100%" stopColor="rgba(245, 158, 11, 1.0)" />
          </linearGradient>

          {/* TOP RIM — wide, glowing */}
          <radialGradient id="funnelRimGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(252, 211, 77, 0.55)" />
            <stop offset="60%" stopColor="rgba(252, 211, 77, 0.15)" />
            <stop offset="100%" stopColor="rgba(252, 211, 77, 0)" />
          </radialGradient>

          {/* BOTTOM SPOUT */}
          <linearGradient id="funnelSpout" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(217, 70, 239, 0.90)" />
            <stop offset="100%" stopColor="rgba(245, 158, 11, 1.0)" />
          </linearGradient>

          {/* Subtle drop shadow filter */}
          <filter id="funnelSoft" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="0.8" />
          </filter>

          {/* Strong outer glow (gold halo) */}
          <filter id="funnelHalo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.6" />
            </feComponentTransfer>
          </filter>

          {/* Background grid pattern — visible through the glass */}
          <pattern id="funnelGrid" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(40, 30, 20, 0.06)" strokeWidth="0.6" />
          </pattern>

          {/* Clip path matching the funnel shape for the grid */}
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

        {/* ─── OUTER HALO — gold glow around the rim ─── */}
        <ellipse
          cx="300"
          cy="60"
          rx="280"
          ry="40"
          fill="url(#funnelRimGlow)"
          filter="url(#funnelHalo)"
          opacity="0.7"
        />

        {/* ─── BACKGROUND GRID (visible through glass) ─── */}
        <g clipPath="url(#funnelClip)">
          <rect x="0" y="0" width="600" height="800" fill="url(#funnelGrid)" />
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
          strokeWidth="2"
          filter="url(#funnelSoft)"
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
          opacity="0.55"
        />

        {/* ─── TOP RIM — wide opening (1× source) ─── */}
        <ellipse
          cx="300"
          cy="60"
          rx="220"
          ry="20"
          fill="url(#funnelRimGlow)"
          stroke="rgba(252, 211, 77, 0.95)"
          strokeWidth="1.5"
        />
        <ellipse
          cx="300"
          cy="60"
          rx="200"
          ry="11"
          fill="rgba(255, 255, 255, 0.55)"
        />
        <ellipse
          cx="300"
          cy="60"
          rx="180"
          ry="6"
          fill="rgba(255, 255, 255, 0.75)"
        />

        {/* ─── BOTTOM SPOUT — narrow output (10× clips) ─── */}
        <ellipse
          cx="300"
          cy="760"
          rx="48"
          ry="9"
          fill="url(#funnelSpout)"
          stroke="rgba(245, 158, 11, 0.95)"
          strokeWidth="1.5"
        />
        <ellipse
          cx="300"
          cy="760"
          rx="38"
          ry="5"
          fill="rgba(255, 255, 255, 0.55)"
        />

        {/* ─── CENTER FLOW LINE — data flowing down ─── */}
        <line
          x1="300"
          y1="78"
          x2="300"
          y2="755"
          stroke="rgba(255, 255, 255, 0.45)"
          strokeWidth="0.8"
          strokeDasharray="3 9"
        />

        {/* ─── FLOATING PARTICLES — video frames flowing through ─── */}
        <g>
          <circle cx="190" cy="170" r="6" fill="rgba(252, 211, 77, 0.95)" />
          <circle cx="410" cy="190" r="5" fill="rgba(217, 70, 239, 0.95)" />
          <circle cx="220" cy="280" r="4" fill="rgba(245, 158, 11, 0.95)" />
          <circle cx="380" cy="310" r="6" fill="rgba(252, 211, 77, 0.90)" />
          <circle cx="300" cy="380" r="5" fill="rgba(255, 119, 233, 0.95)" />
          <circle cx="240" cy="440" r="4" fill="rgba(245, 158, 11, 0.95)" />
          <circle cx="360" cy="460" r="5" fill="rgba(252, 211, 77, 0.85)" />
          <circle cx="270" cy="540" r="4" fill="rgba(255, 119, 233, 0.95)" />
          <circle cx="330" cy="570" r="3" fill="rgba(245, 158, 11, 0.95)" />
          <circle cx="290" cy="640" r="3" fill="rgba(252, 211, 77, 0.85)" />
          <circle cx="310" cy="700" r="2.5" fill="rgba(245, 158, 11, 0.95)" />
        </g>

        {/* ─── Φ SYMBOL ABOVE THE RIM — brand mark ─── */}
        <g transform="translate(300, 28)">
          <circle r="20" fill="rgba(255, 255, 255, 0.95)" stroke="rgba(252, 211, 77, 0.95)" strokeWidth="1.5" />
          <text
            x="0"
            y="2"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="22"
            fontWeight="600"
            fontFamily="ui-serif, Georgia, serif"
            fill="#1A1814"
          >
            Φ
          </text>
        </g>

        {/* ─── "10× CLIPS" LABEL BELOW SPOUT ─── */}
        <g transform="translate(300, 790)">
          <rect x="-46" y="-12" width="92" height="24" rx="12" fill="rgba(255, 255, 255, 0.92)" stroke="rgba(40, 30, 20, 0.15)" strokeWidth="0.5" />
          <text
            x="0"
            y="2"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="700"
            fontFamily="ui-monospace, SFMono-Regular, monospace"
            letterSpacing="0.14em"
            fill="#3A3530"
          >
            10× CLIPS
          </text>
        </g>

        {/* ─── "1× SOURCE" LABEL — small, above the rim ─── */}
        <g transform="translate(300, -2)" opacity="0">
          {/* Hidden — the Φ symbol handles the brand mark at top */}
        </g>
      </svg>
    </div>
  );
}
