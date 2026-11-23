"use client";

import React from "react";
import { motion } from "framer-motion";

interface AIBlobProps {
  state?: "thinking" | "listening" | "speaking" | "processing";
  size?: number;
  className?: string;
}

export default function AIBlob({
  state = "thinking",
  size = 200,
  className = "",
}: AIBlobProps) {
  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* ── Layer 1: Ambient Radiant Aura (Blur Glow) ── */}
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.35, 0.65, 0.35],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 5.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 rounded-full blur-[42px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(16, 185, 129, 0.7) 0%, rgba(6, 182, 212, 0.5) 40%, rgba(139, 92, 246, 0.35) 75%, transparent 100%)",
        }}
      />

      {/* ── Layer 2: Outer Morphing Organic Liquid Ring ── */}
      <motion.div
        animate={{
          borderRadius: [
            "60% 40% 30% 70% / 60% 30% 70% 40%",
            "30% 60% 70% 40% / 50% 60% 30% 60%",
            "60% 40% 60% 40% / 40% 50% 60% 50%",
            "60% 40% 30% 70% / 60% 30% 70% 40%",
          ],
          rotate: [0, 120, 240, 360],
          scale: [0.95, 1.05, 0.98, 0.95],
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-[86%] h-[86%] opacity-70 border border-emerald-400/30"
        style={{
          background:
            "linear-gradient(135deg, rgba(52, 211, 153, 0.25) 0%, rgba(56, 189, 248, 0.15) 50%, rgba(168, 85, 247, 0.2) 100%)",
          backdropFilter: "blur(12px)",
        }}
      />

      {/* ── Layer 3: Core Glass Orb (3D Specular Apple Glass Sphere) ── */}
      <motion.div
        animate={{
          borderRadius: [
            "50% 50% 50% 50% / 50% 50% 50% 50%",
            "55% 45% 52% 48% / 48% 52% 48% 52%",
            "47% 53% 49% 51% / 52% 48% 54% 46%",
            "50% 50% 50% 50% / 50% 50% 50% 50%",
          ],
          scale: [1, 1.03, 0.98, 1],
        }}
        transition={{
          duration: 3.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative w-[72%] h-[72%] overflow-hidden shadow-[0_16px_50px_rgba(0,0,0,0.85),inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-8px_20px_rgba(16,185,129,0.4)] border border-white/40"
        style={{
          background:
            "radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.6) 0%, rgba(52, 211, 153, 0.4) 30%, rgba(6, 182, 212, 0.3) 65%, rgba(15, 23, 42, 0.8) 100%)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Dynamic Inner Fluid Wave */}
        <motion.div
          animate={{
            x: ["-25%", "25%", "-25%"],
            y: ["-20%", "20%", "-20%"],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -inset-1/2 opacity-75 blur-[10px]"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(110, 231, 183, 0.7) 0%, rgba(14, 165, 233, 0.5) 45%, transparent 70%)",
          }}
        />

        {/* Top-Left Specular Glass Glare (Apple Glass signature) */}
        <div className="absolute top-2 left-3 w-1/3 h-1/4 rounded-full bg-gradient-to-br from-white/90 to-transparent blur-[1px] rotate-[-25deg] pointer-events-none" />

        {/* Bottom Specular Rim Light */}
        <div className="absolute bottom-1.5 inset-x-4 h-[2px] rounded-full bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent blur-[1px] pointer-events-none" />
      </motion.div>

      {/* ── Layer 4: Orbital Pulse Rings ── */}
      <motion.div
        animate={{
          scale: [0.8, 1.4, 1.6],
          opacity: [0.6, 0.2, 0],
        }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
          ease: "easeOut",
        }}
        className="absolute inset-2 rounded-full border border-emerald-400/40 pointer-events-none"
      />
    </div>
  );
}
