"use client";

/**
 * CascadeGraphic — Abstract glassmorphic pipeline (replaces FunnelGraphic).
 *
 * Why this shape instead of a literal funnel?
 *   - A literal wide-top-narrow-bottom funnel is too phallic / condom-like.
 *   - This is a "cascade" of distinct glassmorphic shapes (circles,
 *     diamonds, hexagons, squares) at different sizes and colors.
 *   - Reads as a "processing pipeline" — not a single taper.
 *   - Each shape is a separate stage, connected by a dashed data stream
 *     and floating particles, with the 10 output clip cards fanning out
 *     at the bottom.
 *
 * Visual story: 1 video card in → 4 processing stages → 10 clip cards out.
 *
 * Glassmorphism via SVG gradients + inner highlights + drop shadows.
 * Backdrop-filter isn't possible on SVG, so we approximate with:
 *   - Strong color saturation (50-80% opacity)
 *   - Inner specular highlight (top-left of each shape)
 *   - Outer glow halo (radial gradient)
 *   - Subtle inner shadow (bottom-right)
 *   - Background grid pattern showing through
 */

interface CascadeGraphicProps {
  className?: string;
}

const SHAPES = [
  // Each stage: x-offset, y, width, fill-gradient, accent-color
  { type: "circle", cx: 300, cy: 70,  r: 56, fill: "rgba(252, 211, 77, 0.85)",  stroke: "#FCD34D", label: "1×" },
  { type: "diamond", cx: 300, cy: 200, r: 52, fill: "rgba(255, 119, 233, 0.75)", stroke: "#FF77E9", label: "Φ" },
  { type: "hexagon", cx: 300, cy: 330, r: 48, fill: "rgba(217, 70, 239, 0.80)", stroke: "#D946EF", label: "Φ" },
  { type: "square",  cx: 300, cy: 460, r: 44, fill: "rgba(245, 158, 11, 0.85)",  stroke: "#F59E0B", label: "★" },
] as const;

