"use client";

import Link from "next/link";
import { Zap, TrendingUp, DollarSign, Users } from "lucide-react";

/**
 * ValuePropBar — Sticky bar below the header showing 4 key stats that prove
 * the product's value. Helps users understand the proposition immediately.
 * Dusk edition: dark glass, gold accents, monospaced numbers.
 */
const STATS = [
  { icon: Zap, value: "4.1 min", label: "for a 2h video" },
  { icon: TrendingUp, value: "97.3%", label: "caption accuracy" },
  { icon: DollarSign, value: "$15,880", label: "paid to clippers" },
  { icon: Users, value: "5", label: "clippers earning" },
];

export default function ValuePropBar() {
  return (
    <div
      className="relative w-full z-40 hidden md:block"
      style={{
        background:
          "linear-gradient(90deg, var(--color-bg-deep) 0%, var(--color-surface) 50%, var(--color-bg-deep) 100%)",
        borderBottom: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-9 flex items-center justify-between gap-6 text-[11px]">
        {/* Left — live status */}
        <div className="flex items-center gap-2 font-mono">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              style={{ background: "#10B981" }}
            />
            <span
              className="relative inline-flex rounded-full h-1.5 w-1.5"
              style={{ background: "#10B981" }}
            />
          </span>
          <span
            className="tracking-wider uppercase"
            style={{ color: "var(--color-text-muted)" }}
          >
            v2.0 · live
          </span>
        </div>

        {/* Center — 4 stat pills */}
        <div className="flex items-center gap-1.5 lg:gap-3 overflow-x-auto">
          {STATS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-center gap-1.5">
                <Icon
                  className="h-3 w-3 shrink-0"
                  style={{ color: "var(--color-accent)" }}
                  strokeWidth={2.5}
                />
                <span
                  className="font-mono font-semibold tabular-nums"
                  style={{
                    color: "var(--color-text-primary)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.value}
                </span>
                <span
                  className="hidden lg:inline font-mono"
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: "10px",
                  }}
                >
                  {s.label}
                </span>
                {i < STATS.length - 1 && (
                  <span
                    className="hidden lg:inline mx-1.5"
                    style={{ color: "rgba(255, 245, 220, 0.15)" }}
                  >
                    ·
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right — engine spec link */}
        <Link
          href="/services"
          className="hidden lg:flex items-center gap-1.5 font-mono transition-colors"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>Read the engine spec</span>
          <span style={{ color: "var(--color-accent)" }}>→</span>
        </Link>
      </div>
    </div>
  );
}
