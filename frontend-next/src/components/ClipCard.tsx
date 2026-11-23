"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Download, Play, Video, Pencil } from "lucide-react";
import type { Clip } from "@/types";
import { apiPath } from "@/lib/apiBase";

interface ClipCardProps {
  clip: Clip;
  index: number;
  onSelect: (clip: Clip) => void;
  onDownload: (clip: Clip) => void;
  isSelected?: boolean;
  onEdit?: (clip: Clip) => void;
  onSchedule?: (clip: Clip) => void;
}

export default function ClipCard({
  clip,
  index,
  onSelect,
  onDownload,
  isSelected,
  onEdit,
  onSchedule,
}: ClipCardProps) {
  const [videoError, setVideoError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const posterUrl = clip.thumbnail_url
    ? clip.thumbnail_url.startsWith("http")
      ? clip.thumbnail_url
      : apiPath(clip.thumbnail_url)
    : clip.clip_id
    ? apiPath(`/thumbnail/${clip.clip_id}`)
    : undefined;

  const score = Math.round(
    clip.hook_score && clip.hook_score > 1
      ? clip.hook_score
      : clip.story_score && clip.story_score > 1
      ? clip.story_score
      : 89
  );

  const durationSec = clip.duration_s || 60;
  const mins = Math.floor(durationSec / 60).toString().padStart(2, "0");
  const secs = Math.floor(durationSec % 60).toString().padStart(2, "0");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onSelect(clip)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex flex-col justify-between rounded-xl overflow-hidden cursor-pointer transition-all duration-300 font-sans ${
        isSelected ? "ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : ""
      }`}
    >
      {/* 9:16 Aspect Frame */}
      <div className="relative aspect-[9/16] w-full bg-[#0d0e12] rounded-xl overflow-hidden border border-white/10 group-hover:border-emerald-500/50 shadow-md group-hover:shadow-[0_8px_30px_rgba(16,185,129,0.18)] transition-all">
        {posterUrl && (
          <img
            src={posterUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-125 pointer-events-none"
          />
        )}
        {posterUrl && !videoError ? (
          <img
            src={posterUrl}
            alt={clip.viral_title || "Clip thumbnail"}
            className="relative z-10 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setVideoError(true)}
          />
        ) : (
          <div className="relative z-10 w-full h-full bg-[#141418] flex items-center justify-center">
            <Video className="w-8 h-8 text-zinc-600" />
          </div>
        )}

        {/* Play Icon Overlay on Hover */}
        <div
          className={`absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] flex items-center justify-center transition-opacity duration-200 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center shadow-2xl pl-1 group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 fill-black" />
          </div>
        </div>

        {/* Timecode Badge (e.g. 00:00 01:13) */}
        <div className="absolute bottom-2.5 right-2.5 z-20 pointer-events-none">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-black/85 text-zinc-200 backdrop-blur-md border border-white/10">
            00:00 {mins}:{secs}
          </span>
        </div>
      </div>

      {/* Metadata Row below card (Score + Schedule + Download) */}
      <div className="pt-2.5 pb-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          {/* Neon Virality Score matching Opus Clip */}
          <span className="font-mono text-xl font-bold text-[#22c55e] tracking-tight leading-none drop-shadow-[0_0_8px_rgba(34,197,94,0.35)]">
            {score}
          </span>

          {/* Quick Action Icons: Schedule & Download */}
          <div className="flex items-center gap-1.5">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(clip);
                }}
                title="Edit clip in Studio"
                className="p-1 rounded text-zinc-400 hover:text-[#4FD1C5] transition cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}

            {/* Calendar / Schedule Icon */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onSchedule) onSchedule(clip);
                else onSelect(clip);
              }}
              title="Schedule to YouTube Shorts"
              className="p-1 rounded text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
            </button>

            {/* Download Icon */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(clip);
              }}
              title="Download clip"
              className="p-1 rounded text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-medium text-xs text-zinc-200 line-clamp-2 leading-snug group-hover:text-white transition-colors">
          {clip.viral_title || `Clip #${index + 1}`}
        </h3>
      </div>
    </motion.div>
  );
}
