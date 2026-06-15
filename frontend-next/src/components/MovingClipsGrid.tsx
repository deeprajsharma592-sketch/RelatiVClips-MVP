"use client";

/**
 * MovingClipsGrid — The lower section of the new landing page.
 *
 * Multiple smaller, auto-playing short clips in a masonry-ish grid.
 * Each "clip" is a 9:16 vertical card with:
 *   - A still thumbnail as the base
 *   - A subtle CSS keyframe "moving" animation (slow pan + zoom)
 *   - A play icon overlay to suggest it's a video
 *   - Title + duration + fake "viral" stat
 *
 * The animation gives the impression of "moving clips" without
 * requiring actual video files (which would slow page load).
 */

import { motion } from "framer-motion";
import { Play } from "lucide-react";

interface ClipItem {
  videoId: string;
  title: string;
  duration: string;
  views: string;
  accent: string;
  // Different animation profiles for visual variety
  motion: "pan-zoom-in" | "pan-zoom-out" | "pan-left" | "pan-right";
}

const CLIPS: ClipItem[] = [
  {
    videoId: "jNQXAC9IVRw",
    title: "The first YouTube moment",
    duration: "0:14",
    views: "1.2M",
    accent: "#FCD34D",
    motion: "pan-zoom-in",
  },
  {
    videoId: "dQw4w9WgXcQ",
    title: "Never gonna give you up…",
    duration: "0:11",
    views: "847K",
    accent: "#D946EF",
    motion: "pan-right",
  },
  {
    videoId: "9bZkp7q19f0",
    title: "Oppa is Gangnam style",
    duration: "0:13",
    views: "412K",
    accent: "#F59E0B",
    motion: "pan-zoom-out",
  },
  {
    videoId: "kJQP7kiw5Fk",
    title: "Despacito — the hook",
    duration: "0:15",
    views: "2.1M",
    accent: "#06B6D4",
    motion: "pan-left",
  },
  {
    videoId: "jNQXAC9IVRw",
    title: "Zoo chit-chat goes viral",
    duration: "0:12",
    views: "688K",
    accent: "#FF77E9",
    motion: "pan-zoom-in",
  },
  {
    videoId: "dQw4w9WgXcQ",
    title: "Astley's opening verse",
    duration: "0:10",
    views: "1.5M",
    accent: "#FCD34D",
    motion: "pan-right",
  },
];

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

// CSS keyframes injected once at module scope — moves the background image
// so it looks like a video is playing, without the bandwidth of a real video.
const motionKeyframes = `
@keyframes pan-zoom-in {
  0%   { transform: scale(1.05) translate(0, 0); }
  50%  { transform: scale(1.12) translate(-1.5%, -1%); }
  100% { transform: scale(1.05) translate(0, 0); }
}
@keyframes pan-zoom-out {
  0%   { transform: scale(1.18) translate(0, 0); }
  50%  { transform: scale(1.08) translate(1.5%, 1%); }
  100% { transform: scale(1.18) translate(0, 0); }
}
@keyframes pan-left {
  0%   { transform: scale(1.15) translateX(2%); }
  50%  { transform: scale(1.15) translateX(-2%); }
  100% { transform: scale(1.15) translateX(2%); }
}
@keyframes pan-right {
  0%   { transform: scale(1.15) translateX(-2%); }
  50%  { transform: scale(1.15) translateX(2%); }
  100% { transform: scale(1.15) translateX(-2%); }
}
`;

if (typeof document !== "undefined" && !document.getElementById("moving-clips-keyframes")) {
  const el = document.createElement("style");
  el.id = "moving-clips-keyframes";
  el.textContent = motionKeyframes;
  document.head.appendChild(el);
}

export default function MovingClipsGrid() {
  return (
    <div className="relative">
      {/* Section header */}
      <div className="flex flex-col items-center text-center mb-10 md:mb-14">
        <div className="flex items-center gap-3 mb-4">
          <span
            className="text-[11px] font-mono tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            02
          </span>
          <span
            className="h-px w-12"
            style={{ background: "var(--color-border-strong)" }}
          />
          <span
            className="text-[11px] font-mono uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            The output
          </span>
        </div>
        <h2
          className="font-display font-semibold max-w-3xl"
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            color: "var(--color-text-primary)",
          }}
        >
          One video becomes{" "}
          <span
            className="font-fraunces-italic"
            style={{ color: "var(--color-accent)", fontWeight: 400 }}
          >
            ten clips
          </span>
          . <br className="hidden md:block" />
          Each one tuned for{" "}
          <span className="text-gradient-gold" style={{ fontWeight: 600 }}>
            the scroll
          </span>
          .
        </h2>
        <p
          className="mt-5 text-base md:text-lg max-w-2xl"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Auto-cropped 9:16. Word-by-word captions. Titles picked by
          taste, not length. Ready to post on TikTok, Reels, Shorts.
        </p>
      </div>

      {/* The grid of "moving" clips */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 max-w-7xl mx-auto">
        {CLIPS.map((c, i) => (
          <motion.div
            key={`${c.videoId}-${i}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: i * 0.06, duration: 0.5, ease: "easeOut" }}
            className="relative group"
          >
            <div
              className="relative aspect-[9/16] rounded-2xl overflow-hidden"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow:
                  "0 8px 24px rgba(40, 30, 20, 0.10), 0 2px 6px rgba(40, 30, 20, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
              }}
            >
              {/* Background image with motion animation */}
              <div
                aria-hidden
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${thumb(c.videoId)})`,
                  animation: `${c.motion} ${10 + i * 1.2}s ease-in-out infinite`,
                  willChange: "transform",
                }}
              />

              {/* Color grade overlay (subtle, to unify the cards) */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(15, 13, 10, 0.0) 0%, rgba(15, 13, 10, 0.25) 60%, rgba(15, 13, 10, 0.85) 100%)",
                }}
              />

              {/* Top accent stripe */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: c.accent }}
              />

              {/* Play icon overlay (top-right) */}
              <div
                className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(15, 13, 10, 0.55)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <Play className="h-3 w-3 ml-0.5" fill="#FFFFFF" style={{ color: "#FFFFFF" }} />
              </div>

              {/* Duration pill (top-left) */}
              <div
                className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold"
                style={{
                  background: "rgba(15, 13, 10, 0.55)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  color: "#FFFFFF",
                }}
              >
                {c.duration}
              </div>

              {/* Bottom info: title + views */}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p
                  className="text-[12px] font-semibold leading-snug line-clamp-2 mb-1"
                  style={{ color: "#FFFFFF" }}
                >
                  {c.title}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span
                    className="inline-block w-1 h-1 rounded-full"
                    style={{ background: c.accent }}
                  />
                  <span style={{ color: "rgba(255, 255, 255, 0.75)" }}>
                    {c.views} views
                  </span>
                </div>
              </div>
            </div>

            {/* Reflection underneath */}
            <div
              aria-hidden
              className="absolute -bottom-2 left-2 right-2 h-2 rounded-full opacity-60"
              style={{
                background: "radial-gradient(ellipse, rgba(40, 30, 20, 0.12) 0%, transparent 70%)",
                filter: "blur(3px)",
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* Section footer note */}
      <p
        className="mt-10 text-center text-[12px] font-mono"
        style={{ color: "var(--color-text-muted)" }}
      >
        Sample output — actual clips from the engine land in your dashboard
      </p>
    </div>
  );
}
