"use client";

/**
 * CpmCalculator — interactive budget → impressions → clips estimator.
 * Used on /brands to make the pay-per-impression model tangible.
 *
 * Default: $5,000 budget. Sliders cap at $250K.
 * CPM is a flat $7 (the published rate). Platform margin is shown for transparency.
 *
 * Math:
 *   gross_impressions = (budget / CPM) * 1000
 *   net_after_margin = gross_impressions * (1 - margin)
 *   clips_estimated   = net_after_margin / 50_000     (1 clip ≈ 50K views)
 *   clippers_assigned = ceil(clips_estimated / 8)     (1 clipper handles ~8/wk)
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";

const CPM = 7; // $ per 1,000 verified views
const MARGIN = 0.12; // 12% platform margin (shown, not deducted invisibly)

const PLATFORMS = [
  { id: "tiktok", name: "TikTok", share: 0.45, emoji: "♪" },
  { id: "reels", name: "Instagram Reels", share: 0.30, emoji: "▢" },
  { id: "shorts", name: "YouTube Shorts", share: 0.25, emoji: "▶" },
];

export default function CpmCalculator() {
  const [budget, setBudget] = useState(5_000);

  // Use a seeded LCG for the jitter (StrictMode-safe, no Math.random in render).
  const lcg = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  };

  const result = useMemo(() => {
    const gross = (budget / CPM) * 1000;
    const net = gross * (1 - MARGIN);
    const clips = Math.round(net / 50_000);
    const clippers = Math.max(1, Math.ceil(clips / 8));
    const platformBreakdown = PLATFORMS.map((p) => ({
      ...p,
      impressions: Math.round(net * p.share),
      clips: Math.max(1, Math.round(clips * p.share)),
    }));
    return { gross, net, clips, clippers, platformBreakdown };
  }, [budget]);

  return (
    <div className="relative rounded-[var(--radius-xl)] border border-[color:var(--color-border)] bg-gradient-to-br from-[color:var(--color-surface)] to-[color:var(--color-bg-deep)] p-6 md:p-10">
      <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
        {/* Input column */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <span className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
              CPM CALCULATOR
            </span>
            <h3 className="font-display font-bold text-2xl md:text-3xl text-text-primary leading-tight">
              Plug in a budget.<br />
              <span className="bg-gradient-to-r from-[color:var(--color-accent)] to-[color:var(--color-gradient-cyan)] bg-clip-text text-transparent">
                See what you get.
              </span>
            </h3>
            <p className="mt-3 text-sm text-text-secondary">
              $7 CPM. 12% platform margin. Verified-view billing. No spend cap.
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-3">
              <label className="text-xs font-mono text-text-muted tracking-wider">
                CAMPAIGN BUDGET
              </label>
              <div className="font-display font-bold text-3xl text-[color:var(--color-accent)]">
                ${budget.toLocaleString("en-US")}
              </div>
            </div>
            <input
              type="range"
              min={1_000}
              max={250_000}
              step={1_000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-[color:var(--color-surface-2)] accent-[color:var(--color-accent)]"
              style={{
                background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${
                  ((budget - 1_000) / (250_000 - 1_000)) * 100
                }%, var(--color-surface-2) ${
                  ((budget - 1_000) / (250_000 - 1_000)) * 100
                }%, var(--color-surface-2) 100%)`,
              }}
            />
            <div className="flex justify-between text-[10px] font-mono text-text-faint mt-2">
              <span>$1K</span>
              <span>$50K</span>
              <span>$100K</span>
              <span>$250K</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
              <div className="text-[10px] font-mono text-text-faint tracking-wider">
                RATE
              </div>
              <div className="font-mono font-semibold text-text-primary">
                ${CPM} CPM
              </div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
              <div className="text-[10px] font-mono text-text-faint tracking-wider">
                MARGIN
              </div>
              <div className="font-mono font-semibold text-text-primary">
                {(MARGIN * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        {/* Output column */}
        <div className="lg:col-span-3 space-y-5">
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              key={`imp-${budget}`}
              initial={{ opacity: 0.5, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent)]/5 p-4"
            >
              <div className="text-[10px] font-mono text-[color:var(--color-accent)] tracking-widest">
                EST. VIEWS
              </div>
              <div className="mt-1 font-display font-bold text-2xl md:text-3xl text-[color:var(--color-accent)]">
                {Math.round(result.net).toLocaleString("en-US")}
              </div>
              <div className="text-[10px] font-mono text-text-faint mt-1">
                verified impressions
              </div>
            </motion.div>
            <motion.div
              key={`clp-${budget}`}
              initial={{ opacity: 0.5, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-accent-secondary)]/30 bg-[color:var(--color-accent-secondary)]/5 p-4"
            >
              <div className="text-[10px] font-mono text-[color:var(--color-accent-secondary)] tracking-widest">
                EST. CLIPS
              </div>
              <div className="mt-1 font-display font-bold text-2xl md:text-3xl text-[color:var(--color-accent-secondary)]">
                {result.clips}
              </div>
              <div className="text-[10px] font-mono text-text-faint mt-1">
                platform-ready
              </div>
            </motion.div>
          </div>

          {/* Platform breakdown */}
          <div>
            <div className="text-[10px] font-mono text-text-muted tracking-widest mb-3">
              PLATFORM SPLIT
            </div>
            <div className="space-y-2">
              {result.platformBreakdown.map((p) => {
                // Stable per-row jitter via a seeded LCG (avoid Math.random in render).
                const rng = lcg(budget * 31 + p.id.charCodeAt(0));
                const jitter = (rng() - 0.5) * 2; // -1 .. 1
                return (
                  <div
                    key={p.id}
                    className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 flex items-center gap-3"
                  >
                    <span className="h-7 w-7 rounded-md bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] flex items-center justify-center text-[color:var(--color-accent)] text-xs font-mono">
                      {p.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-primary font-medium">
                          {p.name}
                        </span>
                        <span className="font-mono text-text-muted">
                          {(p.share * 100 + jitter).toFixed(0)}%
                        </span>
                      </div>
                      {/* progress bar */}
                      <div className="mt-1.5 h-1 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.max(0, Math.min(100, p.share * 100 + jitter))}%`,
                          }}
                          transition={{ duration: 0.4 }}
                          className="h-full bg-gradient-to-r from-[color:var(--color-accent)] to-[color:var(--color-gradient-cyan)]"
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm text-text-primary">
                        {p.impressions.toLocaleString("en-US")}
                      </div>
                      <div className="text-[10px] font-mono text-text-faint">
                        {p.clips} clips
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Clippers line */}
          <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-bg-deep)]/40 px-4 py-3">
            <div className="text-xs text-text-muted">
              <span className="font-mono text-[color:var(--color-accent-tertiary)]">
                {result.clippers}
              </span>{" "}
              {result.clippers === 1 ? "clipper" : "clippers"} assigned
              <span className="text-text-faint"> · working in parallel</span>
            </div>
            <a
              href="#run"
              className="text-xs font-mono text-[color:var(--color-accent)] hover:underline whitespace-nowrap"
            >
              Launch with ${budget.toLocaleString("en-US")} →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
