"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Edit3,
  Plus,
  ArrowRight,
  Layers,
  Sparkles,
  Sliders,
  ChevronDown,
  ExternalLink,
  Film,
  Menu,
  Plug,
  Check,
  Video,
} from "lucide-react";
import SickLoadingTransition from "@/components/SickLoadingTransition";
import { uploadVideoFile, submitLocalVideo } from "@/lib/api";

const URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;

interface StudioHeroProps {
  onStartProcess?: (taskId: string) => void;
  onSubmitUrl?: (url: string) => void;
}

// ── Category Tabs (Matches Screenshot) ──
const CATEGORIES = [
  "Marketing campaigns",
  "Movies",
  "Social media",
  "Educational content",
  "Experimental art",
  "Other",
] as const;

type Category = (typeof CATEGORIES)[number];

// ── Visual Inspiration Cards (Matches Screenshot Grid) ──
const GALLERY_ITEMS: {
  id: string;
  category: Category;
  title: string;
  badge?: string;
  img: string;
  sampleUrl: string;
  aspect: "landscape" | "portrait" | "square";
}[] = [
  {
    id: "gal-1",
    category: "Marketing campaigns",
    title: "Summer Resort Cinematic Vlog",
    badge: "1080p 9:16",
    img: "/thumb_l1.webp",
    sampleUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    aspect: "landscape",
  },
  {
    id: "gal-2",
    category: "Marketing campaigns",
    title: "Neon Carbonated 3D Kinetic Ad",
    badge: "VIRAL 98",
    img: "/thumb_r4.webp",
    sampleUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    aspect: "landscape",
  },
  {
    id: "gal-3",
    category: "Social media",
    title: "Editorial Haute Couture Makeup",
    badge: "KARAOKE CAPTIONS",
    img: "/thumb_l4.webp",
    sampleUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    aspect: "landscape",
  },
  {
    id: "gal-4",
    category: "Marketing campaigns",
    title: "FOUNDRY BLUE — High Fashion Reel",
    badge: "HOOK 0-3S",
    img: "/thumb_l2.webp",
    sampleUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    aspect: "portrait",
  },
  {
    id: "gal-5",
    category: "Movies",
    title: "The Solitary Traveler Documentary",
    badge: "AUTO JUMP-CUT",
    img: "/thumb_l3.webp",
    sampleUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    aspect: "landscape",
  },
];

