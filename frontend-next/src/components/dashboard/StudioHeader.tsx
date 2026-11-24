"use client";

import { Bell, Zap } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/lib/AuthContext";

interface StudioHeaderProps { onOpenUpgrade: () => void }

export default function StudioHeader({ onOpenUpgrade }: StudioHeaderProps) {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#111214]/95 backdrop-blur-xl">
      <div className="flex h-14 items-center px-4 lg:px-7">
        <div className="flex items-center gap-3 lg:hidden"><BrandLogo iconWidth={28} wordmarkClassName="text-sm font-semibold text-white" /></div>
        <div className="mx-auto hidden w-full min-w-0 max-w-3xl flex-1 items-center gap-3 px-2 text-xs text-[#c6c6ca] sm:flex">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[#E7B84B]" />
          <span className="min-w-0 flex-1 truncate">Export without watermarks and keep every clip on-brand.</span>
          <button
            type="button"
            onClick={onOpenUpgrade}
            className="shrink-0 rounded-full bg-linear-to-r from-amber-300 via-orange-300 to-pink-400 px-4 py-1.5 font-semibold text-zinc-950 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E7B84B]"
          >
            View plans
          </button>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:pl-4">
          <button aria-label="Notifications" className="grid h-8 w-8 place-items-center rounded-md text-[#a1a2a7] hover:bg-white/[0.05] hover:text-white"><Bell size={15} /></button>
          <span className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-white"><Zap size={13} className="fill-[#E7B84B] text-[#E7B84B]" />{user?.credit_balance ?? 0}</span>
          <button onClick={onOpenUpgrade} className="h-8 rounded-md border border-white/[0.08] bg-[#242529] px-3 text-xs font-medium text-white hover:bg-[#2d2e32]">Add credits</button>
        </div>
      </div>
    </header>
  );
}
