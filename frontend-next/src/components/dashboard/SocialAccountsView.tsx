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
    <div className="space-y-10 pb-16">
      {/* ── Title & Intro Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-2">
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            Cross-Platform Distribution Hub
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Social Accounts & Auto-Publisher
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
            Link your YouTube, TikTok, and Instagram accounts. Auto-publish high-scoring viral clips simultaneously with 1 click.
          </p>
        </div>

        {/* Global Stats Badge */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-right">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">
              Combined Reach
            </span>
            <span className="text-base font-bold text-white tracking-tight">
              250.5K Audience
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: CONNECTED SOCIAL ACCOUNTS ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <span>Connected Channels ({accounts.length})</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </h2>
          <span className="text-xs text-zinc-400">OAuth 2.0 Direct API integration</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {accounts.map((acc) => {
            const isYt = acc.platform === "youtube";
            const isTt = acc.platform === "tiktok";
            const isIg = acc.platform === "instagram";

            return (
              <motion.div
                key={acc.id}
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-white/10 bg-[#0B0C10] p-5 flex flex-col justify-between space-y-4 shadow-lg relative overflow-hidden"
              >
                {/* Platform Accent Glow Strip */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isYt
                      ? "bg-red-500"
                      : isTt
                      ? "bg-gradient-to-r from-cyan-400 via-pink-500 to-black"
                      : "bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400"
                  }`}
                />

                {/* Account Head */}
                <div className="flex items-start justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={acc.avatarUrl}
                        alt={acc.name}
                        className="w-11 h-11 rounded-full object-cover border border-white/15"
                      />
                      <div
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow-md ${
                          isYt
                            ? "bg-red-600"
                            : isTt
                            ? "bg-black text-cyan-300 border border-white/20"
                            : "bg-gradient-to-tr from-amber-500 to-purple-600"
                        }`}
                      >
                        {isYt && <YoutubeIcon className="w-2.5 h-2.5" />}
                        {isTt && <TiktokIcon className="w-2.5 h-2.5" />}
                        {isIg && <InstagramIcon className="w-2.5 h-2.5" />}
                      </div>
                    </div>

                    <div className="truncate">
                      <h3 className="text-sm font-bold text-white truncate">{acc.name}</h3>
                      <p className="text-xs text-zinc-400 truncate">{acc.handle}</p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shrink-0">
                    <ShieldCheck className="w-3 h-3" />
                    Active
                  </span>
                </div>

                {/* Stats & Meta */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Audience</span>
                    <span className="font-semibold text-white">{acc.followers}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Connection</span>
                    <span className="text-[11px] text-zinc-400">{acc.connectedAt}</span>
                  </div>
                </div>

                {/* Auto Publish Toggle & Actions */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acc.autoPublish}
                      onChange={() => handleToggleAutoPublish(acc.id)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-cyan-500 relative" />
                    <span className="text-[11px] text-zinc-300 font-medium">Auto-post clips</span>
                  </label>

                  <button
                    onClick={() => {
                      alert(`Account ${acc.handle} sync settings refreshed.`);
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
                    title="Refresh connection tokens"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 2: CROSS-PLATFORM VIDEO UPLOADER & SCHEDULER ── */}
      <div className="rounded-3xl border border-white/10 bg-[#0E0F14] p-6 sm:p-8 space-y-8 shadow-2xl relative overflow-hidden">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-5">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Upload className="w-5 h-5 text-cyan-400" />
              <span>Cross-Platform Video Uploader</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Upload any 9:16 vertical video or use your RelatiV generated clips to blast to YouTube Shorts, TikTok, and Reels simultaneously.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Caption Engine Active</span>
          </div>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Media Upload & Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative aspect-[9/16] max-h-[460px] mx-auto w-full rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center overflow-hidden ${
                previewUrl
                  ? "border-cyan-500/50 bg-black"
                  : "border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/30"
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
                    className="w-full h-full object-cover rounded-xl"
                    controls
                    playsInline
                  />
                  <div className="absolute top-3 right-3 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="p-1.5 rounded-full bg-black/70 hover:bg-black text-white text-xs border border-white/20 backdrop-blur-md"
                      title="Remove video"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">Click or drag 9:16 vertical video</p>
                    <p className="text-xs text-zinc-400">MP4, MOV up to 500MB</p>
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-400 font-mono">
                    1080 × 1920 recommended
                  </span>
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Film className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-white font-medium truncate">{selectedFile.name}</span>
                </div>
                <span className="text-zinc-400 shrink-0">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Target Destinations, Caption, Hashtags & Scheduler (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Destination Selection */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                1. Select Target Social Platforms
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* YouTube */}
                <button
                  type="button"
                  onClick={() => togglePlatform("youtube")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition text-left cursor-pointer ${
                    selectedPlatforms.includes("youtube")
                      ? "border-red-500/40 bg-red-500/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-white shrink-0">
                    <YoutubeIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate leading-tight">
                    <span className="text-xs font-bold block">YouTube Shorts</span>
                    <span className="text-[10px] text-zinc-400">#Shorts feed</span>
                  </div>
                  {selectedPlatforms.includes("youtube") && (
                    <Check className="w-4 h-4 text-red-400 ml-auto shrink-0" />
                  )}
                </button>

                {/* TikTok */}
                <button
                  type="button"
                  onClick={() => togglePlatform("tiktok")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition text-left cursor-pointer ${
                    selectedPlatforms.includes("tiktok")
                      ? "border-cyan-500/40 bg-cyan-500/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-black text-cyan-300 border border-white/20 flex items-center justify-center shrink-0">
                    <TiktokIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate leading-tight">
                    <span className="text-xs font-bold block">TikTok</span>
                    <span className="text-[10px] text-zinc-400">For You Page</span>
                  </div>
                  {selectedPlatforms.includes("tiktok") && (
                    <Check className="w-4 h-4 text-cyan-400 ml-auto shrink-0" />
                  )}
                </button>

                {/* Instagram Reels */}
                <button
                  type="button"
                  onClick={() => togglePlatform("instagram")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition text-left cursor-pointer ${
                    selectedPlatforms.includes("instagram")
                      ? "border-purple-500/40 bg-purple-500/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-purple-600 flex items-center justify-center text-white shrink-0">
                    <InstagramIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate leading-tight">
                    <span className="text-xs font-bold block">Instagram</span>
                    <span className="text-[10px] text-zinc-400">Reels & Feed</span>
                  </div>
                  {selectedPlatforms.includes("instagram") && (
                    <Check className="w-4 h-4 text-purple-400 ml-auto shrink-0" />
                  )}
                </button>
              </div>
            </div>

            {/* Step 2: Caption & AI Generation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  2. Caption & Viral Hook
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAiCaption}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-500/15 to-purple-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>AI Hook Optimizer</span>
                </button>
              </div>

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                placeholder="Enter caption with hook, emojis, and engagement question..."
                className="w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 resize-none transition"
              />
            </div>

            {/* Step 3: Hashtags */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                3. Algorithmic Hashtags
              </label>
              <input
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#relativclips #viral #shorts #fyp"
                className="w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 text-xs text-cyan-300 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 font-mono transition"
              />
            </div>

            {/* Step 4: Schedule */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                4. Timing
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleType("now")}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                    scheduleType === "now"
                      ? "border-cyan-500/40 bg-cyan-500/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Publish Immediately</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleType("peak")}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                    scheduleType === "peak"
                      ? "border-purple-500/40 bg-purple-500/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Peak Time (6:30 PM Today)</span>
                </button>
              </div>
            </div>

            {/* Execute Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleExecutePublish}
                disabled={isPublishing || selectedPlatforms.length === 0}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-400 to-purple-600 text-black hover:opacity-95 active:scale-[0.99] transition shadow-xl shadow-cyan-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    <span>Transcoding & Blasting to {selectedPlatforms.length} Platforms...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-black" />
                    <span>
                      {scheduleType === "now"
                        ? `Publish Now to ${selectedPlatforms.length} Social Platforms`
                        : `Schedule Blast to ${selectedPlatforms.length} Social Platforms`}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Success Notification */}
            <AnimatePresence>
              {publishSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Broadcast Scheduled Successfully!</p>
                    <p className="text-emerald-400/90 mt-0.5">
                      Your clip was queued for YouTube Shorts, TikTok, and Instagram Reels. View analytics on the Analyse tab.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
