"use client";

import { motion } from "framer-motion";

// Live-feel "creators clipping right now" ticker.
// Pure UI, no backend. Animates a marquee strip with fake but plausible names,
// channels, and earnings to create a sense of activity.

type ClipEvent = {
  name: string;
  channel: string;
  action: string;
  earnings: string;
  hue: "coral" | "gold" | "violet" | "teal";
};

const SAMPLE_EVENTS: ClipEvent[] = [
  { name: "Marcus J.", channel: "TechLinked", action: "just earned", earnings: "$42.18", hue: "coral" },
  { name: "Priya K.", channel: "Lenny's Podcast", action: "shipped 8 clips from", earnings: "8 clips", hue: "violet" },
  { name: "AnimeArc", channel: "Jujutsu Kaisen S2", action: "sliced 6 hooks from", earnings: "6 hooks", hue: "teal" },
  { name: "CoachDev", channel: "Huberman Lab #217", action: "made", earnings: "$128.40", hue: "gold" },
  { name: "Riley W.", channel: "MrBeast Interview", action: "went viral:", earnings: "1.2M views", hue: "coral" },
  { name: "Sam D.", channel: "Diary of a CEO", action: "ranked #3 on", earnings: "TikTok", hue: "violet" },
  { name: "Nina P.", channel: "NPR Politics", action: "clipped", earnings: "12 stories", hue: "teal" },
  { name: "ComedyForge", channel: "Kill Tony #487", action: "earned", earnings: "$67.00", hue: "gold" },
  { name: "Dr. Lin", channel: "Stanford Med Lecture", action: "packaged", earnings: "9 reels", hue: "coral" },
  { name: "VoiceOfReason", channel: "Lex Fridman #402", action: "shipped", earnings: "11 clips", hue: "violet" },
  { name: "FoodieSlice", channel: "Babish 4hr Special", action: "made", earnings: "$54.90", hue: "teal" },
  { name: "SportsPulse", channel: "UFC 300 PPV", action: "captured", earnings: "22 hooks", hue: "gold" },
];

const HUE_DOT: Record<ClipEvent["hue"], string> = {
  coral: "bg-accent",
  gold: "bg-[color:var(--color-accent-secondary)]",
  violet: "bg-[color:var(--color-accent-tertiary)]",
  teal: "bg-[color:var(--color-accent-quaternary)]",
};

const HUE_GLOW: Record<ClipEvent["hue"], string> = {
  coral: "shadow-[0_0_12px_var(--color-glow-coral)]",
  gold: "shadow-[0_0_12px_var(--color-glow-gold)]",
  violet: "shadow-[0_0_12px_var(--color-glow-violet)]",
  teal: "shadow-[0_0_12px_var(--color-glow-teal)]",
};

export default function LiveTicker() {
  // Duplicate events so the marquee wraps seamlessly.
  const events = [...SAMPLE_EVENTS, ...SAMPLE_EVENTS];

  return (
    <div className="relative w-full overflow-hidden border-y border-[color:var(--color-border)] bg-[color:var(--color-bg-deep)] py-3">
      {/* Side fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[color:var(--color-bg-deep)] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[color:var(--color-bg-deep)] to-transparent z-10" />

      {/* Live dot */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--color-error)] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[color:var(--color-error)]" />
        </span>
        <span className="text-[10px] font-mono tracking-widest text-text-muted">LIVE</span>
      </div>

      <motion.div
        className="flex gap-8 animate-marquee whitespace-nowrap pl-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        {events.map((event, i) => (
          <div key={i} className="flex items-center gap-2.5 text-sm font-sans">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${HUE_DOT[event.hue]} ${HUE_GLOW[event.hue]}`}
            />
            <span className="text-text-primary font-medium">{event.name}</span>
            <span className="text-text-muted">{event.action}</span>
            <span className="text-text-secondary font-mono">{event.channel}</span>
            <span className="text-text-muted">·</span>
            <span className="font-mono font-semibold text-[color:var(--color-accent-secondary)]">
              {event.earnings}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
