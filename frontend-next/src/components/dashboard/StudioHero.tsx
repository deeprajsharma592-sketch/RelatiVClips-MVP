"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Play,
  Sparkles,
  Link2,
  FolderOpen,
  ArrowRight,
  Video,
  FileVideo,
  Layers,
  Check,
  ChevronRight,
  ExternalLink,
  Flame,
  Gamepad2,
  Mic,
  Smile,
  Scissors,
} from "lucide-react";
import PreGenConfigModal, { RecipeConfig } from "./PreGenConfigModal";
import { uploadVideoFile, submitLocalVideo } from "@/lib/api";

const URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;

interface StudioHeroProps {
  onStartProcess?: (taskId: string, template?: string) => void;
  onSubmitUrl?: (url: string, template?: string) => void;
  onOpenUpgrade?: () => void;
}

// ── Recipe / Template Skill Pills ──
interface RecipePill {
  id: "podcast" | "streamer" | "gaming" | "educational" | "captions" | "reframe" | "broll";
  label: string;
  icon: string;
  isHot?: boolean;
}

const RECIPE_PILLS: RecipePill[] = [
  { id: "podcast", label: "Clip Podcast Interviews", icon: "🎙️" },
  { id: "gaming", label: "Clip Gaming Streams", icon: "🎮", isHot: true },
  { id: "streamer", label: "Streamer & Reactions", icon: "⚡" },
  { id: "educational", label: "Auto-edit Talking Videos", icon: "💡" },
  { id: "captions", label: "Karaoke Captions", icon: "✨" },
  { id: "reframe", label: "Dynamic 9:16 Reframe", icon: "🎯" },
  { id: "broll", label: "AI B-roll & Overlays", icon: "🔥", isHot: true },
];

// ── Demo Projects ──
interface DemoProject {
  id: string;
  title: string;
  speaker: string;
  clipsCount: number;
  thumbnailUrl: string;
  videoUrl: string;
  template: "podcast" | "streamer" | "gaming";
}

const DEMO_PROJECTS: DemoProject[] = [
  {
    id: "demo-1",
    title: "24 Hours with Danny Duncan (The $1M Van)",
    speaker: "Danny Duncan",
    clipsCount: 18,
    thumbnailUrl: "/thumb_r1.webp",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    template: "streamer",
  },
  {
    id: "demo-2",
    title: "Curry Drills 12 Threes Including The Game Winner",
    speaker: "Steph Curry",
    clipsCount: 12,
    thumbnailUrl: "/thumb_r2.webp",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    template: "gaming",
  },
  {
    id: "demo-3",
    title: "Tal Wilkenfeld #408 Lex Fridman Podcast",
    speaker: "Lex Fridman & Tal Wilkenfeld",
    clipsCount: 25,
    thumbnailUrl: "/thumb_r3.webp",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    template: "podcast",
  },
];

