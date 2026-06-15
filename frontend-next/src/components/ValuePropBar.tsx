"use client";

import Link from "next/link";
import { Rocket, Code2, Sparkles, ArrowUpRight } from "lucide-react";

/**
 * Apple-style top strip — thin (32px), single line, theme-aware glass.
 *
 * Replaces the previous ValuePropBar which had too many pills. The new
 * design is calm and minimal:
 *  - Center: 3 status items separated by tiny dots
 *  - Right: a single small "Engine spec" link
 *  - Background: glass-morphic, theme-aware (frosted light / deep dark)
 *  - Border: 1px hairline bottom only
 *
 * Conceptually: the way Apple's product launch pages do "iPhone 15 Pro
 * Titanium. From $999. >" — not loud, just a small acknowledgement that
 * something is happening.
 */
const ITEMS = [
  { icon: Rocket, label: "v2.0 just shipped" },
  { icon: Code2, label: "open codebase" },
  { icon: Sparkles, label: "public beta" },
];

export default function ValuePropBar() {
  return (
    <div
      className="relative w-full z-30 hidden md:block"
      style={{
        background: "var(--glass-light-strong)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-[34px] flex items-center justify-between gap-6 text-[12px]">
        {/* Center — single calm line, 3 items separated by subtle dot */}
        <div className="flex-1" />
        <div className="flex items-center gap-3 lg:gap-5">
          {ITEMS.map((s, i) => {
            const Icon = s.icon;
            return (
              <span key={i} className="inline-flex items-center gap-1.5">
                <Icon
                  className="h-3 w-3 shrink-0"
                  style={{ color: "var(--color-accent)" }}
                  strokeWidth={2.2}
                />
                <span
                  className="hidden sm:inline"
                  style={{
                    color: "var(--color-text-secondary)",
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {s.label}
                </span>
                {i < ITEMS.length - 1 && (
                  <span
                    aria-hidden
                    className="hidden lg:inline-block ml-3 lg:ml-5 h-1 w-1 rounded-full"
                    style={{ background: "var(--color-border-strong)" }}
                  />
                )}
              </span>
            );
          })}
        </div>

        {/* Right — single small engine spec link */}
        <div className="flex-1 flex justify-end">
          <Link
            href="/services"
            className="inline-flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{
              color: "var(--color-text-secondary)",
              fontWeight: 500,
            }}
          >
            <span className="hidden sm:inline">Engine spec</span>
            <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </div>
  );
}
