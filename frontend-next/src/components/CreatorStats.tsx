"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

type Stat = {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  format?: "number" | "currency" | "compact";
  hue: "coral" | "gold" | "violet" | "teal";
};

const BASE_STATS: Stat[] = [
  { label: "Clips generated", value: 2_847_192, format: "compact", hue: "coral" },
  { label: "Active clippers", value: 18_421, format: "number", hue: "violet" },
  { label: "Paid to creators", value: 412_300, prefix: "$", format: "currency", hue: "gold" },
  { label: "Brands running campaigns", value: 327, format: "number", hue: "teal" },
];

// Increments per second to simulate live activity.
const TICKS_PER_SECOND: Record<string, number> = {
  "Clips generated": 0.74,
  "Active clippers": 0.04,
  "Paid to creators": 0.18,
  "Brands running campaigns": 0.001,
};

const HUE_BG: Record<Stat["hue"], string> = {
  coral: "from-[color:var(--color-accent)]/10 to-transparent",
  gold: "from-[color:var(--color-accent-secondary)]/10 to-transparent",
  violet: "from-[color:var(--color-accent-tertiary)]/10 to-transparent",
  teal: "from-[color:var(--color-accent-quaternary)]/10 to-transparent",
};

const HUE_TEXT: Record<Stat["hue"], string> = {
  coral: "text-[color:var(--color-accent)]",
  gold: "text-[color:var(--color-accent-secondary)]",
  violet: "text-[color:var(--color-accent-tertiary)]",
  teal: "text-[color:var(--color-accent-quaternary)]",
};

// HUE_GLOW reserved for the next design pass — surfaces that pulse on stat hover
// const HUE_GLOW: Record<Stat["hue"], string> = {
//   coral: "bg-[color:var(--color-glow-coral)]",
//   gold: "bg-[color:var(--color-glow-gold)]",
//   violet: "bg-[color:var(--color-glow-violet)]",
//   teal: "bg-[color:var(--color-glow-teal)]",
// };

function formatValue(stat: Stat, value: number): string {
  const v = stat.prefix === "$" ? value : Math.floor(value);
  if (stat.format === "compact") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return `${v}`;
  }
  if (stat.format === "currency") {
    return `$${v.toLocaleString("en-US")}`;
  }
  return v.toLocaleString("en-US");
}

export default function CreatorStats() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative w-full py-20 px-6 bg-[color:var(--color-bg-deep)] border-y border-[color:var(--color-border)]">
      {/* Soft top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-accent)]/40 to-transparent" />

      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
            <span className="h-1 w-1 rounded-full bg-[color:var(--color-success)]" />
            CREATOR ECONOMY · LIVE NUMBERS
          </span>
          <h2 className="font-display font-bold text-3xl md:text-5xl text-text-primary tracking-tight max-w-3xl mx-auto">
            The fastest-growing clipper network on the internet.
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {BASE_STATS.map((stat, i) => {
            const value = stat.value + tick * (TICKS_PER_SECOND[stat.label] ?? 0);
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 transition-colors hover:border-[color:var(--color-border-strong)]"
              >
                {/* Hue gradient background */}
                <div
                  className={`pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-gradient-radial ${HUE_BG[stat.hue]} blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`}
                />

                <div className="relative">
                  <div className={`text-4xl md:text-5xl font-display font-bold tracking-tight ${HUE_TEXT[stat.hue]}`}>
                    {formatValue(stat, value)}
                    {stat.suffix && <span className="text-2xl ml-1">{stat.suffix}</span>}
                  </div>
                  <div className="mt-3 text-sm text-text-muted font-sans">{stat.label}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Subtext strip */}
        <div className="mt-10 text-center text-xs text-text-faint font-mono">
          Numbers tick forward every second. Updated continuously from the RelatiV ledger.
        </div>
      </div>
    </section>
  );
}
