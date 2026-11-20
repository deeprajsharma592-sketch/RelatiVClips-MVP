"use client";

/**
 * MovingClipsGrid (Section 02 · Output Showcase)
 * 3D Draggable Carousel with True 9:16 Cinematic Video Preview Cards
 * Replaces the bulky smartphone mockup with edge-to-edge video-focused preview cards.
 */

import { Play } from "lucide-react";
import { motion } from "framer-motion";
import RotatingCards, { type RotatingCardItem } from "./RotatingCards";

interface ShowcaseClip extends RotatingCardItem {
  id: string;
  title: string;
  captionPrefix: string;
  highlightWord: string;
  captionSuffix: string;
  speaker: string;
  duration: string;
  thumbnail: string;
  platform: "TikTok" | "Shorts" | "Reels";
}

const SHOWCASE_CLIPS: ShowcaseClip[] = [
  {
    id: "clip-1",
    title: "Why 99% of Startups Die in Year One",
    captionPrefix: "The secret isn't funding, it's",
    highlightWord: "CUSTOMER OBSESSION",
    captionSuffix: "",
    speaker: "Founder Insights",
    duration: "0:34",
    thumbnail: "/thumb_r1.webp",
    platform: "Shorts",
  },
  {
    id: "clip-3",
    title: "The Impossible Action Shot",
    captionPrefix: "We had only",
    highlightWord: "ONE SHOT",
    captionSuffix: "before sunset",
    speaker: "Action Creator",
    duration: "0:28",
    thumbnail: "/thumb_r3.webp",
    platform: "Reels",
  },
  {
    id: "clip-4",
    title: "Why Apple Sells Emotion",
    captionPrefix: "They don't sell specs, they sell",
    highlightWord: "EMOTIONAL STATUS",
    captionSuffix: "",
    speaker: "Tech Breakdown",
    duration: "0:38",
    thumbnail: "/thumb_r4.webp",
    platform: "TikTok",
  },
  {
    id: "clip-5",
    title: "High-Stakes Negotiation Strategy",
    captionPrefix: "Whoever speaks first in silence",
    highlightWord: "ALWAYS LOSES",
    captionSuffix: "",
    speaker: "Negotiation Master",
    duration: "0:45",
    thumbnail: "/thumb_r5.webp",
    platform: "Shorts",
  },
  {
    id: "clip-6",
    title: "The Truth About Standup Comedy",
    captionPrefix: "Bombing in front of crowds is",
    highlightWord: "LIBERATING",
    captionSuffix: "",
    speaker: "Comedy Studio",
    duration: "0:31",
    thumbnail: "/thumb_r1.webp",
    platform: "Reels",
  },
  {
    id: "clip-8",
    title: "Mastering Confident Eye Contact",
    captionPrefix: "Focus on the bridge of the nose.",
    highlightWord: "WORKS EVERY TIME",
    captionSuffix: "",
    speaker: "Executive Presence",
    duration: "0:29",
    thumbnail: "/thumb_r3.webp",
    platform: "TikTok",
  },
];

export default function MovingClipsGrid() {
  return (
    <section className="relative py-16 sm:py-20 px-4 sm:px-6 bg-[#07080C] text-white overflow-hidden border-t border-b border-white/5">
      <div className="max-w-5xl mx-auto overflow-hidden">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center mb-8 sm:mb-10"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white font-sans">
            One video becomes{" "}
            <span className="text-amber-400">ten viral clips.</span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-zinc-400 max-w-xl font-sans">
            Every clip comes with AI-curated hooks, dynamic animated karaoke subtitles,
            and speaker-centered 9:16 cropping. Drag the ring to explore.
          </p>
        </motion.div>

        {/* ── 3D Draggable Rotating Cards Component ── */}
        <div className="relative w-full py-4 overflow-hidden">
          <RotatingCards
            cards={SHOWCASE_CLIPS}
            radius={360}
            cardWidth={180}
            cardHeight={320}
            speed={5.6}
            autoPlay={true}
            pauseOnHover={false}
            draggable={true}
            renderCard={(card: ShowcaseClip, index, isCenter) => (
              <div
                className={`group relative w-full h-full rounded-2xl overflow-hidden border bg-[#0B0D12] shadow-2xl transition-[border-color,box-shadow] duration-300 select-none flex flex-col justify-between ${
                  isCenter
                    ? "border-amber-400/80 shadow-[0_0_35px_rgba(245,158,11,0.25)] scale-[1.02]"
                    : "border-white/[0.08] hover:border-white/20"
                }`}
              >
                {/* Edge-to-Edge Thumbnail Poster */}
                <img
                  src={card.thumbnail}
                  alt={card.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Cinematic Vignette & Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/50 pointer-events-none" />

                {/* Subtle Top Metadata Bar */}
                <div className="relative z-10 p-2.5 flex items-center justify-between text-[9px] font-mono">
                  <span className="px-2 py-0.5 rounded-full font-medium bg-black/60 backdrop-blur-md text-white/90 border border-white/15">
                    {card.platform}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-zinc-300 bg-black/60 backdrop-blur-md border border-white/10">
                    {card.duration}
                  </span>
                </div>

                {/* Center Restrained Frosted Play Button */}
                <div className="relative z-10 my-auto flex items-center justify-center pointer-events-none">
                  <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
                    <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                  </div>
                </div>

                {/* Single Restrained Subtitle Box (Lower-Middle Third) */}
                <div className="relative z-10 px-2.5 pb-2 text-center pointer-events-none">
                  <div className="inline-block px-2.5 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 shadow-lg max-w-[96%]">
                    <p className="text-[10px] sm:text-[11px] font-bold leading-snug text-white tracking-tight">
                      {card.captionPrefix}{" "}
                      <span className="text-amber-300 font-extrabold underline decoration-amber-400/60 underline-offset-2">
                        {card.highlightWord}
                      </span>{" "}
                      {card.captionSuffix}
                    </p>
                  </div>
                </div>

                {/* Bottom Metadata: Title & Format */}
                <div className="relative z-10 p-2.5 pt-1.5 text-left border-t border-white/[0.08] bg-black/60 backdrop-blur-sm">
                  <p className="text-[10px] font-semibold text-white truncate tracking-tight">
                    {card.title}
                  </p>
                  <div className="flex items-center justify-between text-[8.5px] font-mono text-zinc-400 mt-0.5">
                    <span>{card.speaker}</span>
                    <span className="text-cyan-400 font-medium">9:16 HD</span>
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      </div>
    </section>
  );
}
