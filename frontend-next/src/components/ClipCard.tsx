"use client";

import { motion } from "framer-motion";
import type { Clip } from "@/types";

interface ClipCardProps {
  clip: Clip;
  index: number;
  onSelect: (clip: Clip) => void;
  onDownload: (clip: Clip) => void;
  isSelected?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function ClipCard({
  clip,
  index,
  onSelect,
  onDownload,
  isSelected,
}: ClipCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`p-4 rounded-[4px] border transition-all duration-200 ${
        isSelected
          ? "border-accent bg-accent/5 glow-accent"
          : "border-border bg-surface hover:border-accent"
      }`}
      onClick={() => onSelect(clip)}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center px-2 py-0.5 bg-accent/20 border border-accent/30 rounded-[2px] text-xs font-mono text-accent">
          Clip #{index + 1}
        </span>
        <span className="text-xs font-mono text-text-muted">
          {formatTime(clip.start)} - {formatTime(clip.end)}
        </span>
      </div>

      <h3 className="text-sm font-display font-semibold text-white mb-1 leading-snug">
        {clip.viral_title}
      </h3>

      <p className="text-xs text-text-muted mb-3 line-clamp-2 leading-relaxed">
        {clip.caption}
      </p>

      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[10px] text-accent-secondary/70">[{clip.duration_s.toFixed(1)}s]</span>
        <span className="font-mono text-[10px] text-text-muted">{clip.file_size_mb.toFixed(1)} MB</span>
        {clip.hashtags && (
          <span className="font-mono text-[10px] text-accent/60 truncate max-w-[140px]">{clip.hashtags}</span>
        )}
      </div>

      <div className="flex gap-2">
        <motion.button
          onClick={(e) => { e.stopPropagation(); onSelect(clip); }}
          className="flex-1 py-2 bg-border text-text-muted text-xs font-semibold rounded-[2px] font-sans hover:bg-accent hover:text-white transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Preview
        </motion.button>
        <motion.button
          onClick={(e) => { e.stopPropagation(); onDownload(clip); }}
          className="flex-1 py-2 bg-accent text-white text-xs font-semibold rounded-[2px] font-sans"
          whileHover={{ scale: 1.02, boxShadow: "0 0 15px rgba(77,77,255,0.3)" }}
          whileTap={{ scale: 0.98 }}
        >
          Download
        </motion.button>
      </div>
    </motion.div>
  );
}
