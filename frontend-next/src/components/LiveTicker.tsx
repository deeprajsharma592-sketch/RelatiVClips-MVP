"use client";

import { motion } from "framer-motion";

// HONEST "what's in the engine" ticker — replaces the previous version
// that animated fake creator names and fake earnings. Pre-launch
// product, no real users yet, so the only thing honest to show is the
// engine stack itself. The marquee is still UI-only (no backend),
// but the labels are real and verifiable in the GitHub repo.

type TechItem = {
  label: string;
  note: string;
};

const STACK: TechItem[] = [
  { label: "Claude Haiku 4.5", note: "hook calibration · ICL prompt" },
  { label: "faster-whisper", note: "CPU int8 · word-level timestamps" },
  { label: "YOLO v8", note: "active speaker · smart reframing" },
  { label: "librosa", note: "RMS energy peaks" },
  { label: "ffmpeg", note: "9:16 render · word-by-word captions" },
  { label: "bgutil PO tokens", note: "Bypasses YouTube 2025+ bot check" },
  { label: "Deno", note: "JS challenge solver (EJS)" },
  { label: "OpenCV", note: "intent + emotion detection" },
  { label: "yt-dlp 2026.06", note: "YouTube extractor" },
  { label: "FastAPI", note: "backend · 15 endpoints" },
  { label: "Postgres 15", note: "task ledger · intake forms" },
  { label: "Hetzner CX31", note: "€9.85/mo · self-hostable" },
];

export default function LiveTicker() {
  // Duplicate so the marquee wraps seamlessly.
  const loop = [...STACK, ...STACK];

  return (
    <div className="relative w-full overflow-hidden border-y border-[color:var(--color-border)] bg-[color:var(--color-bg-deep)] py-3">
      {/* Side fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[color:var(--color-bg-deep)] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[color:var(--color-bg-deep)] to-transparent z-10" />

      {/* Engine badge — replaces the old "LIVE" red dot which implied
          active users we don't have yet. */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        <span className="text-[10px] font-mono tracking-widest text-text-muted">ENGINE</span>
      </div>

      <motion.div
        className="flex gap-8 animate-marquee whitespace-nowrap pl-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        {loop.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 text-sm font-sans">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-text-primary font-medium">{item.label}</span>
            <span className="text-text-faint">·</span>
            <span className="font-mono text-xs text-text-muted">{item.note}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
