"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Bell, ExternalLink, Zap } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/lib/AuthContext";


interface StudioHeaderProps { onOpenUpgrade: () => void }

const updates = [
  {
    title: "Auto Headlines just got a glow up with new styles",
    description: "Turn on Auto Headline and every clip opens with a stronger line, in whatever style you pick.",
  },
  {
    title: "Bring in your audio from a file or a link",
    description: "Open Audio and click Upload to bring in a track, however you have it.",
  },
  {
    title: "Now publish to Pinterest, Threads, and Bluesky",
    description: "Connect your Pinterest, Threads, or Bluesky account and publish directly from RelatiV.",
  },
  {
    title: "Generate animated video assets in one prompt",
    description: "Create B-Rolls, intro/outros, or any motion assets you want in Motion Studio.",
  },
];

export default function StudioHeader({ onOpenUpgrade }: StudioHeaderProps) {
  const { user } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

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
            aria-label="What's new"
            hidden={!notificationsOpen}
            className="absolute right-0 top-full z-30 mt-3 max-h-[min(80vh,700px)] w-[min(40rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-white/[0.08] bg-[#18181b] p-5 text-left shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:p-8"
          >
            <div className="space-y-7 sm:space-y-8">
              {updates.map((update) => (
                <article key={update.title} className="grid grid-cols-[1fr_24px] items-start gap-4">
                  <div>
                    <h2 className="text-base font-medium leading-6 text-[#f4f4f5] sm:text-[17px]">{update.title}</h2>
                    <p className="mt-1 text-sm leading-[1.55] text-[#a1a1aa] sm:text-base">{update.description}</p>
                  </div>
                  <ExternalLink size={20} aria-hidden="true" className="mt-1 text-[#a1a1aa]" />
                </article>
              ))}
            </div>
          </section>
          <span className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-white"><Zap size={13} className="fill-[#E7B84B] text-[#E7B84B]" />{user && !user.profile_pending ? user.credit_balance : "—"}</span>
          <button onClick={onOpenUpgrade} className="h-8 rounded-md border border-white/[0.08] bg-[#242529] px-3 text-xs font-medium text-white hover:bg-[#2d2e32]">Add credits</button>
        </div>
      </div>
    </header>
  );
}
