"use client";

import { forwardRef, useMemo } from "react";
import { motion } from "framer-motion";
import type { CaptionStyleConfig, EditorWord, FramingLayout } from "@/types/editor";

function activePhrase(words: EditorWord[], time: number, count: number) {
  const visible = words.filter((word) => !word.deleted);
  const activeIndex = visible.findIndex((word) => time >= word.start && time <= word.end + 0.08);
  if (activeIndex < 0) return { phrase: [] as EditorWord[], activeId: "" };
  const groupStart = Math.floor(activeIndex / count) * count;
  return { phrase: visible.slice(groupStart, groupStart + count), activeId: visible[activeIndex].id };
}

const POSITION: Record<CaptionStyleConfig["positionY"], string> = {
  top: "top-[20%]",
  center: "top-1/2 -translate-y-1/2",
  bottom: "top-[76%] -translate-y-1/2",
};

const FONT: Record<CaptionStyleConfig["fontFamily"], string> = {
  Montserrat: "Montserrat, Inter, sans-serif",
  Anton: "Anton, Impact, sans-serif",
  Inter: "Inter, sans-serif",
  Poppins: "Poppins, Inter, sans-serif",
  Komika: "Komika, Impact, sans-serif",
};

const VideoPlayerCanvas = forwardRef<HTMLVideoElement, {
  videoUrl: string;
  posterUrl?: string;
  currentTime: number;
  words: EditorWord[];
  style: CaptionStyleConfig;
  layout: FramingLayout;
  onTimeUpdate: (time: number) => void;
  onLoadedMetadata: (duration: number) => void;
}>(({ videoUrl, posterUrl, currentTime, words, style, layout, onTimeUpdate, onLoadedMetadata }, ref) => {
  const { phrase, activeId } = useMemo(
    () => activePhrase(words, currentTime, style.maxWordsPerScreen),
    [words, currentTime, style.maxWordsPerScreen],
  );

  const media = (
    <video
      ref={ref}
      src={videoUrl}
      poster={posterUrl}
      playsInline
      preload="metadata"
      crossOrigin="anonymous"
      onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
      onLoadedMetadata={(event) => onLoadedMetadata(event.currentTarget.duration)}
      className="h-full w-full object-cover"
    />
  );

  return (
    <div className="relative mx-auto aspect-[9/16] h-[min(58vh,640px)] min-h-[440px] overflow-hidden border border-white/10 bg-black shadow-[0_28px_80px_rgba(0,0,0,.55)]">
      {layout === "blur_fit" ? (
        <>
          <video src={videoUrl} muted aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl opacity-55" />
          <div className="absolute inset-0 bg-black/25" />
          <video
            ref={ref}
            src={videoUrl}
            poster={posterUrl}
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => onLoadedMetadata(event.currentTarget.duration)}
            className="relative z-[1] h-full w-full object-contain"
          />
        </>
      ) : layout === "split_stack" ? (
        <>
          <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden border-b border-black">{media}</div>
          <video src={videoUrl} muted aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 w-full scale-[1.35] object-cover" />
        </>
      ) : media}

      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
        <span className="border border-white/10 bg-black/55 px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-white/60 backdrop-blur">LIVE · 1080 × 1920</span>
      </div>

      {phrase.length > 0 && (
        <div className={`pointer-events-none absolute inset-x-4 z-20 flex justify-center text-center ${POSITION[style.positionY]}`}>
          <div className={style.preset === "minimal" ? "bg-black/70 px-3 py-1.5 backdrop-blur-sm" : "px-2 py-1"}>
            {phrase.map((word) => {
              const active = word.id === activeId;
              const display = style.uppercase ? word.w.toUpperCase() : word.w;
              const common = {
                fontFamily: FONT[style.fontFamily],
                fontSize: `${style.fontSize}px`,
                color: active || word.emph ? style.highlightColor : style.primaryColor,
                WebkitTextStroke: `${style.strokeWidth}px ${style.strokeColor}`,
                paintOrder: "stroke fill" as const,
                textShadow: style.preset === "neon" || style.preset === "karaoke" ? `0 0 12px ${active ? style.highlightColor : "transparent"}` : "0 4px 8px rgba(0,0,0,.55)",
              };
              return (
                <motion.span
                  key={word.id}
                  initial={style.preset === "beast" ? { scale: 0.72, y: 10, opacity: 0 } : false}
                  animate={{ scale: active ? 1.08 : 1, y: 0, opacity: 1, rotate: style.preset === "hormozi" && active ? -1.5 : 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 26 }}
                  className="mx-[0.12em] inline-block font-black leading-[1.02] tracking-[-0.035em]"
                  style={common}
                >
                  {display}
                </motion.span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

VideoPlayerCanvas.displayName = "VideoPlayerCanvas";
export default VideoPlayerCanvas;
