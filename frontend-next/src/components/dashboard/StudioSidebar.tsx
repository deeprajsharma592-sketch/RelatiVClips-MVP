"use client";

import Link from "next/link";
import {
  Home,
  FolderOpen,
  Calendar,
  BarChart2,
  Share2,
  Zap,
  Crown,
  HelpCircle,
  FlaskConical,
  Key,
  Layers,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import BrandLogo from "@/components/BrandLogo";

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
  const { user } = useAuth();
  const userName = user?.name || "Creator";
  const userInitial = userName.charAt(0).toUpperCase() || "C";

  return (
    <aside className="w-60 bg-[#0E0E10] border-r border-white/[0.08] flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-30 font-sans">
      {/* Top Section */}
      <div className="p-3.5 space-y-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1 pb-1">
          <Link href="/" className="group" aria-label="RelatiV home">
            <BrandLogo iconWidth={34} wordmarkClassName="text-sm font-bold tracking-tight text-white" />
          </Link>
        </div>

        {/* User Card */}
        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-md bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {userInitial}
            </div>
            <div className="truncate leading-tight">
              <p className="text-xs font-medium text-white truncate">{userName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-zinc-400">Free</span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenUpgrade}
            className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium hover:bg-amber-500/20 transition shrink-0 cursor-pointer"
          >
            👑 Upgrade
          </button>
        </div>

        {/* Invite members button */}
        <button
          onClick={onOpenUpgrade}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-xs text-zinc-300 transition cursor-pointer"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-medium">
            <span>+</span> Invite members
          </span>
          <span className="text-[10px] text-amber-300">👑</span>
        </button>

        {/* Navigation Sections */}
        <div className="space-y-4 pt-1">
          {/* SECTION: CREATE */}
          <div>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              Create
            </p>
            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectTab("home")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "home"
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Home size={14} className={activeTab === "home" ? "text-white" : "text-zinc-400"} />
                <span>Home</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("projects")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "projects"
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <FolderOpen size={14} className={activeTab === "projects" ? "text-white" : "text-zinc-400"} />
                <span>My projects</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("brand-kit")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "brand-kit"
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className={activeTab === "brand-kit" ? "text-white" : "text-zinc-400"} />
                  <span>Brand kit</span>
                </div>
                <span className="text-[10px] text-amber-400">👑</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("assets")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "assets"
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Layers size={14} className={activeTab === "assets" ? "text-white" : "text-zinc-400"} />
                <span>Asset library</span>
              </button>
            </nav>
          </div>

          {/* SECTION: POST */}
          <div>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              Post
            </p>
            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectTab("calendar")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "calendar"
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Calendar size={14} className={activeTab === "calendar" ? "text-white" : "text-zinc-400"} />
                <span>Calendar</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("analyse")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "analyse"
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <BarChart2 size={14} className={activeTab === "analyse" ? "text-white" : "text-zinc-400"} />
                <span>Analyse</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("socials")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "socials"
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Share2 size={14} className={activeTab === "socials" ? "text-white" : "text-zinc-400"} />
                <span>Social accounts</span>
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="p-3.5 space-y-3 border-t border-white/[0.06]">
        {/* Credits Pill */}
        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Zap size={13} className="text-amber-400 fill-amber-400" />
            <span className="font-semibold text-white">2</span>
            <span className="text-[11px] text-zinc-400">credits left</span>
          </div>
          <button
            onClick={onOpenUpgrade}
            className="text-[10px] text-zinc-400 hover:text-white font-medium cursor-pointer"
          >
            Upgrade
          </button>
        </div>

        {/* Links */}
        <div className="space-y-1 text-xs">
          <button
            onClick={() => alert("RelatiV Labs experimental beta features.")}
            className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-zinc-500 hover:text-zinc-300 transition text-[11px] cursor-pointer"
          >
            <FlaskConical size={13} />
            <span>RelatiV Labs</span>
          </button>

          <button
            onClick={onOpenUpgrade}
            className="w-full flex items-center justify-between px-2 py-1 rounded-md text-zinc-500 hover:text-zinc-300 transition text-[11px] cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Key size={13} />
              <span>API Access</span>
            </div>
            <span className="text-[10px] text-amber-400">👑</span>
          </button>

          <a
            href="https://relativclips.com/contact"
            className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-zinc-500 hover:text-zinc-300 transition text-[11px]"
          >
            <HelpCircle size={13} />
            <span>Help center</span>
          </a>
        </div>
      </div>
    </aside>
  );
}
