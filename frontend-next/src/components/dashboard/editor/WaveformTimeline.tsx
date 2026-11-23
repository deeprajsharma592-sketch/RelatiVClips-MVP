"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import type { EditorWord } from "@/types/editor";

function stamp(value: number, precise = false) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toFixed(precise ? 2 : 0).padStart(precise ? 5 : 2, "0")}`;
}

export default function WaveformTimeline({
  videoUrl,
  duration,
  currentTime,
  trimStart,
  trimEnd,
  words,
  isPlaying,
  playbackRate,
  onSeek,
  onTrimChange,
  onTogglePlay,
  onPlaybackRate,
}: {
  videoUrl: string;
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  words: EditorWord[];
  isPlaying: boolean;
  playbackRate: number;
  onSeek: (time: number) => void;
  onTrimChange: (start: number, end: number) => void;
  onTogglePlay: () => void;
  onPlaybackRate: (rate: number) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [wordSnap, setWordSnap] = useState(true);
  const [dragging, setDragging] = useState<"start" | "end" | "playhead" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const build = async () => {
      try {
        const response = await fetch(videoUrl);
        const buffer = await response.arrayBuffer();
        const context = new AudioContext();
        const audio = await context.decodeAudioData(buffer.slice(0));
        const data = audio.getChannelData(0);
        const bars = 220;
        const step = Math.max(1, Math.floor(data.length / bars));
        const result = Array.from({ length: bars }, (_, index) => {
          let max = 0;
          const from = index * step;
          for (let i = from; i < Math.min(data.length, from + step); i += Math.max(1, Math.floor(step / 80))) max = Math.max(max, Math.abs(data[i]));
          return Math.max(0.05, max);
        });
        const ceiling = Math.max(...result, 0.1);
        if (!cancelled) setPeaks(result.map((peak) => peak / ceiling));
        void context.close();
      } catch {
        if (!cancelled) setPeaks(Array.from({ length: 180 }, (_, index) => 0.18 + Math.abs(Math.sin(index * 0.37)) * 0.55));
      }
    };
    void build();
    return () => { cancelled = true; };
  }, [videoUrl]);

  const pct = (value: number) => `${Math.max(0, Math.min(100, (value / Math.max(duration, 0.1)) * 100))}%`;
  const snapPoints = useMemo(() => words.flatMap((word) => [word.start, word.end]), [words]);

  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => {
      const rect = railRef.current?.getBoundingClientRect();
      if (!rect) return;
      let value = Math.max(0, Math.min(duration, ((event.clientX - rect.left) / rect.width) * duration));
      if (wordSnap && dragging !== "playhead") {
        const nearest = snapPoints.reduce((best, point) => Math.abs(point - value) < Math.abs(best - value) ? point : best, value);
        if (Math.abs(nearest - value) <= 0.3) value = nearest;
      }
      if (dragging === "start") onTrimChange(Math.min(value, trimEnd - 0.5), trimEnd);
      else if (dragging === "end") onTrimChange(trimStart, Math.max(value, trimStart + 0.5));
      else onSeek(value);
    };
    const up = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [dragging, duration, onSeek, onTrimChange, snapPoints, trimEnd, trimStart, wordSnap]);

  return (
    <div className="border-t border-white/[0.09] bg-[#0B0C0F] px-4 py-3 lg:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onSeek(Math.max(trimStart, currentTime - 1))} className="grid size-8 place-items-center border border-white/10 text-[#A8A9AE] hover:text-white" title="J · rewind 1 second"><RotateCcw className="size-3.5" /></button>
          <button type="button" onClick={onTogglePlay} className="grid size-9 place-items-center bg-[#E7B84B] text-black hover:bg-[#F0C96A]">{isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}</button>
          <button type="button" onClick={() => onSeek(Math.min(trimEnd, currentTime + 1))} className="grid size-8 place-items-center border border-white/10 text-[#A8A9AE] hover:text-white" title="L · forward 1 second"><RotateCw className="size-3.5" /></button>
          <select value={playbackRate} onChange={(event) => onPlaybackRate(Number(event.target.value))} className="ml-1 h-8 border border-white/10 bg-[#101116] px-2 font-mono text-[10px] text-[#BCBDC1] outline-none">
            <option value={1}>1.0×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option>
          </select>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] text-[#777980]">
          <span>IN <b className="text-[#D8D6CE]">{stamp(trimStart, true)}</b></span>
          <span>OUT <b className="text-[#D8D6CE]">{stamp(trimEnd, true)}</b></span>
          <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={wordSnap} onChange={(event) => setWordSnap(event.target.checked)} className="accent-[#4FD1C5]" /> WORD SNAP</label>
        </div>
      </div>

      <div
        ref={railRef}
        className="relative h-24 touch-none select-none overflow-hidden border-y border-white/[0.08] bg-[#08090C]"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          onSeek(Math.max(0, Math.min(duration, ((event.clientX - rect.left) / rect.width) * duration)));
          setDragging("playhead");
        }}
      >
        <div className="absolute inset-0 flex items-center gap-px px-1">
          {(peaks.length ? peaks : Array.from({ length: 180 }, () => 0.2)).map((peak, index) => <span key={index} className="min-w-px flex-1 bg-[#3B3D43]" style={{ height: `${Math.max(6, peak * 70)}%` }} />)}
        </div>
        <div className="absolute inset-y-0 bg-[#4FD1C5]/10" style={{ left: pct(trimStart), right: `${100 - Number.parseFloat(pct(trimEnd))}%` }} />
        <div className="absolute inset-y-0 left-0 bg-black/65" style={{ width: pct(trimStart) }} />
        <div className="absolute inset-y-0 right-0 bg-black/65" style={{ width: `${100 - Number.parseFloat(pct(trimEnd))}%` }} />

        {(["start", "end"] as const).map((kind) => {
          const value = kind === "start" ? trimStart : trimEnd;
          return <button key={kind} type="button" onPointerDown={(event) => { event.stopPropagation(); setDragging(kind); }} className="absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize bg-[#E7B84B] shadow-[0_0_18px_rgba(231,184,75,.22)]" style={{ left: pct(value) }}><span className="absolute top-1/2 left-1/2 h-5 w-px -translate-x-1/2 -translate-y-1/2 bg-black/50" /></button>;
        })}
        <button type="button" aria-label="Scrub playhead" onPointerDown={(event) => { event.stopPropagation(); setDragging("playhead"); }} className="absolute inset-y-0 z-30 w-px bg-[#4FD1C5] shadow-[0_0_12px_#4FD1C5]" style={{ left: pct(currentTime) }}><span className="absolute -top-0.5 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-[#4FD1C5]" /></button>
        <span className="absolute bottom-1 left-2 font-mono text-[9px] text-[#55575E]">00:00</span>
        <span className="absolute right-2 bottom-1 font-mono text-[9px] text-[#55575E]">{stamp(duration)}</span>
      </div>
    </div>
  );
}
