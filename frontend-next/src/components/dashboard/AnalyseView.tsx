"use client";

import { CalendarDays, Filter, Link2, MoveUpRight } from "lucide-react";

export default function AnalyseView() {
  return (
    <div className="space-y-7 pb-16">
      <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-3"><h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#F4F1E8]">Analytics</h1><span className="rounded bg-[#25262a] px-2 py-1 text-[10px] text-[#a9aaae]">Preview</span></div><p className="mt-2 max-w-xl text-xs leading-5 text-[#85868b]">Performance data appears here after you connect a publishing account. No sample numbers, only your real results.</p></div>
        <div className="flex gap-2"><button className="flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-[#18191b] px-3 text-xs text-[#c2c3c6]"><CalendarDays size={14} />Last 7 days</button><button className="flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-[#18191b] px-3 text-xs text-[#c2c3c6]"><Filter size={14} />Filter</button></div>
      </div>

      <div className="relative min-h-[500px] overflow-hidden rounded-xl border border-white/[0.06] bg-[#151618]">
        <div className="absolute inset-x-0 top-0 grid grid-cols-4 border-b border-white/[0.05] opacity-45">{["Views", "Watch time", "Retention", "Published"].map((label) => <div key={label} className="border-r border-white/[0.05] p-5 last:border-r-0"><p className="text-[10px] text-[#73747a]">{label}</p><div className="mt-3 h-5 w-20 rounded bg-white/[0.035]" /></div>)}</div>
        <div className="absolute inset-x-8 bottom-20 top-32 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)", backgroundSize: "100% 25%, 16.66% 100%" }} />
        <div className="relative z-10 mx-auto flex min-h-[500px] max-w-md flex-col items-center justify-center px-6 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-[#202124] text-[#E7B84B]"><Link2 size={18} /></span>
          <h2 className="mt-4 text-base font-medium text-white">Connect where you publish</h2>
          <p className="mt-2 text-xs leading-5 text-[#85868b]">Link YouTube, Instagram, or TikTok to measure views, retention, and which RelatiV cuts actually travel.</p>
          <button className="mt-5 flex h-9 items-center gap-2 rounded-md bg-[#F4F1E8] px-4 text-xs font-semibold text-[#151515] hover:bg-white">Connect an account <MoveUpRight size={13} /></button>
        </div>
      </div>
    </div>
  );
}
