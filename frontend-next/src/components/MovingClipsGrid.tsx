"use client";

/**
 * MovingClipsGrid — The lower section of the landing page (v2).
 *
 * 6 9:16 vertical "moving clip" cards in a responsive grid.
 *
 * v2 improvements:
 *  - Uses real video files (Google CDN sample MP4s) inside <video> tags
 *    with muted+autoplay+loop+playsInline. Falls back to a CSS
 *    animated gradient if the video fails to load.
 *  - Removes fake "X views" labels — replaces with real "9:16" aspect
 *    marker + a tasteful "auto-clipped" tag.
 *  - Adds accent stripe at top + duration pill + subtle reflection.
 *  - Hover state: slight scale-up + glow.
 *
 * Each card is a "sample output" — in production these would be actual
 * clips from the engine (in /app/outputs/*.mp4).
 */

import { motion } from "framer-motion";
import { Play } from "lucide-react";

interface ClipItem {
  /** Background color shown while video is loading or if it fails. */
  fallback: string;
  /** Accent color for the top stripe. */
  accent: string;
  /** Title shown at the bottom. */
  title: string;
  /** Duration label. */
  duration: string;
  /** Optional video src — Google CDN sample MP4s, royalty-free. */
  videoSrc?: string;
  /** Motion profile for the fallback gradient animation. */
  motion: "pan-zoom-in" | "pan-zoom-out" | "pan-left" | "pan-right" | "rotate-slow";
}

const CLIPS: ClipItem[] = [
  {
    fallback: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 50%, #D946EF 100%)",
    accent: "#FCD34D",
    title: "Hook · first 3s",
    duration: "0:14",
    videoSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    motion: "pan-zoom-in",
  },
  {
    fallback: "linear-gradient(135deg, #FF77E9 0%, #D946EF 50%, #A78BFA 100%)",
    accent: "#D946EF",
    title: "Viral opener",
    duration: "0:11",
    videoSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    motion: "pan-right",
  },
  {
    fallback: "linear-gradient(135deg, #F59E0B 0%, #EC4899 50%, #8B5CF6 100%)",
    accent: "#F59E0B",
    title: "Energy spike",
    duration: "0:13",
    videoSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    motion: "pan-zoom-out",
  },
  {
    fallback: "linear-gradient(135deg, #06B6D4 0%, #0EA5E9 50%, #6366F1 100%)",
    accent: "#06B6D4",
    title: "Pause + payoff",
    duration: "0:15",
    videoSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    motion: "pan-left",
  },
  {
    fallback: "linear-gradient(135deg, #FCD34D 0%, #EC4899 50%, #A78BFA 100%)",
    accent: "#FF77E9",
    title: "Tag-worthy moment",
    duration: "0:12",
    videoSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    motion: "pan-zoom-in",
  },
  {
    fallback: "linear-gradient(135deg, #A78BFA 0%, #EC4899 50%, #F59E0B 100%)",
    accent: "#A78BFA",
    title: "Caption-ready",
    duration: "0:10",
    videoSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    motion: "pan-right",
  },
];

// CSS keyframes for the fallback animation (if video fails to load)
const motionKeyframes = `
@keyframes pan-zoom-in {
  0%   { transform: scale(1.05) translate(0, 0); }
  50%  { transform: scale(1.18) translate(-1.5%, -1%); }
  100% { transform: scale(1.05) translate(0, 0); }
}
@keyframes pan-zoom-out {
  0%   { transform: scale(1.25) translate(0, 0); }
  50%  { transform: scale(1.08) translate(1.5%, 1%); }
  100% { transform: scale(1.25) translate(0, 0); }
}
@keyframes pan-left {
  0%   { transform: scale(1.20) translateX(2%); }
  50%  { transform: scale(1.20) translateX(-2%); }
  100% { transform: scale(1.20) translateX(2%); }
}
@keyframes pan-right {
  0%   { transform: scale(1.20) translateX(-2%); }
  50%  { transform: scale(1.20) translateX(2%); }
  100% { transform: scale(1.20) translateX(-2%); }
}
@keyframes rotate-slow {
  0%   { transform: scale(1.15) rotate(0deg); }
  50%  { transform: scale(1.20) rotate(2deg); }
  100% { transform: scale(1.15) rotate(0deg); }
}
`;

if (typeof document !== "undefined" && !document.getElementById("moving-clips-keyframes-v2")) {
  const el = document.createElement("style");
  el.id = "moving-clips-keyframes-v2";
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
            key={`${c.title}-${i}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: i * 0.06, duration: 0.5, ease: "easeOut" }}
            className="relative group"
          >
            <div
              className="relative aspect-[9/16] rounded-2xl overflow-hidden transition-transform duration-300 group-hover:scale-[1.03]"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow:
                  "0 8px 24px rgba(40, 30, 20, 0.10), 0 2px 6px rgba(40, 30, 20, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
              }}
            >
              {/* Background — animated gradient (always animates as fallback) */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: c.fallback,
                  animation: `${c.motion} ${11 + i * 1.3}s ease-in-out infinite`,
                  willChange: "transform",
                }}
              />

              {/* Real video on top of the gradient — muted, autoplay, loop */}
              {c.videoSrc && (
                <video
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ mixBlendMode: "overlay", opacity: 0.6 }}
                  src={c.videoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  aria-hidden
                />
              )}

              {/* Color grade overlay (subtle, to unify the cards) */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(15, 13, 10, 0.0) 0%, rgba(15, 13, 10, 0.30) 60%, rgba(15, 13, 10, 0.85) 100%)",
                }}
              />

              {/* Top accent stripe */}
              <div
                className="absolute top-0 left-0 right-0 h-1 z-10"
                style={{ background: c.accent }}
              />

              {/* Play icon overlay (top-right) */}
              <div
                className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center z-10"
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
                className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold z-10"
                style={{
                  background: "rgba(15, 13, 10, 0.55)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  color: "#FFFFFF",
                }}
              >
                {c.duration}
              </div>

              {/* Bottom info: title + "auto-clipped" tag */}
              <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
                <p
                  className="text-[12px] font-semibold leading-snug line-clamp-2 mb-1.5"
                  style={{ color: "#FFFFFF" }}
                >
                  {c.title}
                </p>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-1 h-1 rounded-full"
                    style={{ background: c.accent }}
                  />
                  <span
                    className="text-[9px] font-mono uppercase tracking-wider"
                    style={{ color: "rgba(255, 255, 255, 0.75)" }}
                  >
                    9:16 · auto-clipped
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