export default function StudioHero({
  onStartProcess,
  onSubmitUrl,
}: StudioHeroProps) {
  const [inputText, setInputText] = useState("");
  const [showBanner, setShowBanner] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>("Marketing campaigns");
  const [qualityMode, setQualityMode] = useState<"Ask • Quality" | "Fast • Turbo" | "Hook • RelatiVSauce">("Ask • Quality");
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionUrl, setTransitionUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle URL or prompt submission
  const handleFormSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = inputText.trim();
      if (!trimmed) return;

      setError(null);

      // Check if it's a YouTube URL
      if (URL_REGEX.test(trimmed)) {
        setTransitionUrl(trimmed);
        setIsTransitioning(true);
      } else {
        // If it's a prompt, check if it contains a URL or treat as AI generation query
        const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
        if (urlMatch && URL_REGEX.test(urlMatch[0])) {
          setTransitionUrl(urlMatch[0]);
          setIsTransitioning(true);
        } else {
          // If no URL given, use high-signal sample to let the user preview the pipeline
          const sample = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
          setTransitionUrl(sample);
          setIsTransitioning(true);
        }
      }
    },
    [inputText]
  );

  // File upload handler
  const handleFileProcess = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
        setError("Please select a valid video file (MP4, MOV, WEBM, MKV).");
        return;
      }
      setError(null);
      setUploadStatus("Uploading video to Studio...");

      try {
        const { filePath } = await uploadVideoFile(file);
        setUploadStatus("Starting AI virality pipeline...");
        const init = await submitLocalVideo(filePath);

        if (onStartProcess) {
          onStartProcess(init.taskId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload video.");
      } finally {
        setUploadStatus(null);
      }
    },
    [onStartProcess]
  );

  const handleCardClick = (sampleUrl: string) => {
    setInputText(sampleUrl);
    setTransitionUrl(sampleUrl);
    setIsTransitioning(true);
  };

  return (
    <div className="w-full text-white pt-4 pb-12 flex flex-col items-center">
      {/* ── 1. Headline (Matches Screenshot) ── */}
      <div className="text-center mb-8 px-4">
        <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-normal tracking-tight text-white flex items-center justify-center gap-2.5 sm:gap-3 flex-wrap">
          <span>What will you</span>

          {/* Inline Media Pill with Angled White Cursor */}
          <span className="relative inline-flex items-center mx-1 align-middle select-none">
            <span className="w-12 sm:w-14 h-7 sm:h-8 rounded-lg overflow-hidden border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.6)] inline-block">
              <img
                src="/thumb_r1.webp"
                alt="Creation Thumbnail"
                className="w-full h-full object-cover"
              />
            </span>

            {/* Overlapping Angled White Mouse Cursor */}
            <span className="absolute -bottom-1 -right-2 transform translate-x-1 translate-y-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] pointer-events-none">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 3L10.07 20.97L13.58 13.58L20.97 10.07L3 3Z"
                  fill="white"
                  stroke="#000000"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>

          <span>create today?</span>
        </h1>
      </div>

      {/* ── 2. Primary Input Hub Container ── */}
      <div className="w-full max-w-[820px] px-4">
        <div className="relative rounded-2xl bg-[#14151a] border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden transition-all duration-300">
          {/* ── Connected Notification Banner (Matches Screenshot) ── */}
          <AnimatePresence>
            {showBanner && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-[#12192c] border-b border-blue-500/25 px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3 text-xs overflow-hidden"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {/* Brand Glyphs: TikTok, Google, Meta */}
                  <div className="flex items-center -space-x-1 shrink-0">
                    <span className="w-5 h-5 rounded-full bg-black border border-white/20 flex items-center justify-center text-[10px] text-white font-bold shadow-sm">
                      ♪
                    </span>
                    <span className="w-5 h-5 rounded-full bg-[#EA4335] border border-white/20 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                      G
                    </span>
                    <span className="w-5 h-5 rounded-full bg-[#0081FB] border border-white/20 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                      ∞
                    </span>
                  </div>
                  <span className="text-zinc-300 text-xs truncate">
                    Making an ad? Connect your ad accounts to build on what&apos;s winning.
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setInputText("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
                    }}
                    className="text-blue-400 hover:text-blue-300 font-medium text-xs whitespace-nowrap cursor-pointer transition-colors"
                  >
                    Connect account
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBanner(false)}
                    className="text-zinc-400 hover:text-white p-0.5 cursor-pointer text-xs"
                    aria-label="Dismiss banner"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Main Input Box ── */}
          <form onSubmit={handleFormSubmit} className="p-4 sm:p-5 flex flex-col space-y-3">
            {/* Top Action Pills: [↑ Reference] [✎ Sketch] */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20222a] hover:bg-[#282b35] border border-white/[0.06] text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-400" />
                <span>Reference</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputText("Extract the most engaging 20-35s hooks from: https://www.youtube.com/watch?v=dQw4w9WgXcQ");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20222a] hover:bg-[#282b35] border border-white/[0.06] text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                <span>Sketch</span>
              </button>
            </div>

            {/* Hidden File Chooser */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileProcess(file);
              }}
            />

            {/* Multiline Prompt / URL Input */}
            <div className="py-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleFormSubmit();
                  }
                }}
                placeholder="Type your thoughts..."
                rows={3}
                className="w-full bg-transparent resize-none text-sm sm:text-[15px] text-white placeholder-zinc-500 focus:outline-none focus:ring-0 border-none leading-relaxed"
              />
            </div>

            {/* Bottom Controls Row: [+] on left, [Ask • Quality] + [→] on right */}
            <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between">
              {/* Plus Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                title="Add reference or video file"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Right Action Cluster */}
              <div className="flex items-center gap-2.5">
                {/* Quality / Mode Dropdown Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowQualityDropdown((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 transition-colors cursor-pointer"
                  >
                    <span>{qualityMode}</span>
                    <ChevronDown className="w-3 h-3 text-zinc-400" />
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {showQualityDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute right-0 bottom-full mb-2 w-48 rounded-xl bg-[#1b1d24] border border-white/10 shadow-2xl py-1 z-30 font-sans"
                      >
                        {(["Ask • Quality", "Hook • RelatiVSauce", "Fast • Turbo"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              setQualityMode(mode);
                              setShowQualityDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-white/10 flex items-center justify-between"
                          >
                            <span>{mode}</span>
                            {qualityMode === mode && <Check className="w-3 h-3 text-cyan-400" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Submit Circle Button [→] */}
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    inputText.trim()
                      ? "bg-white text-black hover:bg-zinc-200 shadow-md active:scale-95"
                      : "bg-white/10 text-zinc-500 cursor-not-allowed"
                  }`}
                  aria-label="Submit prompt or link"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Error / Upload Status Feedback */}
        {uploadStatus && (
          <p className="mt-2.5 text-xs text-cyan-400 text-center font-mono animate-pulse">
            {uploadStatus}
          </p>
        )}
        {error && (
          <p className="mt-2.5 text-xs text-rose-400 text-center font-mono">
            {error}
          </p>
        )}
      </div>

      {/* ── 3. Capability / Tool Badges Row (Matches Screenshot) ── */}
      <div className="mt-5 flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap px-4">
        {/* Edit in Timeline */}
        <button
          type="button"
          onClick={() => {
            setInputText("Split footage and reframe to 9:16 vertical in timeline");
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#17181f]/80 hover:bg-[#20222a] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
        >
          <Film className="w-3.5 h-3.5 text-zinc-400" />
          <span>Edit in Timeline</span>
        </button>

        {/* Seedance 2.5 / RelatiVSauce */}
        <button
          type="button"
          onClick={() => {
            setInputText("Run RelatiVSauce 20-35s viral retention curve scoring");
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#17181f]/80 hover:bg-[#20222a] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
          <span>Seedance 2.5</span>
        </button>

        {/* GPT Image 2.6 / Whisper */}
        <button
          type="button"
          onClick={() => {
            setInputText("Generate high-contrast karaoke subtitles with Whisper Large-v3");
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#17181f]/80 hover:bg-[#20222a] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
          <span>GPT Image 2.6</span>
        </button>

        {/* Menu Icon Button */}
        <button
          type="button"
          className="p-1.5 rounded-xl bg-[#17181f]/80 hover:bg-[#20222a] border border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
          title="More options"
        >
          <Menu className="w-3.5 h-3.5" />
        </button>

        {/* Try MCP Button */}
        <button
          type="button"
          onClick={() => {
            window.open("https://github.com/deeprajsharma592-sketch/RelatiVClips-MVP", "_blank");
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#17181f]/80 hover:bg-[#20222a] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
        >
          <Plug className="w-3.5 h-3.5 text-zinc-400" />
          <span>Try MCP</span>
          <ExternalLink className="w-3 h-3 text-zinc-500 ml-0.5" />
        </button>
      </div>

      {/* ── 4. Category Filter Tabs (Matches Screenshot) ── */}
      <div className="mt-10 sm:mt-12 flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto max-w-full px-4 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat
                ? "bg-white/10 text-white border border-white/20 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── 5. Visual Inspiration Cards Gallery (Matches Screenshot Grid) ── */}
      <div className="mt-6 w-full max-w-[1140px] px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 sm:gap-4">
          {GALLERY_ITEMS.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ y: -4, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              onClick={() => handleCardClick(item.sampleUrl)}
              className="group relative rounded-xl overflow-hidden aspect-[4/5] bg-[#16171d] border border-white/10 shadow-lg cursor-pointer"
            >
              {/* Card Image */}
              <img
                src={item.img}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />

              {/* Ambient Vignette & Readability Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

              {/* Top Badge */}
              {item.badge && (
                <div className="absolute top-2.5 left-2.5">
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-black/60 backdrop-blur-md text-amber-300 border border-white/15">
                    {item.badge}
                  </span>
                </div>
              )}

              {/* Bottom Caption & Play Prompt */}
              <div className="absolute bottom-2.5 inset-x-2.5">
                <p className="text-xs font-medium text-white line-clamp-2 leading-snug drop-shadow-md">
                  {item.title}
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
                  <span className="text-cyan-400 font-mono">Clip Sample</span>
                  <span className="text-white group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── 6. SICK LOADING TRANSITION OVERLAY ── */}
      {isTransitioning && transitionUrl && (
        <SickLoadingTransition
          url={transitionUrl}
          autoRedirect={false}
          onComplete={(taskId) => {
            setIsTransitioning(false);
            if (onStartProcess && taskId) {
              onStartProcess(taskId);
            } else if (onSubmitUrl) {
              onSubmitUrl(transitionUrl);
            } else {
              window.location.href = `/dashboard?url=${encodeURIComponent(transitionUrl)}${taskId ? `&taskId=${taskId}` : ""}`;
            }
          }}
        />
      )}
    </div>
  );
}
