"use client";

import { Columns2, Focus, PanelsTopLeft } from "lucide-react";
import type { FramingLayout } from "@/types/editor";

const OPTIONS = [
  { id: "auto_face" as const, label: "Auto face", detail: "Track the active speaker", icon: Focus },
  { id: "split_stack" as const, label: "Split stack", detail: "Speaker + context", icon: PanelsTopLeft },
  { id: "blur_fit" as const, label: "Blur fit", detail: "Keep the full landscape", icon: Columns2 },
];

export default function LayoutSelector({ value, onChange }: { value: FramingLayout; onChange: (layout: FramingLayout) => void }) {
  return (
    <div className="space-y-2">
      {OPTIONS.map(({ id, label, detail, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex w-full items-center gap-3 border p-3 text-left transition ${value === id ? "border-[#4FD1C5]/60 bg-[#4FD1C5]/[0.07]" : "border-white/[0.08] hover:border-white/20"}`}
        >
          <Icon className={`size-4 ${value === id ? "text-[#4FD1C5]" : "text-[#777980]"}`} />
          <span>
            <span className="block text-xs font-semibold text-[#ECEAE3]">{label}</span>
            <span className="mt-0.5 block text-[10px] text-[#777980]">{detail}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
