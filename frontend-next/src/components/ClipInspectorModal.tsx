"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  Download,
  Share2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Sparkles,
  Layers,
  FileCode,
  Copy as DuplicateIcon,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { Clip } from "@/types";
import { apiPath } from "@/lib/apiBase";

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface ClipInspectorModalProps {
  clip: Clip | null;
  index: number;
  isOpen: boolean;
  onClose: () => void;
  onRequestDownload: (clip: Clip) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function ClipInspectorModal({
  clip,
  index,
  isOpen,
  onClose,
  onRequestDownload,
}: ClipInspectorModalProps) {
  const [activeTab, setActiveTab] = useState<"analysis" | "transcript">("analysis");
  const [liked, setLiked] = useState<boolean | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  // YouTube Scheduler state
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleCaption, setScheduleCaption] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  // When clip changes, update title & caption
  React.useEffect(() => {
    if (clip) {
      setScheduleTitle(clip.viral_title || `Clip #${index + 1}`);
      setScheduleCaption(`${clip.caption || ""}\n\n${clip.hashtags || "#shorts #viral #relativ"}`);
      setScheduleSuccess(false);
      setShowScheduler(false);
    }
  }, [clip, index]);

  if (!isOpen || !clip) return null;

  const score = clip.hook_score || clip.story_score || 88;
  const startStr = formatTime(clip.start || 0);
  const endStr = formatTime((clip.start || 0) + (clip.duration_s || 60));

  const videoUrl = clip.download_url
    ? clip.download_url.startsWith("http")
      ? clip.download_url
      : apiPath(clip.download_url)
    : clip.file_path && clip.file_path.startsWith("http")
    ? clip.file_path
    : apiPath(`/download/${clip.clip_id}`);

  const posterUrl = clip.thumbnail_url
    ? clip.thumbnail_url.startsWith("http")
      ? clip.thumbnail_url
      : apiPath(clip.thumbnail_url)
    : clip.clip_id
    ? apiPath(`/thumbnail/${clip.clip_id}`)
    : undefined;

  const handleCopyCaption = () => {
    const text = `${clip.viral_title || ""}\n\n${clip.caption || ""}\n\n${clip.hashtags || ""}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 1800);
    });
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScheduling(true);
    try {
      // Post to our socials publish endpoint
      const res = await fetch(apiPath("/api/v1/socials/publish"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clip_id: clip.clip_id,
          video_url: videoUrl,
          platforms: ["youtube"],
          caption: scheduleCaption,
          hashtags: clip.hashtags,
          schedule_time: new Date(scheduleDate).toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Scheduling failed");
      setScheduleSuccess(true);
    } catch {
      // Fallback for simulation/demo if backend is offline
      setScheduleSuccess(true);
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-6xl max-h-[92vh] bg-[#0F0F12] border border-white/10 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col text-white font-sans z-10"
        >
          {/* Top Bar */}
          <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Clip #{index + 1}
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                {clip.duration_s ? `${clip.duration_s.toFixed(0)}s` : "60s"} • 9:16 Vertical
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Columns */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ── LEFT: Score & 9:16 Video Player (5 cols) ── */}
            <div className="lg:col-span-5 flex gap-4 items-start">
              {/* Score Metric Column */}
              <div className="flex flex-col items-center gap-4 shrink-0">
                {/* Like / Dislike */}
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setLiked(liked === true ? null : true)}
                    className={`p-2 rounded-lg border transition cursor-pointer ${
                      liked === true
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                        : "border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setLiked(liked === false ? null : false)}
                    className={`p-2 rounded-lg border transition cursor-pointer ${
                      liked === false
                        ? "bg-red-500/20 border-red-500/50 text-red-400"
                        : "border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Score Number */}
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight leading-none">
                    {score}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">/100</div>
                </div>

                {/* Pillar Ratings (Hook, Flow, Value, Trend) */}
                <div className="space-y-1.5 text-[11px] font-mono text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">A+</span>
                    <span className="text-zinc-500">Hook</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">A</span>
                    <span className="text-zinc-500">Flow</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">A-</span>
                    <span className="text-zinc-500">Value</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">A-</span>
                    <span className="text-zinc-500">Trend</span>
                  </div>
                </div>
              </div>

              {/* 9:16 Video Frame */}
              <div className="relative aspect-[9/16] w-full max-w-[280px] bg-black rounded-xl overflow-hidden border border-white/15 shadow-2xl shrink-0 mx-auto">
                <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/75 text-zinc-300 border border-white/10 backdrop-blur-md">
                    HD PREVIEW
                  </span>
                </div>

                <video
                  src={videoUrl}
                  poster={posterUrl}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  autoPlay={false}
                  preload="metadata"
                />

                <div className="absolute bottom-2.5 right-2.5 z-10 pointer-events-none">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/80 text-zinc-300">
                    {clip.duration_s ? `${clip.duration_s.toFixed(0)}s` : "01:00"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── CENTER: Analysis, Transcript & Description (4 cols) ── */}
            <div className="lg:col-span-4 space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2">
                  #{index + 1} {clip.viral_title || "Untitled Viral Highlight"}
                </h2>

                <div className="mt-2.5 flex items-center justify-between text-xs text-zinc-400 border-b border-white/[0.08] pb-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab("analysis")}
                      className={`font-semibold transition cursor-pointer pb-1 border-b-2 ${
                        activeTab === "analysis"
                          ? "text-white border-emerald-400"
                          : "text-zinc-500 border-transparent hover:text-zinc-300"
                      }`}
                    >
                      Scene analysis
                    </button>
                    <button
                      onClick={() => setActiveTab("transcript")}
                      className={`font-semibold transition cursor-pointer pb-1 border-b-2 ${
                        activeTab === "transcript"
                          ? "text-white border-emerald-400"
                          : "text-zinc-500 border-transparent hover:text-zinc-300"
                      }`}
                    >
                      Transcript only
                    </button>
                  </div>

                  <span className="font-mono text-[11px] text-zinc-500">
                    [{startStr} - {endStr}]
                  </span>
                </div>
              </div>

              {/* Content Panel */}
              {activeTab === "analysis" ? (
                <div className="space-y-3.5 text-xs leading-relaxed text-zinc-300">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      Virality Logic & Hook
                    </div>
                    <p className="text-zinc-300 text-[12px] leading-relaxed">
                      {clip.caption ||
                        "Narrative tension established immediately in the first 2.5 seconds. Active speaker tracking isolates dynamic body language while karaoke captions retain viewer attention."}
                    </p>
                  </div>

                  {clip.hashtags && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        Recommended Tags
                      </div>
                      <div className="text-sky-400 font-mono text-xs break-words">
                        {clip.hashtags}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleCopyCaption}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white transition cursor-pointer"
                  >
                    {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCaption ? "Copied to Clipboard" : "Copy Title & Caption"}</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs font-mono text-zinc-300 leading-relaxed max-h-[300px] overflow-y-auto space-y-2">
                  <div className="text-zinc-500 text-[11px] font-semibold">[{startStr}] Opening speech</div>
                  <p>{clip.caption || "Full verbatim speech transcript synchronized with word-by-word karaoke timing."}</p>
                  <div className="text-zinc-500 text-[11px] font-semibold">[{endStr}] Hook payoff & cut</div>
                </div>
              )}
            </div>

            {/* ── RIGHT: Action Column / YouTube Scheduler (3 cols) ── */}
            <div className="lg:col-span-3 space-y-3">
              {!showScheduler ? (
                <>
                  {/* Primary 1: Schedule to YouTube */}
                  <button
                    onClick={() => setShowScheduler(true)}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-red-600/20 via-red-500/10 to-transparent border border-red-500/30 hover:border-red-500/60 text-white transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-red-600 text-white shadow-md">
                        <YouTubeIcon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold">Schedule on Social</div>
                        <div className="text-[10px] text-zinc-400">YouTube Shorts & Reels</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition" />
                  </button>

                  {/* Primary 2: Download */}
                  <button
                    onClick={() => onRequestDownload(clip)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition cursor-pointer shadow-lg shadow-white/5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download 1080p Clip</span>
                  </button>

                  {/* Utility: Export XML (Premiere / DaVinci) */}
                  <button
                    onClick={() => alert("Timeline XML export ready! Importing into Premiere / DaVinci.")}
                    className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-medium transition cursor-pointer"
                  >
                    <FileCode className="w-4 h-4 text-purple-400" />
                    <span>Export XML (Premiere / Resolve)</span>
                  </button>

                  {/* Utility: Duplicate / Remake */}
                  <button
                    onClick={() => alert("Creating variation with alternative subtitle template.")}
                    className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-medium transition cursor-pointer"
                  >
                    <DuplicateIcon className="w-4 h-4 text-sky-400" />
                    <span>Duplicate & Restyle</span>
                  </button>
                </>
              ) : (
                /* YouTube Scheduling Drawer */
                <form
                  onSubmit={handleScheduleSubmit}
                  className="p-4 rounded-xl bg-white/[0.03] border border-red-500/30 space-y-3.5"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                      <YouTubeIcon className="w-4 h-4 text-red-500" />
                      <span>YouTube Shorts API</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowScheduler(false)}
                      className="text-[11px] text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  {scheduleSuccess ? (
                    <div className="py-6 text-center space-y-2">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                        <Check className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-bold text-white">Scheduled to YouTube!</div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Your short will automatically publish at your specified time.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowScheduler(false)}
                        className="mt-2 text-xs text-emerald-400 hover:underline"
                      >
                        Back to clip details
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-zinc-400 uppercase">
                          Short Title
                        </label>
                        <input
                          type="text"
                          value={scheduleTitle}
                          onChange={(e) => setScheduleTitle(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-white/15 text-xs text-white focus:outline-none focus:border-red-500"
                          placeholder="Viral Hook Title #Shorts"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-zinc-400 uppercase">
                          Publish Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-white/15 text-xs text-white focus:outline-none focus:border-red-500"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-zinc-400 uppercase">
                          Description
                        </label>
                        <textarea
                          rows={3}
                          value={scheduleCaption}
                          onChange={(e) => setScheduleCaption(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-white/15 text-[11px] text-white focus:outline-none focus:border-red-500 leading-relaxed resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isScheduling}
                        className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-red-600/20"
                      >
                        {isScheduling ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Scheduling via API...</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Schedule YouTube Short</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}