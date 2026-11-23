"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AIBlob from "./AIBlob";

interface VideoProcessingViewProps {
  thumbnailUrl?: string | null;
  progress?: number;
  videoTitle?: string | null;
}

export default function VideoProcessingView({
  thumbnailUrl,
  progress = 25,
  videoTitle,
}: VideoProcessingViewProps) {
  // Randomized starting countdown between 150s (2m 30s) and 235s (3m 55s)
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    return Math.floor(160 + Math.random() * 70);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 8) return 8; // keep gentle floor until complete
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeDisplay =
    mins > 0 ? `${mins} mins ${secs.toString().padStart(2, "0")} secs` : `${secs} secs`;

  // Safe clamp on progress (ensure between 4% and 100%)
  const clampedProgress = Math.min(100, Math.max(4, Math.round(progress)));

  return (
    <div className="w-full max-w-4xl mx-auto py-8 sm:py-12 px-4 flex flex-col items-center justify-center font-sans select-none">
      {/* ── Top Countdown: Only "Clips in X mins Y secs" (Zero extra texts) ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 sm:mb-12 text-center"
      >
        <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white font-display">
          Clips in <span className="text-emerald-400 font-mono">{timeDisplay}</span>
        </div>
      </motion.div>

      {/* ── Main Container: Thinking AI Blob on Left, Green Filling Thumbnail on Right ── */}
      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-8 sm:gap-10 items-center justify-center">
        {/* Left: Thinking AI Glass Orb */}
        <div className="md:col-span-4 flex flex-col items-center justify-center">
          <AIBlob state="thinking" size={220} />
        </div>

        {/* Right: 16:9 Thumbnail with Green Progress Overlay */}
        <div className="md:col-span-8 w-full max-w-lg mx-auto">
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/15 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.85)]">
            {/* Background Thumbnail Image */}
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={videoTitle || "Processing video"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-black to-zinc-950 flex items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                </div>
              </div>
            )}

            {/* ── Green Overlay Layer Filling the Thumbnail ── */}
            <motion.div
              className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none"
              style={{ width: `${clampedProgress}%` }}
              initial={{ width: "4%" }}
              animate={{ width: `${clampedProgress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              {/* Green Tint & Frosted Fluid Layer */}
              <div
                className="w-full h-full"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(16, 185, 129, 0.45) 0%, rgba(52, 211, 153, 0.65) 100%)",
                  backdropFilter: "saturate(160%) brightness(1.1)",
                }}
              />

              {/* Glowing Leading Scan Beam */}
              <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-emerald-300 shadow-[0_0_24px_5px_rgba(52,211,153,0.9)]" />
            </motion.div>

            {/* Corner Progress Percentage Badge */}
            <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-black/80 text-emerald-400 border border-emerald-500/30 backdrop-blur-md shadow-lg">
                {clampedProgress}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
