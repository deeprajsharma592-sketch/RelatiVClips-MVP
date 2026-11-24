"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Zap,
  Sliders,
  Type,
  Layers,
  Film,
  Check,
  ChevronDown,
} from "lucide-react";
import type { CaptionStyleValue } from "./CaptionStylePicker";

export type HookStyle = "editorial" | "statement" | "sunset" | "classic";

export interface RecipeConfig {
  template:
    | "podcast"
    | "streamer"
    | "gaming"
    | "educational"
    | "advertisers"
    | "realestate"
    | "entertainment"
    | "agencies"
    | "church"
    | "marketers"
    | "ecommerce"
    | "general"
    | string;
  hookStyle: HookStyle;
  enableAutoHook: boolean;
  enableAiEmojis: boolean;
  enableMotionGraphics: boolean;
  enableSpeechCleanup: boolean;
  enableAudioEnhance: boolean;
  enableAutoSfx: boolean;
  includeNaturalTail: boolean;
  includeThumbnailOutro: boolean;
  captionStyle: CaptionStyleValue;
}

interface PreGenConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  onConfirm: (config: RecipeConfig) => void;
  onOpenUpgrade?: () => void;
}

const NICHE_OPTIONS = [
  { value: "podcast", label: "Podcast & Interview (Turn-taking discussion)" },
  { value: "streamer", label: "Creator & Streamer (High-energy highlights)" },
  { value: "educational", label: "Educational & Commentary (Talking-head explainer)" },
  { value: "gaming", label: "Gaming & Esports (Clutches & reactions)" },
  { value: "advertisers", label: "Business & Tech (Keynotes & industry insights)" },
  { value: "entertainment", label: "Entertainment & Media (Pop culture & humor)" },
  { value: "general", label: "General & Vlog (Multi-speaker highlights)" },
];

const CAPTION_PRESETS = [
  { id: "impact", label: "Impact (Bold Outline)", font: "Komika Axis / Bold" },
  { id: "stack", label: "Stack (Minimalist Editorial)", font: "The Bold Font / Clean" },
  { id: "hookcard", label: "Hook Card (High-Contrast Boxed)", font: "Impact / Punchy" },
];

const POSITION_OPTIONS = [
  { value: "auto", label: "Auto (Face Tracking & Avoidance)" },
  { value: "lower", label: "Lower Third (Standard 9:16)" },
  { value: "middle", label: "Center (Punchy Middle)" },
  { value: "upper", label: "Upper Third (Top Headline)" },
];

const ACCENT_COLORS = [
  { name: "yellow", hex: "#FACC15", label: "Yellow" },
  { name: "white", hex: "#FFFFFF", label: "White" },
  { name: "green", hex: "#22C55E", label: "Green" },
  { name: "red", hex: "#EF4444", label: "Red" },
  { name: "cyan", hex: "#06B6D4", label: "Cyan" },
  { name: "purple", hex: "#A855F7", label: "Purple" },
];

