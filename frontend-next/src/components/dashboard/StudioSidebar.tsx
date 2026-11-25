"use client";

import Link from "next/link";
import { useState, type ComponentType } from "react";
import {
  Home, FolderOpen, Calendar, BarChart2, Share2, Zap, HelpCircle,
  Key, Layers, ChevronDown, ChevronsLeft, ChevronsRight, BookOpen, LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import BrandLogo from "@/components/BrandLogo";

export type StudioTab = "home" | "projects" | "brand-kit" | "assets" | "analyse" | "socials" | "calendar";

interface StudioSidebarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
}

type NavItem = { id: StudioTab; label: string; icon: ComponentType<{ size?: number; className?: string }> };
const CREATE: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "projects", label: "Clip Vault", icon: FolderOpen },
  { id: "assets", label: "Asset library", icon: Layers },
];
const PUBLISH: NavItem[] = [
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "analyse", label: "Analytics", icon: BarChart2 },
  { id: "socials", label: "Social accounts", icon: Share2 },
];

export default function StudioSidebar({ activeTab, onSelectTab }: StudioSidebarProps) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const ToggleIcon = collapsed ? ChevronsRight : ChevronsLeft;
  const name = user?.name || "Creator";
  const initial = name.charAt(0).toUpperCase();

  const group = (label: string, items: NavItem[]) => (
    <section className="space-y-1">
      <p className={collapsed ? "sr-only" : "px-3 pb-1 text-[11px] font-medium text-white"}>{label}</p>
      {items.map(({ id, label: itemLabel, icon: Icon }) => {
        const selected = activeTab === id;
        return (
          <button key={id} type="button" onClick={() => onSelectTab(id)} title={collapsed ? itemLabel : undefined}
            className={`group flex h-9 w-full items-center rounded-md text-[13px] ${collapsed ? "justify-center" : "px-3"} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7B84B]/70 ${selected ? "bg-[#27282b] text-white" : "text-white hover:bg-white/[0.045]"}`}>
            <span className="flex items-center gap-2.5"><Icon size={15} className={selected ? "text-[#E7B84B]" : "text-[#8b8c91] group-hover:text-[#d7d7da]"} /><span className={collapsed ? "sr-only" : undefined}>{itemLabel}</span></span>
          </button>
        );
      })}
    </section>
  );

  return (
    <>
    <aside className={`sticky top-0 z-30 hidden h-screen shrink-0 select-none flex-col border-r border-white/[0.07] bg-black/45 backdrop-blur-xl lg:flex ${collapsed ? "w-16" : "w-[244px]"}`}>
      <div className={`flex h-16 shrink-0 items-center px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && <Link href="/" aria-label="RelatiV home"><BrandLogo iconWidth={30} wordmarkClassName="text-sm font-semibold text-white" /></Link>}
        <button
          type="button"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          aria-controls="studio-desktop-navigation"
          onClick={() => setCollapsed(value => !value)}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-white/[0.07] text-[#85868b] hover:text-white focus-visible:outline-2 focus-visible:outline-[#E7B84B]"
        >
          <ToggleIcon size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/contact?intent=clip-credits"
          title={collapsed ? "Get Free Credits" : undefined}
          className={`mt-2 flex h-9 w-full items-center gap-2 rounded-md border border-white/[0.07] text-xs text-[#c8c8cc] hover:bg-white/[0.04] ${collapsed ? "justify-center" : "px-3"}`}
        >
          <Zap size={14} aria-hidden="true" />
          <span className={collapsed ? "sr-only" : "text-white"}>Get Free Credits</span>
        </Link>
      </div>

      <nav id="studio-desktop-navigation" aria-label="Studio navigation" className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {group("Create", CREATE)}
        {group("Publish", PUBLISH)}
      </nav>

      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <details className="group/profile relative">
          <summary aria-label={collapsed ? `${name} profile menu` : undefined} className={`flex cursor-pointer list-none items-center gap-2.5 rounded-xl border border-white/[0.07] bg-[#232428] px-2.5 py-2 text-left hover:bg-[#2b2c30] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E7B84B] [&::-webkit-details-marker]:hidden ${collapsed ? "justify-center !px-0" : ""}`}>
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-[#111214] text-sm font-semibold text-white">{initial}</span>
            <span className={collapsed ? "sr-only" : "min-w-0 flex-1"}>
              <span className="block truncate text-sm font-medium text-white">{name}</span>
            </span>
            {!collapsed && <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-zinc-400 rotate-180 transition-transform group-open/profile:rotate-0" />}
          </summary>
          <div className={`absolute z-10 space-y-0.5 rounded-xl border border-white/[0.07] bg-[#1a1b1e] p-1.5 ${collapsed ? "bottom-0 left-full ml-3 w-52" : "inset-x-0 bottom-full mb-2"}`}>
            {[
              { Icon: Key, label: "API access", href: "/api-access" },
              { Icon: BookOpen, label: "Learning center", href: "/learning-center" },
              { Icon: HelpCircle, label: "Help center", href: "/help-center" },
            ].map(({ Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                className="flex h-8 w-full items-center gap-2.5 rounded-md px-3 text-[12px] text-[#8f9095] hover:bg-white/[0.04] hover:text-white transition-colors"
              >
                <Icon size={14} /><span className="text-white">{label}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => void logout()}
              className="flex h-8 w-full items-center gap-2.5 rounded-md px-3 text-left text-[12px] text-rose-300 transition-colors hover:bg-rose-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
            >
              <LogOut size={14} aria-hidden="true" />
              <span className="text-white">Log out</span>
            </button>
          </div>
        </details>
      </div>
    </aside>
    <nav className="fixed inset-x-3 bottom-3 z-40 flex h-14 items-center justify-around rounded-xl border border-white/[0.1] bg-[#17181a]/95 px-2 shadow-2xl backdrop-blur-xl lg:hidden">
      {[...CREATE.slice(0, 2), ...PUBLISH.slice(0, 2)].map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => onSelectTab(id)} className={`flex min-w-16 flex-col items-center gap-1 text-[9px] ${activeTab === id ? "text-[#E7B84B]" : "text-[#8f9095]"}`}><Icon size={16} /><span className="text-white">{label.replace("My ", "")}</span></button>
      ))}
    </nav>
    </>
  );
}
