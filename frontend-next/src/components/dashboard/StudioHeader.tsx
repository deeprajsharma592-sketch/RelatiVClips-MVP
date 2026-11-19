"use client";

import { Crown, Bell, Zap, Plus } from "lucide-react";

interface StudioHeaderProps {
  onOpenUpgrade: () => void;
}

export default function StudioHeader({ onOpenUpgrade }: StudioHeaderProps) {
  return (
    <header className="sticky top-0 z-20 w-full bg-[#0E0E10] border-b border-white/[0.08] flex flex-col font-sans">
      {/* Top Banner (Exact match to OpusClip picture) */}
      <div className="w-full bg-[#121216] border-b border-white/[0.06] px-4 py-2 flex items-center justify-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-zinc-300">
          <span className="text-amber-400 text-xs">👑</span>
          <span>Unlock watermark-free exports and make your content look pro.</span>
        </div>

        <button
          onClick={onOpenUpgrade}
          className="px-2.5 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-medium transition cursor-pointer"
        >
          Upgrade plan
        </button>
      </div>

      {/* Main Header Row */}
      <div className="h-12 px-6 flex items-center justify-end gap-3">
        {/* Notifications */}
        <button
          type="button"
          className="w-8 h-8 rounded-md bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white transition cursor-pointer"
          aria-label="Notifications"
        >
          <Bell size={14} />
        </button>

        {/* Credits Counter */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-xs font-medium text-white">
          <Zap size={12} className="text-amber-400 fill-amber-400" />
          <span>2</span>
        </div>

        {/* Add Credits Button (Crisp rectangular button with subtle edges) */}
        <button
          onClick={onOpenUpgrade}
          className="px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-medium transition border border-white/10 cursor-pointer"
        >
          Add credits
        </button>
      </div>
    </header>
  );
}
