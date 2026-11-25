"use client";

import registry from "@/lib/caption_styles.json";

export interface CaptionStyleValue {
  preset: "impact" | "stack" | "hookcard";
  overrides: {
    colorway?: string;
    colors?: { primary?: string; accent?: string };
    sizes?: { normal?: number };
    outline_px?: number;
    case?: "upper" | "as_is";
    position_mode?: "auto" | "lower" | "middle" | "upper" | "custom";
    position?: { y_percent?: number };
    language?: "en" | "hi" | "hinglish" | "ur";
  };
}

type Props = { value: CaptionStyleValue; onChange: (value: CaptionStyleValue) => void };

export default function CaptionStylePicker({ value, onChange }: Props) {
  const preset = registry.presets[value.preset];
  const overrides = value.overrides || {};
  const update = (next: Partial<CaptionStyleValue["overrides"]>) => onChange({ ...value, overrides: { ...overrides, ...next } });
  return (
    <section className="rounded-xl border border-white/10 bg-[#0b0c10] p-5 space-y-4" aria-labelledby="caption-style-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Caption bench</p>
          <h3 id="caption-style-title" className="mt-1 text-sm font-semibold text-white">Choose the voice on screen</h3>
        </div>
        <span className="text-[10px] text-zinc-500">1080 × 1920 safe preview</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(registry.presets) as CaptionStyleValue["preset"][]).map((id) => {
          const item = registry.presets[id];
          const selected = value.preset === id;
          const family = item.font.family;
          return (
            <button key={id} type="button" onClick={() => onChange({ preset: id, overrides })}
              className={`relative h-28 overflow-hidden rounded-lg border p-3 text-left transition ${selected ? "border-[#FFD60A] bg-[#17150d]" : "border-white/10 bg-white/[0.025] hover:border-white/25"}`}>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">{item.label}</span>
              <span className="absolute inset-x-3 bottom-3 text-center leading-[0.9]"
                style={{ fontFamily: `'${family}'`, fontSize: id === "hookcard" ? 25 : 21, color: item.colors.primary, WebkitTextStroke: `${Math.min(2, item.outline_px / 4)}px ${item.colors.outline}`, textTransform: item.case === "upper" ? "uppercase" : "none" }}>
                {id === "stack" ? "Taste beats templates" : id === "hookcard" ? "INSIDE\NTHE STORY" : "THE CHEAT CODE"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
        <label className="space-y-1 text-zinc-400">Accent
          <div className="flex gap-1.5 pt-1">{Object.entries(preset.colorways).map(([name, color]) =>
            <button key={name} type="button" aria-label={`${name} accent`} title={name} onClick={() => update({ colorway: name })}
              className={`h-6 w-6 rounded-full border-2 ${overrides.colorway === name ? "border-white" : "border-transparent"}`} style={{ backgroundColor: color }} />)}</div>
        </label>
        <label className="space-y-1 text-zinc-400">Position
          <select value={overrides.position_mode || "auto"} onChange={(e) => update({ position_mode: e.target.value as CaptionStyleValue["overrides"]["position_mode"] })}
            className="block h-8 w-full rounded-md border border-white/10 bg-[#15161b] px-2 text-white outline-none focus:border-[#FFD60A]">
            <option value="auto">Auto · avoid face</option><option value="lower">Lower</option><option value="middle">Middle</option><option value="upper">Upper</option><option value="custom">Custom</option>
          </select>
        </label>
        <label className="space-y-1 text-zinc-400">Size · {overrides.sizes?.normal || preset.sizes.normal}px
          <input type="range" min="58" max="150" value={overrides.sizes?.normal || preset.sizes.normal}
            onChange={(e) => update({ sizes: { ...overrides.sizes, normal: Number(e.target.value) } })} className="mt-2 w-full accent-[#FFD60A]" />
        </label>
        <label className="space-y-1 text-zinc-400">Outline · {overrides.outline_px ?? preset.outline_px}px
          <input type="range" min="0" max="12" value={overrides.outline_px ?? preset.outline_px}
            onChange={(e) => update({ outline_px: Number(e.target.value) })} className="mt-2 w-full accent-[#FFD60A]" />
        </label>
      </div>
    </section>
  );
}
