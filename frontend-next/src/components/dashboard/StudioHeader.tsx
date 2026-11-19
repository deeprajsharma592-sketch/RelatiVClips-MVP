"use client";

import { Crown, Bell, Zap, Plus, ArrowRight } from "lucide-react";

interface StudioHeaderProps {
  onOpenUpgrade: () => void;
}

export default function StudioHeader({ onOpenUpgrade }: StudioHeaderProps) {
  return (
    <header className="sticky top-0 z-20 w-full bg-[#0A0A0C]/90 backdrop-blur-md border-b border-white/5 flex flex-col">
      {/* Top Banner (Matches Reference) */}
      <div className="w-full bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-cyan-500/10 border-b border-white/5 px-4 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-zinc-300">
          <Crown size={14} className="text-amber-400 shrink-0" />
          <span>
            Unlock watermark-free 4K exports and auto-posting to TikTok, Shorts & Reels.
          </span>
        </div>

        <button
          onClick={onOpenUpgrade}
          className="text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-2 transition text-xs shrink-0"
        >
          Upgrade plan →
        </button>
      </div>

      {/* Main Header Row */}
      <div className="h-14 px-6 flex items-center justify-between">
        {/* Left Status */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-zinc-400 font-medium">RelatiV Engine Online</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button
            type="button"
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition relative"
            aria-label="Notifications"
          >
            <Bell size={15} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400" />
          </button>

          {/* Credits Counter Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white">
            <Zap size={13} className="text-amber-400 fill-amber-400" />
            <span>2</span>
            <span className="text-zinc-400 text-[11px]">credits</span>
          </div>

          {/* Add Credits Button */}
          <button
            onClick={onOpenUpgrade}
            className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition flex items-center gap-1 border border-white/10 shadow-sm"
          >
            <Plus size={13} />
            Add credits
          </button>
        </div>
      </div>
    </header>
  );
}
