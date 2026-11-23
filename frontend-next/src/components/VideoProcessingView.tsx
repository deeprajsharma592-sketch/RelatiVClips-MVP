"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Video } from "lucide-react";

interface VideoProcessingViewProps {
  thumbnailUrl?: string | null;
  progress?: number;
  videoTitle?: string | null;
}

const TOTAL_CROSSES = 28;

export default function VideoProcessingView({
  thumbnailUrl,
  progress = 25,
  videoTitle,
}: VideoProcessingViewProps) {
  // Estimated remaining time starting around 120s - 180s
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    return Math.floor(130 + Math.random() * 50);
  });
  const [elapsedSec, setElapsedSec] = useState(0);

  // Fallback image handler (YouTube maxresdefault fallback to hqdefault)
  const [imgSrc, setImgSrc] = useState<string | null>(thumbnailUrl || null);

  useEffect(() => {
    if (thumbnailUrl) {
      setImgSrc(thumbnailUrl);
    }
  }, [thumbnailUrl]);

  const handleImageError = () => {
    if (imgSrc && imgSrc.includes("maxresdefault.jpg")) {
      setImgSrc(imgSrc.replace("maxresdefault.jpg", "hqdefault.jpg"));
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 5 ? 5 : prev - 1));
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeDisplay =
    mins > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secs}s`;

  // Cross lines count calculation (strictly non-percentage)
  // Increases smoothly based on progress or elapsed seconds
  const simulatedRatio = Math.min(0.96, Math.max(0.08, (progress || 15) / 100));
  const activeCrosses = Math.min(
    TOTAL_CROSSES,
    Math.max(2, Math.floor(simulatedRatio * TOTAL_CROSSES))
  );

  return (
    <div className="w-full max-w-3xl mx-auto py-6 sm:py-9 px-3 sm:px-6 flex flex-col items-center justify-center font-sans select-none">
      {/* ── Centerpiece: Submitted Video Thumbnail in 16:9 Frame ── */}
      <div className="relative aspect-video w-full max-w-2xl mx-auto rounded-2xl overflow-hidden border border-white/15 bg-[#090A0E] shadow-[0_20px_60px_rgba(0,0,0,0.85)] group">
        {/* Background Image / Slate */}
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={videoTitle || "Submitted video thumbnail"}
            onError={handleImageError}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-102"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-950 via-[#0B0C10] to-black flex items-center justify-center">
            {/* Subtle Studio Grid lines */}
            <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />
            <div className="flex flex-col items-center gap-2 text-zinc-500 z-10">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-zinc-400" />
              </div>
              <span className="text-[11px] font-mono tracking-wider uppercase text-zinc-400">
                Analyzing Video Stream
              </span>
            </div>
          </div>
        )}

        {/* Cinematic dark vignette for text and HUD readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/60 pointer-events-none" />

        {/* ── VERY SMALL ETA INSIDE THUMBNAIL (LEFT CORNER) ── */}
        <div className="absolute top-3.5 left-3.5 z-30 pointer-events-none">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md border border-white/15 text-white shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] sm:text-[11px] font-mono tracking-wider text-zinc-300 font-medium uppercase">
              ETA <span className="text-emerald-400 font-semibold">{timeDisplay}</span>
            </span>
          </div>
        </div>

        {/* Viewfinder Technical Corner Brackets */}
        <div className="absolute inset-3 pointer-events-none z-20 opacity-40">
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white/80" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white/80" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white/80" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white/80" />
        </div>

        {/* Rule-of-Thirds Crosshairs across the Thumbnail */}
        <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center opacity-30">
          <div className="relative w-2/3 h-2/3">
            <span className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 text-white/50 text-[10px] font-mono">
              +
            </span>
            <span className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 text-white/50 text-[10px] font-mono">
              +
            </span>
            <span className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 text-white/50 text-[10px] font-mono">
              +
            </span>
            <span className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 text-white/50 text-[10px] font-mono">
              +
            </span>
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400/70 text-xs font-mono">
              +
            </span>
          </div>
        </div>

        {/* Smooth Laser Scan Sweep across the Frame */}
        <motion.div
          className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-emerald-400/15 to-transparent pointer-events-none z-20"
          animate={{ x: ["-100%", "650%"] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
        />

        {/* ── CROSS LAYOUT: SMALL CROSS LINES INCREASING WITH TIME ── */}
        <div className="absolute bottom-3 left-3 right-3 z-30 pointer-events-none">
          <div className="p-2 sm:p-2.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 shadow-xl">
            {/* Array of Small Cross Lines (+) filling up over time */}
            <div className="flex items-center justify-between gap-1 w-full overflow-hidden px-1">
              {Array.from({ length: TOTAL_CROSSES }).map((_, i) => {
                const isActive = i < activeCrosses;
                const isLeading = i === activeCrosses - 1;

                return (
                  <span
                    key={i}
                    className={`font-mono text-[11px] sm:text-xs select-none transition-all duration-300 ${
                      isActive
                        ? isLeading
                          ? "text-white font-extrabold scale-125 animate-pulse drop-shadow-[0_0_10px_rgba(255,255,255,1)]"
                          : "text-emerald-400 font-bold drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                        : "text-white/20 font-normal"
                    }`}
                  >
                    +
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
