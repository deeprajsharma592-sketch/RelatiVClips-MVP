"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Bell, CircleAlert, CircleCheck, Clock3, Zap } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/lib/AuthContext";

import type { StoredProject } from "@/lib/projectStorage";

interface StudioHeaderProps {
  onOpenUpgrade: () => void;
  projects: StoredProject[];
}

const projectStatus = {
  ready: { Icon: CircleCheck, label: "Clips ready", color: "text-emerald-300" },
  failed: { Icon: CircleAlert, label: "Processing failed", color: "text-rose-300" },
  processing: { Icon: Clock3, label: "Processing video", color: "text-amber-300" },
};

export default function StudioHeader({ onOpenUpgrade, projects }: StudioHeaderProps) {
  const { user } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const activity = notificationsOpen ? [...projects].sort((a, b) => b.createdAt - a.createdAt) : [];

  useEffect(() => {
    if (!notificationsOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !panelRef.current?.contains(target) && !bellRef.current?.contains(target)) {
        setNotificationsOpen(false);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        bellRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [notificationsOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-black/55 backdrop-blur-xl">
      <div className="flex min-h-14 items-center gap-3 px-4 py-2 lg:px-7">
        <div className="flex items-center gap-3 lg:hidden"><BrandLogo iconWidth={28} wordmarkClassName="text-sm font-semibold text-white" /></div>
        <div className="hidden min-w-0 flex-1 items-center justify-center gap-3 px-2 text-center sm:flex lg:gap-5">
          <span className="min-w-0 text-base font-medium leading-snug text-zinc-200 lg:text-lg">Export without watermarks and keep every clip on-brand.</span>
          <button
            type="button"
            onClick={onOpenUpgrade}
            className="shrink-0 rounded-full bg-linear-to-r from-amber-300 via-orange-300 to-pink-400 px-4 py-1.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E7B84B]"
          >
            View plans
          </button>
        </div>
        <div className="relative ml-auto flex shrink-0 items-center gap-2 sm:pl-4">
          <button
            ref={bellRef}
            type="button"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            aria-controls={panelId}
            onClick={() => setNotificationsOpen((open) => !open)}
            className="grid size-9 cursor-pointer place-items-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#E7B84B] aria-expanded:bg-white/10 aria-expanded:text-white"
          >
            <Bell size={17} aria-hidden="true" />
          </button>
          <section
            ref={panelRef}
            id={panelId}
            aria-label="Notifications"
            hidden={!notificationsOpen}
            className="absolute right-0 top-full z-30 mt-3 w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#18191c] text-left shadow-2xl shadow-black/60"
          >
            <h2 className="border-b border-white/10 px-5 py-4 text-base font-semibold text-white">Notifications</h2>
            {activity.length ? (
              <ul className="max-h-[min(60dvh,28rem)] divide-y divide-white/8 overflow-y-auto overscroll-contain">
                {activity.map((project) => {
                  const { Icon, label, color } = projectStatus[project.status];
                  return (
                    <li key={project.id} className="flex items-start gap-3 px-5 py-4">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-white/5 ${color}`}>
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="mt-0.5 wrap-break-word text-sm text-zinc-300">{project.title}</p>
                        <p className="mt-1.5 text-xs text-zinc-400">Started {new Date(project.createdAt).toLocaleDateString()}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-zinc-400">No notifications yet. Your clip activity will appear here.</p>
            )}
          </section>
          <span className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-white"><Zap size={13} className="fill-[#E7B84B] text-[#E7B84B]" />{user?.credit_balance ?? 0}</span>
          <button onClick={onOpenUpgrade} className="h-8 rounded-md border border-white/[0.08] bg-[#242529] px-3 text-xs font-medium text-white hover:bg-[#2d2e32]">Add credits</button>
        </div>
      </div>
    </header>
  );
}