export default function PreGenConfigModal({
  isOpen,
  onClose,
  videoUrl,
  onConfirm,
  onOpenUpgrade,
}: PreGenConfigModalProps) {
  const [template, setTemplate] = useState<RecipeConfig["template"]>("podcast");
  const [captionPreset, setCaptionPreset] = useState<"impact" | "stack" | "hookcard">("impact");
  const [captionPosition, setCaptionPosition] = useState<"auto" | "lower" | "middle" | "upper">("auto");
  const [colorway, setColorway] = useState<string>("yellow");

  // Finisher & Endscreen toggles
  const [includeThumbnailOutro, setIncludeThumbnailOutro] = useState<boolean>(true);
  const [includeNaturalTail, setIncludeNaturalTail] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleStart = () => {
    const captionStyle: CaptionStyleValue = {
      preset: captionPreset,
      overrides: {
        colorway,
        position_mode: captionPosition,
      },
    };

    onConfirm({
      template,
      hookStyle: "statement",
      enableAutoHook: true,
      enableAiEmojis: false,
      enableMotionGraphics: false,
      enableSpeechCleanup: true,
      enableAudioEnhance: true,
      enableAutoSfx: false,
      includeNaturalTail,
      includeThumbnailOutro,
      captionStyle,
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 14 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-lg bg-[#0C0D12] border border-white/10 rounded-2xl shadow-2xl p-5 sm:p-7 overflow-y-auto max-h-[92vh] z-10 font-sans"
        >
          {/* Subtle Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Sliders size={16} className="text-emerald-400" />
                Clip Settings
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Configure caption style, niche, and clip finishing options
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              aria-label="Close modal"
            >
              <X size={15} />
            </button>
          </div>

          {/* Form Controls */}
          <div className="py-5 space-y-5">
            {/* 1. Niche Dropdown (No Emojis) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                <Layers size={13} className="text-emerald-400" />
                Content Niche
              </label>
              <div className="relative">
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as RecipeConfig["template"])}
                  className="w-full appearance-none h-11 px-3.5 pr-10 rounded-xl bg-[#13141B] border border-white/10 text-xs font-medium text-white shadow-lg shadow-black/40 hover:border-white/20 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition cursor-pointer"
                >
                  {NICHE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#13141B] text-white py-1">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            {/* 2. Captions: Style Preset Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                <Type size={13} className="text-cyan-400" />
                Caption Style
              </label>
              <div className="relative">
                <select
                  value={captionPreset}
                  onChange={(e) => setCaptionPreset(e.target.value as "impact" | "stack" | "hookcard")}
                  className="w-full appearance-none h-11 px-3.5 pr-10 rounded-xl bg-[#13141B] border border-white/10 text-xs font-medium text-white shadow-lg shadow-black/40 hover:border-white/20 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition cursor-pointer"
                >
                  {CAPTION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#13141B] text-white py-1">
                      {p.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            {/* 3. Captions: Position Dropdown & Accent Color Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Position */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Caption Position
                </label>
                <div className="relative">
                  <select
                    value={captionPosition}
                    onChange={(e) =>
                      setCaptionPosition(e.target.value as "auto" | "lower" | "middle" | "upper")
                    }
                    className="w-full appearance-none h-11 px-3.5 pr-10 rounded-xl bg-[#13141B] border border-white/10 text-xs font-medium text-white shadow-lg shadow-black/40 hover:border-white/20 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition cursor-pointer"
                  >
                    {POSITION_OPTIONS.map((pos) => (
                      <option key={pos.value} value={pos.value} className="bg-[#13141B] text-white py-1">
                        {pos.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              {/* Accent Color Swatches */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Accent Color
                </label>
                <div className="h-11 px-3 rounded-xl bg-[#13141B] border border-white/10 flex items-center justify-between shadow-lg shadow-black/40">
                  {ACCENT_COLORS.map((color) => {
                    const isSelected = colorway === color.name;
                    return (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setColorway(color.name)}
                        title={color.label}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer relative flex items-center justify-center ${
                          isSelected ? "scale-115 ring-2 ring-white ring-offset-2 ring-offset-[#13141B]" : "hover:scale-105 opacity-80"
                        }`}
                        style={{ backgroundColor: color.hex }}
                      >
                        {isSelected && <Check size={11} className={color.name === "white" || color.name === "yellow" ? "text-black" : "text-white"} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Clip Finishing & End Screen (Blurred Thumbnail Outro) */}
            <div className="pt-2 space-y-3">
              <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                <Film size={13} className="text-amber-400" />
                Finishing &amp; End Screen
              </label>

              {/* Blurred Thumbnail Outro Toggle (Requested by User) */}
              <div className="p-3.5 rounded-xl bg-[#13141B] border border-white/10 flex items-center justify-between gap-3 shadow-lg shadow-black/40">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Add Blurred Thumbnail Outro (End Screen)
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                    Append a 4-second blurred thumbnail card with audio tail to tease full video
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeThumbnailOutro}
                  onClick={() => setIncludeThumbnailOutro(!includeThumbnailOutro)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer ${
                    includeThumbnailOutro ? "bg-emerald-500" : "bg-white/15"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform transform ${
                      includeThumbnailOutro ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Natural Scene Ending (+5s Tail Buffer) */}
              <div className="p-3.5 rounded-xl bg-[#13141B] border border-white/10 flex items-center justify-between gap-3 shadow-lg shadow-black/40">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Natural Scene Ending (+5s Tail Buffer)
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                    Avoid abrupt cutoffs by extending 5 seconds past the last sentence boundary
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeNaturalTail}
                  onClick={() => setIncludeNaturalTail(!includeNaturalTail)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer ${
                    includeNaturalTail ? "bg-emerald-500" : "bg-white/15"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform transform ${
                      includeNaturalTail ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Footer with "Clip Now" Green Button */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <button
              type="button"
              onClick={handleStart}
              className="w-full py-3.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-extrabold text-sm sm:text-base tracking-wide transition-all shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_35px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap size={16} className="fill-black text-black" />
              <span>Clip Now</span>
            </button>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono px-1">
              <span>200 credits per generated clip</span>
              <span>1080×1920 60FPS</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
