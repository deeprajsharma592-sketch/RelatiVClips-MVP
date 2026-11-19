"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Share2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Upload,
  Calendar,
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2,
  ShieldCheck,
  Zap,
  Play,
  Film,
  Send,
  Sliders,
  Check,
} from "lucide-react";
import { apiPath } from "@/lib/apiBase";

// ── SVG Brand Icons for YouTube, TikTok, Instagram ─────────────────────────
export function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function TiktokIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

export function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export interface ConnectedAccount {
  id: string;
  platform: "youtube" | "tiktok" | "instagram";
  name: string;
  handle: string;
  followers: string;
  avatarUrl: string;
  status: "connected" | "pending" | "reconnect_needed";
  autoPublish: boolean;
  connectedAt: string;
}

const INITIAL_ACCOUNTS: ConnectedAccount[] = [
  {
    id: "yt-1",
    platform: "youtube",
    name: "RelatiV Creator Studio",
    handle: "@RelatiVCreators",
    followers: "48.2K subscribers",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
    status: "connected",
    autoPublish: true,
    connectedAt: "Connected 12 days ago",
  },
  {
    id: "tt-1",
    platform: "tiktok",
    name: "RelatiV Viral Daily",
    handle: "@relativclips.ai",
    followers: "128.9K followers",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=faces",
    status: "connected",
    autoPublish: true,
    connectedAt: "Connected 3 weeks ago",
  },
  {
    id: "ig-1",
    platform: "instagram",
    name: "RelatiV Shorts & Reels",
    handle: "@relativclips",
    followers: "73.4K followers",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
    status: "connected",
    autoPublish: false,
    connectedAt: "Connected 5 days ago",
  },
];