export default function CascadeGraphic({ className = "" }: CascadeGraphicProps) {
  return (
    <div
      className={`pointer-events-none select-none ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 600 720"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          overflow: "visible",
          filter: "drop-shadow(0 30px 50px rgba(217, 70, 239, 0.15))",
        }}
      >
        <defs>
          {/* Soft inner highlight (top-left of glass) */}
          <linearGradient id="hl" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.85)" />
            <stop offset="50%" stopColor="rgba(255, 255, 255, 0.1)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </linearGradient>

          {/* Gold halo glow */}
          <radialGradient id="halo-gold" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(252, 211, 77, 0.7)" />
            <stop offset="50%" stopColor="rgba(252, 211, 77, 0.2)" />
            <stop offset="100%" stopColor="rgba(252, 211, 77, 0)" />
          </radialGradient>

          {/* Fuchsia halo glow */}
          <radialGradient id="halo-pink" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 119, 233, 0.65)" />
            <stop offset="50%" stopColor="rgba(255, 119, 233, 0.18)" />
            <stop offset="100%" stopColor="rgba(255, 119, 233, 0)" />
          </radialGradient>

          {/* Purple halo glow */}
          <radialGradient id="halo-purple" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(217, 70, 239, 0.7)" />
            <stop offset="50%" stopColor="rgba(217, 70, 239, 0.2)" />
            <stop offset="100%" stopColor="rgba(217, 70, 239, 0)" />
          </radialGradient>

          {/* Amber halo glow */}
          <radialGradient id="halo-amber" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(245, 158, 11, 0.7)" />
            <stop offset="50%" stopColor="rgba(245, 158, 11, 0.2)" />
            <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
          </radialGradient>

          {/* Halo blur */}
          <filter id="halo-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>

          {/* Subtle grid behind the glass */}
          <pattern id="cascadeGrid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(40, 30, 20, 0.08)" strokeWidth="0.6" />
          </pattern>

          {/* Card mock gradients (for input video + output clips) */}
          <linearGradient id="cardMock1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD166" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="cardMock2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF77E9" />
            <stop offset="100%" stopColor="#D946EF" />
          </linearGradient>
          <linearGradient id="cardMock3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>
          <linearGradient id="cardMock4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>

        {/* ─── BACKGROUND GRID (shows the glass is translucent) ─── */}
        <rect x="0" y="0" width="600" height="720" fill="url(#cascadeGrid)" />

        {/* ─── DATA STREAM — vertical dashed line connecting the shapes ─── */}
        <line
          x1="300"
          y1="40"
          x2="300"
          y2="510"
          stroke="rgba(252, 211, 77, 0.4)"
          strokeWidth="1.5"
          strokeDasharray="3 9"
        />

        {/* ─── FLOATING PARTICLES along the data stream ─── */}
        {[
          { x: 295, y: 100, r: 3, c: "#FCD34D" },
          { x: 308, y: 135, r: 2.5, c: "#FF77E9" },
          { x: 298, y: 165, r: 3, c: "#D946EF" },
          { x: 305, y: 235, r: 2.5, c: "#FCD34D" },
          { x: 297, y: 265, r: 3, c: "#FF77E9" },
          { x: 304, y: 300, r: 2.5, c: "#F59E0B" },
          { x: 300, y: 365, r: 3, c: "#D946EF" },
          { x: 295, y: 395, r: 2.5, c: "#FCD34D" },
          { x: 308, y: 430, r: 3, c: "#F59E0B" },
          { x: 302, y: 495, r: 2.5, c: "#FF77E9" },
        ].map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.c} opacity="0.9" />
        ))}

        {/* ═══════════════════════════════════════════════════════════════
            SHAPE 1 — Circle (input) — gold
           ═══════════════════════════════════════════════════════════════ */}
        <circle cx="300" cy="70" r="80" fill="url(#halo-gold)" filter="url(#halo-blur)" opacity="0.6" />
        <circle
          cx="300"
          cy="70"
          r="56"
          fill="rgba(252, 211, 77, 0.80)"
          stroke="#FCD34D"
          strokeWidth="2.5"
        />
        <circle cx="300" cy="70" r="48" fill="url(#hl)" opacity="0.85" />
        <text
          x="300"
          y="70"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="22"
          fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          fill="#1A1814"
        >
          1×
        </text>

        {/* ─── Shape 1 label (above) ─── */}
        <g transform="translate(300, -2)">
          <rect x="-44" y="-12" width="88" height="22" rx="11" fill="rgba(255, 255, 255, 0.95)" stroke="#FCD34D" strokeWidth="1.5" />
          <text x="0" y="2" textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fontFamily="ui-monospace, SFMono-Regular, monospace" letterSpacing="0.14em" fill="#1A1814">
            1× SOURCE
          </text>
        </g>

        {/* ═══════════════════════════════════════════════════════════════
            SHAPE 2 — Diamond (Whisper) — fuchsia
           ═══════════════════════════════════════════════════════════════ */}
        <circle cx="300" cy="200" r="76" fill="url(#halo-pink)" filter="url(#halo-blur)" opacity="0.55" />
        <polygon
          points="300,148 352,200 300,252 248,200"
          fill="rgba(255, 119, 233, 0.70)"
          stroke="#FF77E9"
          strokeWidth="2.5"
        />
        <polygon
          points="300,158 342,200 300,242 258,200"
          fill="url(#hl)"
          opacity="0.55"
        />
        <text
          x="300"
          y="200"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="20"
          fontWeight="700"
          fontFamily="ui-serif, Georgia, serif"
          fill="#FFFFFF"
        >
          Φ
        </text>
        <text
          x="300"
          y="220"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="7"
          fontWeight="600"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          letterSpacing="0.12em"
          fill="rgba(255, 255, 255, 0.85)"
        >
          WHISPER
        </text>

        {/* ═══════════════════════════════════════════════════════════════
            SHAPE 3 — Hexagon (Librosa energy) — purple
           ═══════════════════════════════════════════════════════════════ */}
        <circle cx="300" cy="330" r="72" fill="url(#halo-purple)" filter="url(#halo-blur)" opacity="0.55" />
        <polygon
          points="300,282 348,312 348,372 300,402 252,372 252,312"
          fill="rgba(217, 70, 239, 0.75)"
          stroke="#D946EF"
          strokeWidth="2.5"
        />
        <polygon
          points="300,294 340,318 340,366 300,390 260,366 260,318"
          fill="url(#hl)"
          opacity="0.55"
        />
        <text
          x="300"
          y="338"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="20"
          fontWeight="700"
          fontFamily="ui-serif, Georgia, serif"
          fill="#FFFFFF"
        >
          Φ
        </text>
        <text
          x="300"
          y="355"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="7"
          fontWeight="600"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          letterSpacing="0.12em"
          fill="rgba(255, 255, 255, 0.85)"
        >
          LIBROSA
        </text>

        {/* ═══════════════════════════════════════════════════════════════
            SHAPE 4 — Square (Claude hook score) — gold
           ═══════════════════════════════════════════════════════════════ */}
        <circle cx="300" cy="460" r="68" fill="url(#halo-amber)" filter="url(#halo-blur)" opacity="0.55" />
        <rect
          x="256"
          y="416"
          width="88"
          height="88"
          rx="14"
          fill="rgba(245, 158, 11, 0.80)"
          stroke="#F59E0B"
          strokeWidth="2.5"
        />
        <rect
          x="262"
          y="422"
          width="76"
          height="76"
          rx="10"
          fill="url(#hl)"
          opacity="0.55"
        />
        <text
          x="300"
          y="465"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="20"
          fontWeight="700"
          fontFamily="ui-serif, Georgia, serif"
          fill="#FFFFFF"
        >
          Φ
        </text>
        <text
          x="300"
          y="482"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="7"
          fontWeight="600"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          letterSpacing="0.12em"
          fill="rgba(255, 255, 255, 0.85)"
        >
          CLAUDE
        </text>

        {/* ═══════════════════════════════════════════════════════════════
            OUTPUT — 10 clip cards fanning out
           ═══════════════════════════════════════════════════════════════ */}
        {/* Connection lines from shape 4 to each output card */}
        {[
          { x: 105, g: "cardMock1" },
          { x: 165, g: "cardMock2" },
          { x: 225, g: "cardMock3" },
          { x: 285, g: "cardMock1" },
          { x: 345, g: "cardMock4" },
          { x: 405, g: "cardMock2" },
          { x: 465, g: "cardMock3" },
          { x: 525, g: "cardMock1" },
        ].map((c, i) => (
          <line
            key={i}
            x1="300"
            y1="500"
            x2={c.x}
            y2="560"
            stroke="rgba(245, 158, 11, 0.4)"
            strokeWidth="1"
            strokeDasharray="2 5"
          />
        ))}

        {/* 8 output clip cards in a row (4-col grid feel) */}
        {[
          { x: 105, g: "cardMock1" },
          { x: 165, g: "cardMock2" },
          { x: 225, g: "cardMock3" },
          { x: 285, g: "cardMock1" },
          { x: 345, g: "cardMock4" },
          { x: 405, g: "cardMock2" },
          { x: 465, g: "cardMock3" },
          { x: 525, g: "cardMock1" },
        ].map((c, i) => (
          <g key={i} transform={`translate(${c.x - 24}, 562)`}>
            <rect
              x="0"
              y="0"
              width="48"
              height="80"
              rx="6"
              fill={`url(#${c.g})`}
            />
            <rect
              x="0"
              y="0"
              width="48"
              height="80"
              rx="6"
              fill="rgba(255, 255, 255, 0.15)"
            />
            <rect
              x="0"
              y="0"
              width="48"
              height="80"
              rx="6"
              fill="none"
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth="1"
            />
            <circle cx="24" cy="40" r="9" fill="rgba(15, 13, 10, 0.55)" />
            <polygon points="20,34 20,46 32,40" fill="#FFFFFF" />
            <text
              x="24"
              y="76"
              textAnchor="middle"
              fontSize="6"
              fontWeight="600"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              letterSpacing="0.08em"
              fill="rgba(15, 13, 10, 0.7)"
            >
              0:1{i}s
            </text>
          </g>
        ))}

        {/* Second row of 2 clip cards (8 + 2 = 10) */}
        <g transform="translate(225, 660)">
          <rect
            x="0"
            y="0"
            width="48"
            height="48"
            rx="6"
            fill="url(#cardMock4)"
          />
          <rect x="0" y="0" width="48" height="48" rx="6" fill="none" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="1" />
          <circle cx="24" cy="24" r="7" fill="rgba(15, 13, 10, 0.55)" />
          <polygon points="20,18 20,30 30,24" fill="#FFFFFF" />
        </g>
        <g transform="translate(327, 660)">
          <rect
            x="0"
            y="0"
            width="48"
            height="48"
            rx="6"
            fill="url(#cardMock2)"
          />
          <rect x="0" y="0" width="48" height="48" rx="6" fill="none" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="1" />
          <circle cx="24" cy="24" r="7" fill="rgba(15, 13, 10, 0.55)" />
          <polygon points="20,18 20,30 30,24" fill="#FFFFFF" />
        </g>

        {/* "10× CLIPS" label below */}
        <g transform="translate(300, 730)">
          <rect x="-48" y="-12" width="96" height="24" rx="12" fill="rgba(255, 255, 255, 0.95)" stroke="#F59E0B" strokeWidth="1.5" />
          <text x="0" y="2" textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fontFamily="ui-monospace, SFMono-Regular, monospace" letterSpacing="0.14em" fill="#1A1814">
            10× CLIPS
          </text>
        </g>
      </svg>
    </div>
  );
}
