"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Captions, Crop, Loader2, Save, X } from "lucide-react";
import type { Clip } from "@/types";
import type { CaptionStyleConfig, ClipRemakePayload, EditorWord, FramingLayout } from "@/types/editor";
import { apiPath } from "@/lib/apiBase";
import { remakeClip } from "@/lib/api";
import CaptionStyleControls from "./CaptionStyleControls";
import LayoutSelector from "./LayoutSelector";
import TranscriptEditor from "./TranscriptEditor";
import VideoPlayerCanvas from "./VideoPlayerCanvas";
import WaveformTimeline from "./WaveformTimeline";

const DEFAULT_STYLE: CaptionStyleConfig = {
  preset: "karaoke",
  fontFamily: "Montserrat",
  fontSize: 42,
  primaryColor: "#FFFFFF",
  highlightColor: "#FACC15",
  strokeColor: "#000000",
  strokeWidth: 3,
  positionY: "bottom",
  uppercase: true,
  maxWordsPerScreen: 3,
};

function normalizeWords(clip: Clip, duration: number): EditorWord[] {
  const supplied = clip.caption_words || [];
  if (supplied.length) {
    const absolute = clip.start > 0.5 && supplied.some((word) => word.start > duration + 0.5);
    return supplied.map((word, index) => ({
      id: `${clip.clip_id}-${index}`,
      w: String(word.w || word.word || "").trim(),
      start: Math.max(0, Number(word.start) - (absolute ? clip.start : 0)),
      end: Math.min(duration, Math.max(Number(word.start) + 0.06, Number(word.end)) - (absolute ? clip.start : 0)),
      emph: Number(word.emph || 0),
      deleted: Boolean(word.deleted),
    })).filter((word) => word.w && word.start < duration);
  }
  const fallback = `${clip.viral_title || ""} ${clip.caption || ""}`.trim().split(/\s+/).slice(0, 90);
  const step = Math.max(0.22, (duration - 0.4) / Math.max(fallback.length, 1));
  return fallback.map((w, index) => ({ id: `${clip.clip_id}-fallback-${index}`, w, start: 0.2 + index * step, end: Math.min(duration, 0.2 + (index + 0.85) * step), emph: 0 }));
}

function videoUrl(clip: Clip) {
  if (clip.download_url) return clip.download_url.startsWith("http") ? clip.download_url : apiPath(clip.download_url);
  if (clip.file_path?.startsWith("http")) return clip.file_path;
  return apiPath(`/download/${clip.clip_id}`);
}