export default function SocialAccountsView() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(INITIAL_ACCOUNTS);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  // Uploader / Cross-Publisher state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["youtube", "tiktok", "instagram"]);
  const [caption, setCaption] = useState<string>(
    "This 1 trick unlocked 100k views in 48 hours without spending a single dollar on ads 🔥\n\nDrop a comment if you want the full breakdown!"
  );
  const [hashtags, setHashtags] = useState<string>("#relativclips #creatorlife #growthhacks #viralshorts #marketingtips");
  const [scheduleType, setScheduleType] = useState<"now" | "peak" | "custom">("now");
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishSuccess, setPublishSuccess] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const handleToggleAutoPublish = (id: string) => {
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === id ? { ...acc, autoPublish: !acc.autoPublish } : acc
      )
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleGenerateAiCaption = () => {
    setCaption(
      "The unspoken truth about short-form algorithms that top agencies will never tell you 🤫 Watch till the end to see the 3s retention drop!"
    );
    setHashtags("#algorithmhacks #contentcreator #reelsgrowth #tiktoktips #foryoupage #viralpost");
  };

  const handleExecutePublish = () => {
    if (selectedPlatforms.length === 0) return;
    setIsPublishing(true);

    setTimeout(() => {
      setIsPublishing(false);
      setPublishSuccess(true);
      setTimeout(() => {
        setPublishSuccess(false);
      }, 4000);
    }, 2200);
  };

  return (
    <div className="space-y-8 pb-16 font-sans">
      {/* ── Title & Intro Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Social Accounts & Auto-Publisher
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Link your YouTube, TikTok, and Instagram accounts to publish clips directly.
          </p>
        </div>

        {/* Global Stats Badge */}
        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-right">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
            Combined Reach
          </span>
          <span className="text-sm font-bold text-white">
            250.5K Audience
          </span>
        </div>
      </div>

      {/* ── SECTION 1: CONNECTED SOCIAL ACCOUNTS ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <span>Connected Channels ({accounts.length})</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </h2>
          <span className="text-[11px] text-zinc-500">OAuth 2.0 direct API connection</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const isYt = acc.platform === "youtube";
            const isTt = acc.platform === "tiktok";
            const isIg = acc.platform === "instagram";

            return (
              <div
                key={acc.id}
                className="rounded-xl border border-white/[0.08] bg-[#121215] p-4 flex flex-col justify-between space-y-3 shadow-md"
              >
                {/* Account Head */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <img
                        src={acc.avatarUrl}
                        alt={acc.name}
                        className="w-9 h-9 rounded-md object-cover border border-white/10"
                      />
                      <div
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded flex items-center justify-center text-white text-[9px] shadow-sm ${
                          isYt
                            ? "bg-red-600"
                            : isTt
                            ? "bg-black text-cyan-300 border border-white/20"
                            : "bg-zinc-800 border border-white/20 text-white"
                        }`}
                      >
                        {isYt && <YoutubeIcon className="w-2 h-2" />}
                        {isTt && <TiktokIcon className="w-2 h-2" />}
                        {isIg && <InstagramIcon className="w-2 h-2" />}
                      </div>
                    </div>

                    <div className="truncate">
                      <h3 className="text-xs font-bold text-white truncate">{acc.name}</h3>
                      <p className="text-[11px] text-zinc-400 truncate">{acc.handle}</p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shrink-0">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    Active
                  </span>
                </div>

                {/* Stats & Meta */}
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-1 text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px]">Audience</span>
                    <span className="font-semibold text-white text-[11px]">{acc.followers}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="text-[10px]">Connection</span>
                    <span className="text-[10px]">{acc.connectedAt}</span>
                  </div>
                </div>

                {/* Auto Publish Toggle & Actions */}
                <div className="pt-1 border-t border-white/[0.06] flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acc.autoPublish}
                      onChange={() => handleToggleAutoPublish(acc.id)}
                      className="sr-only peer"
                    />
                    <div className="w-7 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-white relative" />
                    <span className="text-[11px] text-zinc-300 font-medium">Auto-post</span>
                  </label>

                  <button
                    onClick={() => {
                      alert(`Account ${acc.handle} sync refreshed.`);
                    }}
                    className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    title="Refresh connection tokens"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 2: CROSS-PLATFORM VIDEO UPLOADER & SCHEDULER ── */}
      <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-5 sm:p-6 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-zinc-400" />
              <span>Cross-Platform Video Uploader</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Upload a 9:16 vertical clip to publish across YouTube Shorts, TikTok, and Instagram simultaneously.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] text-zinc-300">
            <Sparkles className="w-3 h-3 text-zinc-400" />
            <span>AI Caption Engine Ready</span>
          </div>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Media Upload & Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative aspect-[9/16] max-h-[420px] mx-auto w-full rounded-xl border border-dashed transition cursor-pointer flex flex-col items-center justify-center p-6 text-center overflow-hidden ${
                previewUrl
                  ? "border-white/20 bg-black"
                  : "border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleFileChange}
                className="hidden"
              />

              {previewUrl ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    src={previewUrl}
                    className="w-full h-full object-cover rounded-lg"
                    controls
                    playsInline
                  />
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="p-1 rounded-md bg-black/80 hover:bg-black text-white text-xs border border-white/20"
                      title="Remove video"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-zinc-300 flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">Click or drag 9:16 video</p>
                    <p className="text-[11px] text-zinc-500">MP4, MOV up to 500MB</p>
                  </div>
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Film className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="text-white font-medium truncate">{selectedFile.name}</span>
                </div>
                <span className="text-zinc-500 text-[11px] shrink-0">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
            )}
          </div>

          {/* RIGHT: Platforms, Caption & Schedule (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Step 1: Destination Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                1. Target Platforms
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {/* YouTube */}
                <button
                  type="button"
                  onClick={() => togglePlatform("youtube")}
                  className={`p-2.5 rounded-lg border flex items-center gap-2 transition text-left cursor-pointer ${
                    selectedPlatforms.includes("youtube")
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="w-6 h-6 rounded bg-red-600 flex items-center justify-center text-white shrink-0">
                    <YoutubeIcon className="w-3 h-3" />
                  </div>
                  <div className="truncate leading-tight">
                    <span className="text-xs font-semibold block">Shorts</span>
                  </div>
                  {selectedPlatforms.includes("youtube") && (
                    <Check className="w-3 h-3 text-white ml-auto shrink-0" />
                  )}
                </button>

                {/* TikTok */}
                <button
                  type="button"
                  onClick={() => togglePlatform("tiktok")}
                  className={`p-2.5 rounded-lg border flex items-center gap-2 transition text-left cursor-pointer ${
                    selectedPlatforms.includes("tiktok")
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="w-6 h-6 rounded bg-zinc-900 border border-white/20 flex items-center justify-center text-white shrink-0">
                    <TiktokIcon className="w-3 h-3" />
                  </div>
                  <div className="truncate leading-tight">
                    <span className="text-xs font-semibold block">TikTok</span>
                  </div>
                  {selectedPlatforms.includes("tiktok") && (
                    <Check className="w-3 h-3 text-white ml-auto shrink-0" />
                  )}
                </button>

                {/* Instagram Reels */}
                <button
                  type="button"
                  onClick={() => togglePlatform("instagram")}
                  className={`p-2.5 rounded-lg border flex items-center gap-2 transition text-left cursor-pointer ${
                    selectedPlatforms.includes("instagram")
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="w-6 h-6 rounded bg-zinc-800 border border-white/20 flex items-center justify-center text-white shrink-0">
                    <InstagramIcon className="w-3 h-3" />
                  </div>
                  <div className="truncate leading-tight">
                    <span className="text-xs font-semibold block">Reels</span>
                  </div>
                  {selectedPlatforms.includes("instagram") && (
                    <Check className="w-3 h-3 text-white ml-auto shrink-0" />
                  )}
                </button>
              </div>
            </div>

            {/* Step 2: Caption & AI Optimizer */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  2. Caption
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAiCaption}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>AI Hook</span>
                </button>
              </div>

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                placeholder="Enter caption with hook and engagement question..."
                className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 resize-none transition"
              />
            </div>

            {/* Step 3: Hashtags */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                3. Hashtags
              </label>
              <input
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#relativclips #viral #shorts #fyp"
                className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-white/30 font-mono transition"
              />
            </div>

            {/* Step 4: Schedule */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                4. Timing
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleType("now")}
                  className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-medium transition cursor-pointer ${
                    scheduleType === "now"
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white"
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span>Publish Immediately</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleType("peak")}
                  className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-medium transition cursor-pointer ${
                    scheduleType === "peak"
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white"
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>Peak Time (6:30 PM)</span>
                </button>
              </div>
            </div>

            {/* Execute Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleExecutePublish}
                disabled={isPublishing || selectedPlatforms.length === 0}
                className="w-full py-2.5 px-4 rounded-lg font-bold text-xs bg-white text-black hover:bg-zinc-200 transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Publishing to {selectedPlatforms.length} Platforms...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-black" />
                    <span>
                      {scheduleType === "now"
                        ? `Publish Now to ${selectedPlatforms.length} Platforms`
                        : `Schedule to ${selectedPlatforms.length} Platforms`}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Success Notification */}
            <AnimatePresence>
              {publishSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-300 text-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Broadcast queued successfully for selected platforms!</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
