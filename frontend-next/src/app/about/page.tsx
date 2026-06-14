"use client";

import { motion } from "framer-motion";
import BentoCard from "@/components/BentoCard";
import PhysicsIcon from "@/components/PhysicsIcon";

export default function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-mono text-accent">
            [Φ-Manifesto]
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-accent to-transparent" />
        </div>
        <h1 className="text-4xl font-display font-bold text-white mb-3">
          About <span className="text-accent">RelatiV</span>
        </h1>
        <p className="text-base text-text-muted max-w-2xl font-sans">
          Privacy-first AI video clipping engineered for precision.
        </p>
      </motion.div>

      <div className="bento-grid">
        <BentoCard colSpan={6} glow="accent">
          <h2 className="text-lg font-display font-bold text-white mb-4">
            Our Mission
          </h2>
          <p className="text-sm text-text-muted font-sans leading-relaxed">
            RelatiV exists to democratize high-quality video clipping through
            locally-executed AI. Every frame is processed on your hardware
            — zero uploads, zero cloud dependencies, zero privacy compromise.
          </p>
          <div className="mt-6 flex items-center gap-2">
            <PhysicsIcon symbol="η" label="Zero Data Exfiltration" />
          </div>
        </BentoCard>

        <BentoCard colSpan={6} glow="secondary">
          <h2 className="text-lg font-display font-bold text-white mb-4">
            The Technology
          </h2>
          <p className="text-sm text-text-muted font-sans leading-relaxed">
            Combining spectral audio analysis, optical flow vectors, and
            semantic LLM evaluation — our pipeline isolates high-signal moments
            with surgical precision.
          </p>
          <div className="mt-6 flex items-center gap-2">
            <PhysicsIcon symbol="Δv" label="Audio + Visual Fusion" />
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