export default function ClipEditorModal({
  clip,
  index = 0,
  onClose,
  onSaveSuccess,
}: {
  clip: Clip | null;
  index?: number;
  onClose: () => void;
  onSaveSuccess: (clip: Clip) => void;
}) {
  const playerRef = useRef<HTMLVideoElement>(null);
  const initialDuration = Math.max(0.5, clip?.duration_s || ((clip?.end || 0) - (clip?.start || 0)) || 30);
  const [duration, setDuration] = useState(initialDuration);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(initialDuration);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [words, setWords] = useState<EditorWord[]>(() => clip ? normalizeWords(clip, initialDuration) : []);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [layout, setLayout] = useState<FramingLayout>("auto_face");
  const [tool, setTool] = useState<"captions" | "crop">("captions");
  const [isDirty, setDirty] = useState(false);
  const [isRendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const poster = clip?.thumbnail_url ? (clip.thumbnail_url.startsWith("http") ? clip.thumbnail_url : apiPath(clip.thumbnail_url)) : clip ? apiPath(`/thumbnail/${clip.clip_id}`) : undefined;
  const src = clip ? videoUrl(clip) : "";

  const seek = useCallback((time: number) => {
    const bounded = Math.max(trimStart, Math.min(trimEnd, time));
    if (playerRef.current) playerRef.current.currentTime = bounded;
    setCurrentTime(bounded);
  }, [trimEnd, trimStart]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.paused) {
      if (player.currentTime < trimStart || player.currentTime >= trimEnd) player.currentTime = trimStart;
      void player.play(); setIsPlaying(true);
    } else { player.pause(); setIsPlaying(false); }
  }, [trimEnd, trimStart]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input, textarea, select")) return;
      if (event.code === "Space") { event.preventDefault(); togglePlay(); }
      if (event.key.toLowerCase() === "j") seek(currentTime - 1);
      if (event.key.toLowerCase() === "l") seek(currentTime + 1);
      if (event.key.toLowerCase() === "i") { setTrimStart(Math.min(currentTime, trimEnd - 0.5)); setDirty(true); }
      if (event.key.toLowerCase() === "o") { setTrimEnd(Math.max(currentTime, trimStart + 0.5)); setDirty(true); }
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [currentTime, onClose, seek, togglePlay, trimEnd, trimStart]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.playbackRate = playbackRate;
  }, [playbackRate]);

  const deletedSpan = useMemo(() => words.filter((word) => word.deleted).reduce((sum, word) => sum + Math.max(0, word.end - word.start), 0), [words]);
  const editedDuration = Math.max(0, trimEnd - trimStart - deletedSpan);

  const save = async () => {
    if (!clip || isRendering) return;
    setRendering(true); setError(null); setRenderProgress(8);
    const timer = window.setInterval(() => setRenderProgress((value) => Math.min(88, value + Math.max(1, (88 - value) * 0.08))), 550);
    const payload: ClipRemakePayload = {
      start: trimStart,
      end: trimEnd,
      caption_style: {
        preset: style.preset,
        font: style.fontFamily,
        font_size: style.fontSize,
        primary_color: style.primaryColor,
        highlight_color: style.highlightColor,
        stroke_color: style.strokeColor,
        stroke_width: style.strokeWidth,
        position: style.positionY,
        uppercase: style.uppercase,
        max_words_per_screen: style.maxWordsPerScreen,
      },
      words: words.map((word) => ({
        w: word.w,
        start: word.start,
        end: word.end,
        emph: word.emph,
        deleted: word.deleted,
      })),
      layout,
    };
    try {
      const response = await remakeClip(clip.clip_id, payload);
      setRenderProgress(100); setDirty(false);
      onSaveSuccess({ ...clip, ...(response.clip || {}), download_url: response.download_url || response.clip?.download_url, thumbnail_url: response.thumbnail_url || response.clip?.thumbnail_url });
      window.setTimeout(onClose, 450);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The HD remake failed.");
    } finally {
      window.clearInterval(timer); setRendering(false);
    }
  };

  if (!clip) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-[#08090C] text-[#F4F1E8]">
        <header className="flex h-16 items-center justify-between border-b border-white/[0.09] bg-[#0B0C0F] px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center border border-white/10 text-[#96989E] hover:bg-white/5 hover:text-white"><X className="size-4" /></button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Clip {String(index + 1).padStart(2, "0")} · {clip.viral_title || "Untitled cut"}</div>
              <div className="mt-0.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#66686F]">
                <span>{isDirty ? "Unsaved edit" : "Changes saved"}</span><span>·</span><span>{editedDuration.toFixed(1)} sec</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={save} disabled={isRendering} className="flex h-10 items-center gap-2 bg-[#E7B84B] px-3.5 text-xs font-bold text-black transition hover:bg-[#F0C96A] disabled:cursor-wait disabled:opacity-70 sm:px-5">
            {isRendering ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span className="hidden sm:inline">{isRendering ? `Rendering ${Math.round(renderProgress)}%` : "Save & Render HD"}</span>
          </button>
        </header>

        {error && <div className="absolute top-16 inset-x-0 z-50 flex items-center justify-between border-b border-[#F26D6D]/30 bg-[#2A1014] px-5 py-2 text-xs text-[#FFB7BE]"><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}

        <div className="grid h-[calc(100vh-64px)] grid-cols-1 overflow-y-auto lg:grid-cols-[272px_minmax(420px,1fr)_330px] lg:grid-rows-[minmax(0,1fr)_152px] lg:overflow-hidden">
          <aside className="order-3 border-r border-white/[0.08] bg-[#101116] lg:order-none lg:min-h-0 lg:overflow-y-auto">
            <div className="grid grid-cols-2 border-b border-white/[0.08]">
              <button onClick={() => setTool("captions")} className={`flex h-12 items-center justify-center gap-2 text-xs ${tool === "captions" ? "border-b border-[#4FD1C5] text-white" : "text-[#777980]"}`}><Captions className="size-3.5" /> Captions</button>
              <button onClick={() => setTool("crop")} className={`flex h-12 items-center justify-center gap-2 text-xs ${tool === "crop" ? "border-b border-[#4FD1C5] text-white" : "text-[#777980]"}`}><Crop className="size-3.5" /> Frame</button>
            </div>
            <div className="p-4">
              {tool === "captions" ? <CaptionStyleControls value={style} onChange={(next) => { setStyle(next); setDirty(true); }} /> : <LayoutSelector value={layout} onChange={(next) => { setLayout(next); setDirty(true); }} />}
            </div>
          </aside>

          <main className="order-1 relative flex min-h-[620px] items-center justify-center bg-[#0A0B0E] px-4 py-6 lg:order-none lg:min-h-0">
            <div aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-white/[0.025]" />
            <VideoPlayerCanvas
              ref={playerRef}
              videoUrl={src}
              posterUrl={poster}
              currentTime={currentTime}
              words={words}
              style={style}
              layout={layout}
              onTimeUpdate={(time) => {
                if (time >= trimEnd) seek(trimStart);
                const deleted = words.find((word) => word.deleted && time >= word.start && time < word.end);
                if (deleted && playerRef.current) playerRef.current.currentTime = deleted.end + 0.01;
                setCurrentTime(time);
              }}
              onLoadedMetadata={(next) => { if (Number.isFinite(next) && next > 0) { setDuration(next); setTrimEnd((old) => Math.min(old, next)); } }}
            />
          </main>

          <aside className="order-4 min-h-[460px] border-l border-white/[0.08] bg-[#101116] lg:order-none lg:min-h-0">
            <TranscriptEditor words={words} currentTime={currentTime} onSeek={seek} onChange={(next) => { setWords(next); setDirty(true); }} />
          </aside>

          <div className="order-2 lg:order-none lg:col-span-3">
            <WaveformTimeline
              videoUrl={src} duration={duration} currentTime={currentTime} trimStart={trimStart} trimEnd={trimEnd} words={words}
              isPlaying={isPlaying} playbackRate={playbackRate} onSeek={seek}
              onTrimChange={(start, end) => { setTrimStart(start); setTrimEnd(end); setDirty(true); }}
              onTogglePlay={togglePlay} onPlaybackRate={(rate) => { setPlaybackRate(rate); if (playerRef.current) playerRef.current.playbackRate = rate; }}
            />
          </div>
        </div>

        {isRendering && <div className="pointer-events-none absolute inset-x-0 top-[63px] z-50 h-0.5 bg-white/5"><motion.div className="h-full bg-[#4FD1C5]" animate={{ width: `${renderProgress}%` }} /></div>}
      </motion.div>
    </AnimatePresence>
  );
}