export default function StudioHero({
  onStartProcess,
  onSubmitUrl,
  onOpenUpgrade,
}: StudioHeroProps) {
  const [activeTab, setActiveTab] = useState<"clip" | "auto-edit">("clip");
  const [inputText, setInputText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("podcast");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger configuration modal when URL is ready
  const handleUrlSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (!URL_REGEX.test(trimmed)) {
      setError("Please paste a valid YouTube video link (e.g. youtube.com/watch?v=...)");
      return;
    }

    setError(null);
    setIsConfigModalOpen(true);
  };

  // Recipe Pill click: pre-select archetype and open config
  const handlePillClick = (pillId: string) => {
    setSelectedTemplate(pillId);
    if (inputText.trim() && URL_REGEX.test(inputText.trim())) {
      setIsConfigModalOpen(true);
    } else {
      // If input is empty, prefill with sample
      setInputText("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      setIsConfigModalOpen(true);
    }
  };

  // File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
      setError("Please select a valid video file (MP4, MOV, WEBM).");
      return;
    }

    setError(null);
    setUploadStatus("Uploading footage to Studio...");

    try {
      const { filePath } = await uploadVideoFile(file);
      setUploadStatus("Starting AI virality pipeline...");
      const init = await submitLocalVideo(filePath);
      if (onStartProcess) {
        onStartProcess(init.taskId, selectedTemplate);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload video.");
    } finally {
      setUploadStatus(null);
    }
  };

  // Confirmed in Config Modal -> Start Processing
  const handleConfirmGeneration = (config: RecipeConfig) => {
    setIsConfigModalOpen(false);
    if (onSubmitUrl) {
      onSubmitUrl(inputText.trim(), config.template);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* ── Main Intake Station (Matching Reference) ── */}
      <div className="w-full bg-[#12131A] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Dual Tab Switcher */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("clip")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === "clip"
                ? "bg-white/10 text-white border border-white/10 shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeTab === "clip" ? "bg-emerald-400" : "bg-transparent"}`} />
            Clip long video
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("auto-edit")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === "auto-edit"
                ? "bg-white/10 text-white border border-white/10 shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Sparkles size={13} className="text-purple-400" />
            Auto-edit footage
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleUrlSubmit} className="relative mb-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-xl bg-black/60 border border-white/15 focus-within:border-cyan-400/80 transition shadow-inner">
            <div className="flex items-center gap-2.5 px-3 flex-1">
              <Link2 size={16} className="text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Drop a YouTube link (podcasts, streams, gaming, tutorials)..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="py-3 px-6 rounded-lg bg-white text-black font-bold text-xs hover:bg-zinc-200 transition flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
            >
              Get clips in 1 click
              <ArrowRight size={14} />
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400 mt-2 px-1 flex items-center gap-1">
              <span>⚠️</span> {error}
            </p>
          )}

          {uploadStatus && (
            <p className="text-xs text-cyan-400 mt-2 px-1 flex items-center gap-1">
              <span className="animate-spin">⏳</span> {uploadStatus}
            </p>
          )}
        </form>

        {/* Secondary Intake Triggers */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
          {/* Upload File */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 hover:text-white transition"
          >
            <Upload size={14} className="text-zinc-400" />
            <span>Upload video</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <span className="text-zinc-700">•</span>

          {/* Sample Project */}
          <button
            type="button"
            onClick={() => {
              setInputText("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
              setIsConfigModalOpen(true);
            }}
            className="flex items-center gap-1.5 hover:text-cyan-300 text-zinc-400 transition"
          >
            <Sparkles size={14} className="text-cyan-400" />
            <span>Try a sample project</span>
          </button>
        </div>
      </div>

      {/* ── Recipe / Template Skill Pills Row (Matching Reference) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wider text-zinc-400 text-[11px]">
            Content Archetype Skills
          </span>
          <span className="text-zinc-500">Pick a style for specialized viral scoring</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {RECIPE_PILLS.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => handlePillClick(pill.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-cyan-400/50 text-xs font-medium text-zinc-200 transition group relative"
            >
              <span>{pill.icon}</span>
              <span>{pill.label}</span>
              {pill.isHot && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Start from a Demo Project Carousel (Matching Reference) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Start from a demo project
            </h3>
            <p className="text-xs text-zinc-400">
              Instant preview of AI viral cuts, karaoke captions, and face framing
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DEMO_PROJECTS.map((demo) => (
            <div
              key={demo.id}
              className="group relative bg-[#12131A] border border-white/10 hover:border-white/20 rounded-xl overflow-hidden transition flex flex-col justify-between"
            >
              {/* Thumbnail Area */}
              <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                
                {/* Fallback pattern / thumbnail */}
                <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center text-zinc-600 group-hover:scale-105 transition duration-300">
                  <Play size={28} className="text-white/60 group-hover:text-white transition" />
                </div>

                {/* Badge */}
                <div className="absolute top-2.5 left-2.5 z-20 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-white">
                  {demo.clipsCount} clips
                </div>
              </div>

              {/* Title & Try It button */}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="truncate">
                  <h4 className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition">
                    {demo.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 truncate">{demo.speaker}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setInputText(demo.videoUrl);
                    setSelectedTemplate(demo.template);
                    setIsConfigModalOpen(true);
                  }}
                  className="px-3 py-1 rounded-full bg-white/10 hover:bg-white text-zinc-200 hover:text-black text-xs font-bold transition shrink-0"
                >
                  Try it
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pre-Generation Configuration Drawer/Modal ── */}
      <PreGenConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        videoUrl={inputText}
        onConfirm={handleConfirmGeneration}
        onOpenUpgrade={onOpenUpgrade}
      />
    </div>
  );
}
