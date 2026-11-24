"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import {
  Home, FolderOpen, Calendar, BarChart2, Share2, Zap, HelpCircle,
  Key, Layers, ChevronsLeft, BookOpen,
  Clapperboard,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import BrandLogo from "@/components/BrandLogo";

export type StudioTab = "home" | "edit-studio" | "projects" | "brand-kit" | "assets" | "analyse" | "socials" | "calendar";

interface StudioSidebarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  onOpenUpgrade: () => void;
}

type NavItem = { id: StudioTab; label: string; icon: ComponentType<{ size?: number; className?: string }> };
const CREATE: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "edit-studio", label: "Edit Studio", icon: Clapperboard },
  { id: "projects", label: "Clip Vault", icon: FolderOpen },
  { id: "assets", label: "Asset library", icon: Layers },
];
const PUBLISH: NavItem[] = [
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "analyse", label: "Analytics", icon: BarChart2 },
  { id: "socials", label: "Social accounts", icon: Share2 },
];

export default function StudioSidebar({ activeTab, onSelectTab, onOpenUpgrade }: StudioSidebarProps) {
  const { user } = useAuth();
  const name = user?.name || "Creator";
  const initial = name.charAt(0).toUpperCase();
  const [balance, setBalance] = useState<number | null>(null);
  const credits = balance ?? user?.credit_balance ?? 0;

  useEffect(() => {
    const update = (event: Event) => {
      const next = (event as CustomEvent<{ balance?: number }>).detail?.balance;
      if (typeof next === "number") setBalance(next);
    };
    window.addEventListener("relativ:credits-updated", update);
    return () => window.removeEventListener("relativ:credits-updated", update);
  }, []);

  const group = (label: string, items: NavItem[]) => (
    <section className="space-y-1">
      <p className="px-3 pb-1 text-[11px] font-medium text-[#77787d]">{label}</p>
      {items.map(({ id, label: itemLabel, icon: Icon }) => {
        const selected = activeTab === id;
        return (
          <button key={id} type="button" onClick={() => onSelectTab(id)}
            className={`group flex h-9 w-full items-center justify-between rounded-md px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7B84B]/70 ${selected ? "bg-[#27282b] text-[#F5F2E9]" : "text-[#b6b7bc] hover:bg-white/[0.045] hover:text-white"}`}>
            <span className="flex items-center gap-2.5"><Icon size={15} className={selected ? "text-[#E7B84B]" : "text-[#8b8c91] group-hover:text-[#d7d7da]"} />{itemLabel}</span>
          </button>
        );
      })}
    </section>
  );

  return (
    <>
    <aside className="sticky top-0 z-30 hidden h-screen w-[244px] shrink-0 select-none flex-col border-r border-white/[0.07] bg-[#141517] lg:flex">
      <div className="flex h-16 items-center justify-between px-4">
        <Link href="/" aria-label="RelatiV home"><BrandLogo iconWidth={30} wordmarkClassName="text-sm font-semibold text-white" /></Link>
        <button type="button" aria-label="Collapse navigation" className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.07] text-[#85868b] hover:text-white"><ChevronsLeft size={15} /></button>
      </div>

      <div className="px-3 pb-3">
        <button type="button" className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.07] bg-[#1a1b1e] p-2 text-left">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#39465f] text-sm font-semibold text-white">{initial}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-white">{name}</span><span className="mt-0.5 block text-[10px] text-[#8d8e93]">Personal workspace · Free</span></span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#A8FF4F]" />
        </button>
        <Link
          href="/contact?intent=clip-credits"
          className="mt-2 flex h-9 w-full items-center gap-2 rounded-md border border-white/[0.07] px-3 text-xs text-[#c8c8cc] hover:bg-white/[0.04]"
        >
          <Zap size={14} aria-hidden="true" />
          Get Clip Credits
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {group("Create", CREATE)}
        {group("Publish", PUBLISH)}
      </nav>

      <div className="space-y-1 border-t border-white/[0.06] p-3">
        <button onClick={onOpenUpgrade} className="mb-3 flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-[#1a1b1e] px-3 py-2.5 text-xs">
          <span className="flex items-center gap-2 text-[#c8c9cd]"><Zap size={14} className="fill-[#E7B84B] text-[#E7B84B]" /><b className="text-white">{credits}</b> credits</span>
          <span className="text-[#E7B84B]">Add</span>
        </button>
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
            <Icon size={14} />{label}
          </Link>
        ))}
      </div>
    </aside>
    <nav className="fixed inset-x-3 bottom-3 z-40 flex h-14 items-center justify-around rounded-xl border border-white/[0.1] bg-[#17181a]/95 px-2 shadow-2xl backdrop-blur-xl lg:hidden">
      {[...CREATE.slice(0, 2), ...PUBLISH.slice(0, 2)].map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => onSelectTab(id)} className={`flex min-w-16 flex-col items-center gap-1 text-[9px] ${activeTab === id ? "text-[#E7B84B]" : "text-[#8f9095]"}`}><Icon size={16} /><span>{label.replace("My ", "")}</span></button>
      ))}
    </nav>
    </>
  );
}
