"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Zap,
  Volume2,
  Wand2,
  Smile,
  Layers,
  Check,
  ChevronDown,
  Info,
  Crown,
  Play,
  ArrowRight,
} from "lucide-react";

export type HookStyle = "editorial" | "statement" | "sunset" | "classic";

export interface RecipeConfig {
  template: "podcast" | "streamer" | "gaming" | "educational" | "general";
  hookStyle: HookStyle;
  enableAutoHook: boolean;
  enableAiEmojis: boolean;
  enableMotionGraphics: boolean;
  enableSpeechCleanup: boolean;
  enableAudioEnhance: boolean;
  enableAutoSfx: boolean;
}

interface PreGenConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  onConfirm: (config: RecipeConfig) => void;
  onOpenUpgrade?: () => void;
}

const HOOK_STYLES: {
  id: HookStyle;
  label: string;
  tagline: string;
  badgeColor: string;
  previewBg: string;
  fontStyle: string;
}[] = [
  {
    id: "editorial",
    label: "Editorial",
    tagline: "Vogue / Minimalist Serif headline with subtle drop shadow",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    previewBg: "from-zinc-900 to-black",
    fontStyle: "font-serif italic text-emerald-400",
  },
  {
    id: "statement",
    label: "Statement",
    tagline: "High contrast yellow-white punchy block hook for TikTok",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    previewBg: "from-zinc-900 to-amber-950/30",
    fontStyle: "font-sans font-black uppercase text-amber-300 tracking-wide",
  },
  {
    id: "sunset",
    label: "Sunset Glow",
    tagline: "Gradient neon pink-cyan typography for reels & aesthetic shorts",
    badgeColor: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    previewBg: "from-purple-950/40 to-pink-950/40",
    fontStyle: "font-sans font-extrabold bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent",
  },
  {
    id: "classic",
    label: "Classic Punch",
    tagline: "MrBeast style bold centered punch headline with heavy stroke",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    previewBg: "from-zinc-900 to-blue-950/40",
    fontStyle: "font-sans font-black uppercase text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]",
  },
];

