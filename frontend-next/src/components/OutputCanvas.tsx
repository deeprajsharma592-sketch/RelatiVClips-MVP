"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import VideoPlayer from "./VideoPlayer";
import ClipCard from "./ClipCard";
import BentoCard from "./BentoCard";
import type { Clip } from "@/types";
import { getDownloadUrl } from "@/lib/api";

interface OutputCanvasProps {
  clips: Clip[];
  onReset: () => void;
}

export default function OutputCanvas({ clips, onReset }: OutputCanvasProps) {
  const [selectedClip, setSelectedClip] = useState<Clip | null>(clips[0] ?? null);

  const handleSelect = useCallback((clip: Clip) => {
    setSelectedClip(clip);
  }, []);

  const handleDownload = useCallback((clip: Clip) => {
    const a = document.createElement("a");
    a.href = getDownloadUrl(clip.clip_id);
    a.download = `${clip.clip_id}.mp4`;
    a.click();
  }, []);

  const aggregatedStats = useMemo(() => {
    const totalDuration = clips.reduce((sum, c) => sum + c.duration_s, 0);
    const totalSize = clips.reduce((sum, c) => sum + c.file_size_mb, 0);
    return { totalDuration, totalSize, count: clips.length };
  }, [clips]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="output"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-display font-bold text-white">Production Workspace</h2>
            <p className="text-sm text-text-muted mt-1">{clips.length} clips extracted. Select a clip to preview.</p>
          </div>
          <motion.button
            onClick={onReset}
            className="px-4 py-2 bg-transparent border border-border text-text-muted text-sm rounded-[4px] font-sans hover:border-accent hover:text-accent transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            New Extraction
          </motion.button>
        </div>

        <div className="bento-grid">
          <BentoCard colSpan={7} glow="accent" className="min-h-[500px]">
            <VideoPlayer
              src={selectedClip ? getDownloadUrl(selectedClip.clip_id) : undefined}
              label={selectedClip ? `Preview: ${selectedClip.viral_title}` : "Clip Preview"}
            />
          </BentoCard>

          <BentoCard colSpan={5} glow="secondary">
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-accent-secondary">[Σ]</span>
                  <span className="text-sm font-display text-white font-semibold">Generated Clips</span>
                </div>
                <span className="text-xs font-mono text-text-muted">{clips.length} total</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Total Duration", symbol: "Δt", value: `${aggregatedStats.totalDuration.toFixed(0)}s` },
                  { label: "Total Size", symbol: "Σ", value: `${aggregatedStats.totalSize.toFixed(1)} MB` },
                  { label: "Clips", symbol: "Φ", value: `${aggregatedStats.count}` },
                ].map((stat) => (
                  <div key={stat.label} className="p-2 bg-bg-base border border-border rounded-[2px] text-center">
                    <span className="font-mono text-xs text-accent-secondary">[{stat.symbol}]</span>
                    <p className="font-mono text-sm text-text-primary mt-1">{stat.value}</p>
                    <p className="text-[10px] text-text-muted">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {clips.map((clip, i) => (
                  <ClipCard
                    key={clip.clip_id}
                    clip={clip}
                    index={i}
                    onSelect={handleSelect}
                    onDownload={handleDownload}
                    isSelected={selectedClip?.clip_id === clip.clip_id}
                  />
                ))}
              </div>
            </div>
          </BentoCard>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-between p-4 bg-surface border border-border rounded-[4px]"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-accent-secondary">[Φ]</span>
            <span className="text-sm text-text-muted">
              All clips processed at <span className="font-mono text-accent-secondary">1080x1920</span> with{" "}
              <span className="font-mono text-accent-secondary">face tracking</span>
            </span>
          </div>
          <div className="flex gap-2">
            <motion.button
              onClick={() => clips.forEach(handleDownload)}
              className="px-4 py-2 bg-accent text-white text-sm font-semibold rounded-[2px] font-sans"
              whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(77,77,255,0.3)" }}
              whileTap={{ scale: 0.98 }}
            >
              Export All [Σ]
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
