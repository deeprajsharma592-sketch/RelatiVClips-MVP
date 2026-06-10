"use client";

import { motion } from "framer-motion";
import BentoCard from "@/components/BentoCard";
import PhysicsIcon from "@/components/PhysicsIcon";

const SERVICES = [
  {
    title: "YouTube Clip Extraction",
    symbol: "\u03A6",
    desc: "Surgical extraction from YouTube URLs with automatic subtitle generation and face tracking.",
    metrics: ["1080p Output", "Auto-captioning", "Face tracking"],
  },
  {
    title: "Local File Processing",
    symbol: "\u0394v",
    desc: "Upload MP4, AVI, MOV, or WebM files. Full pipeline runs locally on your hardware.",
    metrics: ["Multi-format", "Batch mode", "No file size limit"],
  },
  {
    title: "AI Virality Scoring",
    symbol: "\u03B5",
    desc: "Each clip is scored on semantic hooks, energy peaks, and visual engagement metrics.",
    metrics: ["Real-time scoring", "Hook detection", "Trend analysis"],
  },
];

export default function ServicesPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-mono text-accent">
            [\u03A3-Services]
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-accent to-transparent" />
        </div>
        <h1 className="text-4xl font-display font-bold text-white mb-3">
          Our <span className="text-accent">Services</span>
        </h1>
        <p className="text-base text-text-muted max-w-2xl font-sans">
          Everything you need to extract, analyze, and export viral content.
        </p>
      </motion.div>

      <div className="bento-grid">
        {SERVICES.map((service, i) => (
          <BentoCard key={i} colSpan={4} glow={i % 2 === 0 ? "accent" : "secondary"}>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-accent">
                  [{service.symbol}]
                </span>
                <h3 className="text-lg font-display font-bold text-white">
                  {service.title}
                </h3>
              </div>
              <p className="text-sm text-text-muted font-sans leading-relaxed">
                {service.desc}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {service.metrics.map((m) => (
                  <span
                    key={m}
                    className="px-2 py-1 text-[10px] font-mono text-accent-secondary bg-accent-secondary/5 border border-accent-secondary/20 rounded-[2px]"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </BentoCard>
        ))}
      </div>
    </div>
  );
}
