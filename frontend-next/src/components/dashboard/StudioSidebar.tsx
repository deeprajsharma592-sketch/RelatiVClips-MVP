"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Home,
  Film,
  Sparkles,
  FolderOpen,
  Calendar,
  BarChart2,
  Share2,
  Zap,
  Crown,
  ChevronRight,
  HelpCircle,
  BookOpen,
  LogOut,
  Settings,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export type StudioTab = "home" | "projects" | "brand-kit" | "assets" | "analyse" | "socials" | "calendar";

interface StudioSidebarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  onOpenUpgrade: () => void;
}

export default function StudioSidebar({
  activeTab,
  onSelectTab,
  onOpenUpgrade,
}: StudioSidebarProps) {
  const { user, logout } = useAuth();
  const userName = user?.name || "Creator";
  const userInitial = userName.charAt(0).toUpperCase() || "D";

  return (
    <aside className="w-64 bg-[#0B0C10] border-r border-white/10 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-30">
      {/* Top Section */}
      <div className="p-4 space-y-6">
        {/* Brand / Logo */}
        <div className="flex items-center justify-between px-2 pt-1">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center text-black font-black text-base shadow-sm group-hover:scale-105 transition">
              R
            </span>
            <div className="leading-tight">
              <span className="text-sm font-bold text-white tracking-tight flex items-center gap-1">
                RelatiV <span className="text-[10px] px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-300 font-mono">STUDIO</span>
              </span>
              <span className="text-[10px] text-zinc-400">Viral Short-Form Engine</span>
            </div>
          </Link>
        </div>

        {/* User Card */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border border-white/15 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {userInitial}
            </div>
            <div className="truncate leading-tight">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-zinc-400">Free Tier</span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenUpgrade}
            className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium hover:bg-amber-500/20 transition shrink-0"
          >
            👑 Upgrade
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-4">
          {/* CREATE GROUP */}
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Create
            </p>
            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectTab("home")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === "home"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Home size={15} className={activeTab === "home" ? "text-cyan-400" : "text-zinc-400"} />
                <span>Home Studio</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("projects")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === "projects"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Film size={15} className={activeTab === "projects" ? "text-cyan-400" : "text-zinc-400"} />
                <span>My Projects</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("brand-kit")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === "brand-kit"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles size={15} className="text-purple-400" />
                  <span>Brand Kit</span>
                </div>
                <Crown size={12} className="text-amber-400" />
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("assets")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === "assets"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <FolderOpen size={15} className={activeTab === "assets" ? "text-cyan-400" : "text-zinc-400"} />
                <span>Asset Library</span>
              </button>
            </nav>
          </div>

          {/* POST & GROWTH GROUP */}
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Post & Growth
            </p>
            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectTab("analyse")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === "analyse"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BarChart2 size={15} className={activeTab === "analyse" ? "text-cyan-400" : "text-zinc-400"} />
                  <span>Analyse</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold">
                  NEW
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("socials")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === "socials"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Share2 size={15} className={activeTab === "socials" ? "text-purple-400" : "text-zinc-400"} />
                <span>Social Accounts</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("calendar")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === "calendar"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Calendar size={15} className={activeTab === "calendar" ? "text-cyan-400" : "text-zinc-400"} />
                <span>Publish Calendar</span>
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="p-4 border-t border-white/5 space-y-3">
        {/* Credits Pill & Upgrade */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Zap size={14} className="text-amber-400 fill-amber-400" />
              <span className="text-xs font-bold text-white">2 Credits left</span>
            </div>
            <span className="text-[10px] text-zinc-400">Resets monthly</span>
          </div>

          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-3">
            <div className="bg-gradient-to-r from-amber-400 to-cyan-400 h-full w-[40%]" />
          </div>

          <button
            onClick={onOpenUpgrade}
            className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-cyan-400 to-purple-500 hover:from-cyan-300 hover:to-purple-400 text-black text-xs font-bold transition flex items-center justify-center gap-1 shadow"
          >
            <Crown size={12} className="fill-black" />
            Upgrade Plan
          </button>
        </div>

        {/* External links */}
        <div className="flex items-center justify-between text-xs text-zinc-400 px-2 pt-1">
          <Link href="/admin" className="hover:text-zinc-200 transition text-[11px] flex items-center gap-1">
            <Settings size={12} />
            Control Room
          </Link>
          <button
            onClick={() => logout("/dashboard")}
            className="hover:text-red-400 transition text-[11px] flex items-center gap-1"
          >
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
