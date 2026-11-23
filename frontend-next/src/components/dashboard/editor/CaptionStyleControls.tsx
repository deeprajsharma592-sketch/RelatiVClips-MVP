"use client";

import type { CaptionPreset, CaptionStyleConfig, TextPosition } from "@/types/editor";

const PRESETS: Array<{ id: CaptionPreset; label: string; sample: string }> = [
  { id: "karaoke", label: "Karaoke glow", sample: "WORD SYNC" },
  { id: "hormozi", label: "Hormozi bold", sample: "BIG IDEA" },
  { id: "beast", label: "MrBeast pop", sample: "NO WAY" },
  { id: "minimal", label: "Clean minimal", sample: "A clean thought" },
  { id: "neon", label: "Cyber neon", sample: "SIGNAL LIVE" },
];

const COLORS = ["#FACC15", "#06B6D4", "#22C55E", "#EC4899", "#FFFFFF"];
const POSITIONS: TextPosition[] = ["top", "center", "bottom"];

export default function CaptionStyleControls({
  value,
  onChange,
}: {
  value: CaptionStyleConfig;
  onChange: (next: CaptionStyleConfig) => void;
}) {
  const patch = (next: Partial<CaptionStyleConfig>) => onChange({ ...value, ...next });

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2.5 text-[10px] font-mono uppercase tracking-[0.18em] text-[#777980]">Caption language</div>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => patch({ preset: preset.id })}
              className={`min-h-20 border px-3 py-2.5 text-left transition ${
                value.preset === preset.id
                  ? "border-[#4FD1C5]/70 bg-[#4FD1C5]/[0.08]"
                  : "border-white/[0.08] bg-white/[0.025] hover:border-white/20"
              }`}
            >
              <div
                className={`text-sm font-black ${preset.id === "minimal" ? "normal-case font-medium" : "uppercase"}`}
                style={{ color: value.preset === preset.id ? value.highlightColor : "#F5F2E9" }}
              >
                {preset.sample}
              </div>
              <div className="mt-2 text-[10px] text-[#85878e]">{preset.label}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3.5 border-t border-white/[0.08] pt-5">
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-mono uppercase tracking-[0.16em] text-[#777980]">Typeface</span>
          <select
            value={value.fontFamily}
            onChange={(event) => patch({ fontFamily: event.target.value as CaptionStyleConfig["fontFamily"] })}
            className="h-10 w-full border border-white/10 bg-[#0B0C0F] px-3 text-sm text-[#F4F1E8] outline-none focus:border-[#4FD1C5]/60"
          >
            {["Montserrat", "Anton", "Inter", "Poppins", "Komika"].map((font) => <option key={font}>{font}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.16em] text-[#777980]">
            Size <span className="text-[#D2D0C8]">{value.fontSize}px</span>
          </span>
          <input
            type="range"
            min={24}
            max={64}
            value={value.fontSize}
            onChange={(event) => patch({ fontSize: Number(event.target.value) })}
            className="w-full accent-[#4FD1C5]"
          />
        </label>

        <div>
          <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.16em] text-[#777980]">Active word</div>
          <div className="flex gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                onClick={() => patch({ highlightColor: color })}
                className={`size-8 border-2 transition ${value.highlightColor === color ? "scale-110 border-white" : "border-transparent"}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.16em] text-[#777980]">Safe zone</div>
          <div className="grid grid-cols-3 border border-white/10">
            {POSITIONS.map((position) => (
              <button
                key={position}
                type="button"
                onClick={() => patch({ positionY: position })}
                className={`h-9 text-xs capitalize transition ${value.positionY === position ? "bg-[#E7B84B] text-black" : "text-[#A8A9AE] hover:bg-white/5"}`}
              >
                {position}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => patch({ uppercase: !value.uppercase })}
            className={`h-10 border text-xs font-semibold ${value.uppercase ? "border-[#E7B84B]/60 bg-[#E7B84B]/10 text-[#F3CE75]" : "border-white/10 text-[#8D8F95]"}`}
          >
            AA Uppercase
          </button>
          <select
            aria-label="Words per caption"
            value={value.maxWordsPerScreen}
            onChange={(event) => patch({ maxWordsPerScreen: Number(event.target.value) })}
            className="h-10 border border-white/10 bg-[#0B0C0F] px-2 text-xs text-[#D5D3CC] outline-none"
          >
            <option value={1}>1 word / beat</option>
            <option value={2}>2 words / beat</option>
            <option value={3}>3 words / beat</option>
          </select>
        </div>
      </section>
    </div>
  );
}
