"use client";

/**
 * LongFormStack — Stack of still-representation long-form video thumbnails.
 *
 * The right-side column of the hero. Shows 3-4 long-form videos stacked
 * at slight rotation for depth, with overlay meta (channel, duration).
 * All static (not playing) — the user said "still representations".
 *
 * Uses public YouTube maxresdefault thumbnails, which are CDN-cached
 * and don't require auth.
 */

import { motion } from "framer-motion";

interface LongFormItem {
  videoId: string;
  channel: string;
  title: string;
  duration: string;
  accent: string; // hex color for the accent bar
}

const LONGFORM: LongFormItem[] = [
  {
    videoId: "jNQXAC9IVRw", // "Me at the zoo" — first ever YouTube video
    channel: "@jawed",
    title: "Me at the zoo",
    duration: "0:19",
    accent: "#FCD34D",
  },
  {
    videoId: "dQw4w9WgXcQ",
    channel: "@RickAstleyVEVO",
    title: "Never Gonna Give You Up (Official)",
    duration: "3:33",
    accent: "#D946EF",
  },
  {
    videoId: "9bZkp7q19f0",
    channel: "@officialpsy",
    title: "PSY — Gangnam Style",
    duration: "4:13",
    accent: "#F59E0B",
  },
  {
    videoId: "kJQP7kiw5Fk",
    channel: "@LuisFonsiVEVO",
    title: "Luis Fonsi — Despacito ft. Daddy Yankee",
    duration: "4:42",
    accent: "#06B6D4",
  },
];

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
const fallback = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export default function LongFormStack() {
  return (
    <div className="relative w-full h-full" aria-label="Long-form video sources">
      {/* Soft glow behind the stack — gold + fuchsia radial */}
      <div
        aria-hidden
        className="absolute -inset-12 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(217, 70, 239, 0.12) 0%, rgba(252, 211, 77, 0.08) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* The stack — 4 cards, slight stagger and rotation */}
      <div className="relative grid grid-cols-2 gap-4 md:gap-5">
        {LONGFORM.map((v, i) => (
          <motion.div
            key={v.videoId}
            initial={{ opacity: 0, y: 20, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: i % 2 === 0 ? -1.5 : 1.5 }}
            transition={{ delay: 0.3 + i * 0.08, duration: 0.5, ease: "easeOut" }}
            className="relative group"
            style={{
              transformOrigin: i % 2 === 0 ? "left center" : "right center",
            }}
          >
            <div
              className="relative aspect-video rounded-2xl overflow-hidden"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow:
                  "0 10px 30px rgba(40, 30, 20, 0.10), 0 2px 6px rgba(40, 30, 20, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
              }}
            >
              {/* Thumbnail — falls back from maxres → hq if maxres missing */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb(v.videoId)}
                alt={v.title}
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.src.includes("hqdefault")) img.src = fallback(v.videoId);
                }}
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Vignette — keeps the title legible */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 0%, transparent 50%, rgba(15, 13, 10, 0.85) 100%)",
                }}
              />

              {/* Duration pill (top-right) */}
              <div
                className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold"
                style={{
                  background: "rgba(15, 13, 10, 0.7)",
                  backdropFilter: "blur(8px)",
                  color: "#FFFFFF",
                }}
              >
                {v.duration}
              </div>

              {/* Accent bar (top-left) */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: v.accent }}
              />

              {/* Bottom info: channel + title */}
              <div className="absolute bottom-0 left-0 right-0 p-3.5">
                <p
                  className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
                  style={{ color: "rgba(255, 255, 255, 0.7)" }}
                >
                  {v.channel}
                </p>
                <p
                  className="text-[12px] font-semibold leading-snug line-clamp-2"
                  style={{ color: "#FFFFFF" }}
                >
                  {v.title}
                </p>
              </div>
            </div>

            {/* Subtle reflection underneath */}
            <div
              aria-hidden
              className="absolute -bottom-3 left-3 right-3 h-3 rounded-full"
              style={{
                background: "radial-gradient(ellipse, rgba(40, 30, 20, 0.10) 0%, transparent 70%)",
                filter: "blur(4px)",
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* Caption below the stack */}
      <p
        className="mt-8 text-center text-[11px] font-mono uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        Real YouTube sources · dropped into the engine
      </p>
    </div>
  );
}
