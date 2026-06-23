"use client";

/**
 * BentoGrid — Apple/Magic UI style feature grid.
 *
 * 3 clean rounded bento boxes with micro-interactions:
 *   - Hover: subtle glow + slight scale + border brighten
 *   - Cards have accent colors and icons
 *   - Clean typography, no clutter
 */

import { motion } from "framer-motion";
import { Zap, Palette, Users } from "lucide-react";

const BENTO_CARDS = [
  {
    icon: Zap,
    label: "THE ENGINE",
    title: "Paste a URL.\nGet clips.",
    body: "45 seconds from YouTube link to 10 ready-to-post clips. Whisper transcribes. Claude scores hook dimensions. FFmpeg renders H.264.",
    accent: "#D946EF",
    accentDim: "rgba(217,70,239,0.12)",
    href: "/services",
    cta: "See how it works",
  },
  {
    icon: Palette,
    label: "BRAND STORIES",
    title: "Organic that\nactually works.",
    body: "Brand campaigns calibrated to creator taste profiles. Transparent performance data. Measurable ROI — not guesswork.",
    accent: "#F59E0B",
    accentDim: "rgba(245,158,11,0.12)",
    href: "/brands",
    cta: "For brands",
  },
  {
    icon: Users,
    label: "CLIPPER ECOSYSTEM",
    title: "Editors with\nspecializations.",
    body: "A marketplace where clippers build taste reputations. Different editors, different strengths. Creators pick who fits.",
    accent: "#06B6D4",
    accentDim: "rgba(6,182,212,0.12)",
    href: "/clippers",
    cta: "For clippers",
  },
];

const cardVariants = {
  initial: { opacity: 0, y: 24 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.1, duration: 0.5 },
  }),
};

export default function BentoGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {BENTO_CARDS.map((card, i) => (
        <motion.a
          key={card.label}
          href={card.href}
          custom={i}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-80px" }}
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="group relative block rounded-2xl overflow-hidden cursor-pointer"
          style={{
            background: card.accentDim,
            border: `1px solid ${card.accent}30`,
            boxShadow: `0 0 0 0 ${card.accent}00`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = `${card.accent}60`;
            (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${card.accent}20, 0 0 0 1px ${card.accent}30`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = `${card.accent}30`;
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 ${card.accent}00`;
          }}
        >
          {/* Top accent bar */}
          <div
            className="h-1 w-full"
            style={{ background: `linear-gradient(90deg, ${card.accent} 0%, transparent 100%)` }}
          />

          <div className="p-7">
            {/* Icon + label row */}
            <div className="flex items-center justify-between mb-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `${card.accent}20`,
                  border: `1px solid ${card.accent}40`,
                }}
              >
                <card.icon className="h-5 w-5" style={{ color: card.accent }} />
              </div>
              <span
                className="text-[10px] font-mono uppercase tracking-widest"
                style={{ color: "var(--color-text-muted)" }}
              >
                {card.label}
              </span>
            </div>

            {/* Title */}
            <h3
              className="font-bebas text-4xl leading-[1.05] mb-4 tracking-wide"
              style={{ color: "var(--color-text-primary)" }}
            >
              {card.title.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  {i < card.title.split("\n").length - 1 && <br />}
                </span>
              ))}
            </h3>

            {/* Body */}
            <p
              className="text-[14px] leading-relaxed mb-6"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {card.body}
            </p>

            {/* CTA */}
            <span
              className="inline-flex items-center gap-2 text-[12px] font-medium transition-all group-hover:gap-3"
              style={{ color: card.accent }}
            >
              {card.cta}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="transition-transform group-hover:translate-x-0.5"
              >
                <path
                  d="M2 6h8M7 3l3 3-3 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>

          {/* Bottom glow on hover */}
          <div
            className="absolute bottom-0 left-0 right-0 h-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${card.accent} 50%, transparent 100%)`,
            }}
          />
        </motion.a>
      ))}
    </div>
  );
}