export default function PreGenConfigModal({
  isOpen,
  onClose,
  videoUrl,
  onConfirm,
  onOpenUpgrade,
}: PreGenConfigModalProps) {
  const [template, setTemplate] = useState<RecipeConfig["template"]>("podcast");
  const [hookStyle, setHookStyle] = useState<HookStyle>("statement");
  const [enableAutoHook, setEnableAutoHook] = useState(true);
  const [enableAiEmojis, setEnableAiEmojis] = useState(true);
  const [enableMotionGraphics, setEnableMotionGraphics] = useState(false);
  const [enableSpeechCleanup, setEnableSpeechCleanup] = useState(true);
  const [enableAudioEnhance, setEnableAudioEnhance] = useState(true);
  const [enableAutoSfx, setEnableAutoSfx] = useState(false);

  if (!isOpen) return null;

  const handleStart = () => {
    onConfirm({
      template,
      hookStyle,
      enableAutoHook,
      enableAiEmojis,
      enableMotionGraphics,
      enableSpeechCleanup,
      enableAudioEnhance,
      enableAutoSfx,
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-5xl bg-[#0F1015] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-sm">
                R
              </span>
              <div>
                <h2 className="text-base font-semibold text-white">Generation Recipe & Edits</h2>
                <p className="text-xs text-zinc-400">Configure viral hooks, active speaker framing, and sound enhancement</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition"
            >
              <X size={16} />
            </button>
          </div>

          {/* Main 2-Column Content */}
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Settings */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recipe & Template Selector Pill Row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="text-zinc-400">Archetype:</span>
                  <select
                    value={template}
                    onChange={(e) => setTemplate(e.target.value as RecipeConfig["template"])}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="podcast" className="bg-zinc-900">🎙️ Podcast & Interview</option>
                    <option value="streamer" className="bg-zinc-900">⚡ Streamer & Reactions</option>
                    <option value="gaming" className="bg-zinc-900">🎮 Gaming Clutches</option>
                    <option value="educational" className="bg-zinc-900">💡 Talking Head / Educational</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-300">
                  <Layers size={13} className="text-purple-400" />
                  <span className="text-zinc-400">Brand Kit:</span>
                  <span className="text-white font-medium">RelatiV Default</span>
                </div>
              </div>

              {/* 1. AUTO HOOK STYLES */}
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wand2 size={16} className="text-amber-400" />
                    <span className="text-sm font-semibold text-white">Auto Hook Headlines</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      High Virality
                    </span>
                  </div>
                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => setEnableAutoHook(!enableAutoHook)}
                    className={`w-11 h-6 rounded-full transition relative p-0.5 ${
                      enableAutoHook ? "bg-cyan-500" : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-sm transition transform ${
                        enableAutoHook ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-zinc-400 mb-4">
                  Injects a visual punch hook in the first 0–3 seconds of each clip to maximize feed scroll-stop rate.
                </p>

                {/* 4 Visual Cards */}
                {enableAutoHook && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {HOOK_STYLES.map((style) => {
                      const isSelected = hookStyle === style.id;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setHookStyle(style.id)}
                          className={`relative text-left p-3 rounded-lg border transition flex flex-col justify-between h-32 ${
                            isSelected
                              ? "bg-white/[0.08] border-cyan-400/80 shadow-md shadow-cyan-500/10"
                              : "bg-white/[0.02] border-white/10 hover:border-white/20"
                          }`}
                        >
                          <div className={`w-full h-14 rounded bg-gradient-to-br ${style.previewBg} p-2 flex items-center justify-center border border-white/5 overflow-hidden`}>
                            <span className={`text-[11px] leading-tight text-center ${style.fontStyle}`}>
                              HOW I SCALED
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs font-semibold text-white">{style.label}</span>
                              {isSelected && <Check size={12} className="text-cyan-400" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. VISUAL EDITS & EMOJIS */}
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Sparkles size={15} className="text-cyan-400" />
                  Visual Edits & Overlays
                </h3>

                {/* AI Emojis */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400">
                      <Smile size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">AI Kinetic Emojis</p>
                      <p className="text-[11px] text-zinc-400">Pop dynamic animated emojis synced with speech tone</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableAiEmojis(!enableAiEmojis)}
                    className={`w-11 h-6 rounded-full transition relative p-0.5 ${
                      enableAiEmojis ? "bg-cyan-500" : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-sm transition transform ${
                        enableAiEmojis ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Motion Graphics */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <Crown size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-white">Motion Graphics Overlays</p>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold">PRO</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">Cinematic lower thirds, progress bars, and screen zoom punch-ins</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableMotionGraphics(!enableMotionGraphics)}
                    className={`w-11 h-6 rounded-full transition relative p-0.5 ${
                      enableMotionGraphics ? "bg-purple-500" : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-sm transition transform ${
                        enableMotionGraphics ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 3. SOUND SHARP */}
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Volume2 size={15} className="text-emerald-400" />
                  Sound Enhancement
                </h3>

                {/* Speech Cleanup */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Silence & Filler Word Removal</p>
                    <p className="text-[11px] text-zinc-400">Removes "um", "uh", dead air & awkward cough pauses automatically</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableSpeechCleanup(!enableSpeechCleanup)}
                    className={`w-11 h-6 rounded-full transition relative p-0.5 ${
                      enableSpeechCleanup ? "bg-cyan-500" : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-sm transition transform ${
                        enableSpeechCleanup ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Audio Equalization */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div>
                    <p className="text-xs font-medium text-white">Voice Clarity & Loudness Normalization</p>
                    <p className="text-[11px] text-zinc-400">Masters audio to TikTok/Instagram -14 LUFS standards</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableAudioEnhance(!enableAudioEnhance)}
                    className={`w-11 h-6 rounded-full transition relative p-0.5 ${
                      enableAudioEnhance ? "bg-cyan-500" : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-sm transition transform ${
                        enableAudioEnhance ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Generation Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-0 bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-zinc-300">
                  Generation Summary
                </h3>

                <div className="space-y-3 text-xs border-b border-white/10 pb-4">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Source Source</span>
                    <span className="text-zinc-200 font-mono text-[11px] truncate max-w-[150px]">
                      {videoUrl || "YouTube Source"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Target Ratio</span>
                    <span className="text-white font-medium">9:16 Vertical Reel</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Expected Clips</span>
                    <span className="text-white font-medium">3 Curated Cuts</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>AI Model</span>
                    <span className="text-cyan-400 font-medium">Whisper + DeepSeek V3</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Estimated Time</span>
                    <span className="text-white font-medium">~90 – 120 seconds</span>
                  </div>
                </div>

                {/* Credit Cost */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-amber-400 fill-amber-400" />
                    <div>
                      <p className="text-xs font-semibold text-white">Credits Required</p>
                      <p className="text-[10px] text-zinc-400">1 credit per source video</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-white">1 Credit</span>
                </div>

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={handleStart}
                  className="w-full py-3 px-4 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Play size={14} className="fill-black" />
                  Create Clips in 1 Click
                </button>

                <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
                  By starting generation, you confirm rights to this footage. Watermark-free on active plans.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
