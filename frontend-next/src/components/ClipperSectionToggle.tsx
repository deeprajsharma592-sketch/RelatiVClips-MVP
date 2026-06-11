"use client";

/**
 * ClipperSectionToggle — toggleable wrapper for the <ClipperSection /> block.
 *
 * Default state: OFF (the section is collapsed into a clean toggle card).
 * State persists in localStorage under the key `relativ:clipper-section`.
 *
 * The point: the homepage shouldn't be a clipper-economy page by default.
 * Clippers have their own home at /clippers. The toggle is a "peek inside"
 * affordance for people who want to see the network from the landing page.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import ClipperLeaderboard from "@/components/ClipperLeaderboard";

const STORAGE_KEY = "relativ:clipper-section";

export default function ClipperSectionToggle() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Hydrate from localStorage on mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage is a legitimate external-system sync
      if (saved === "true") setEnabled(true);
    } catch {
      // localStorage blocked (Safari private, etc.) — keep default off
    }
    setHydrated(true);
  }, []);

  const toggle = () => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <section className="relative w-full py-20 px-6 bg-[color:var(--color-bg-base)] border-t border-[color:var(--color-border)]">
      <div className="max-w-7xl mx-auto">
        {/* Toggle row */}
        <div
          className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 md:p-8 transition-colors hover:border-[color:var(--color-border-strong)]"
          data-testid="clipper-toggle-card"
        >
          {/* Faint glow on hover */}
          <div className="pointer-events-none absolute -top-32 -right-32 h-64 w-64 rounded-full bg-[color:var(--color-glow-violet)] opacity-0 group-hover:opacity-40 blur-3xl transition-opacity duration-500" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Left: label + blurb */}
            <div className="flex items-start gap-4">
              <div className="shrink-0 h-12 w-12 rounded-full bg-[color:var(--color-accent-tertiary)]/15 border border-[color:var(--color-accent-tertiary)]/30 flex items-center justify-center text-[color:var(--color-accent-tertiary)] text-xl">
                ✦
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono tracking-widest text-[color:var(--color-accent-tertiary)]">
                    CLIPPER ECONOMY · OPTIONAL
                  </span>
                  {hydrated && enabled && (
                    <span className="text-[10px] font-mono tracking-widest text-[color:var(--color-success)]">
                      · ON
                    </span>
                  )}
                </div>
                <h3 className="font-display font-bold text-2xl md:text-3xl text-text-primary leading-tight">
                  Show the clipper network on this page
                </h3>
                <p className="mt-2 text-sm text-text-secondary max-w-xl">
                  Toggle to peek at the top clippers, the live campaign board, and
                  the ad slots. We keep the homepage lean by default — the full
                  network lives at{" "}
                  <Link
                    href="/clippers"
                    className="text-[color:var(--color-accent-tertiary)] hover:underline"
                  >
                    /clippers
                  </Link>
                  .
                </p>
              </div>
            </div>

            {/* Right: switch + direct link */}
            <div className="flex items-center gap-4 shrink-0">
              <Link
                href="/clippers"
                className="hidden sm:inline-flex items-center gap-1 text-xs font-mono text-text-muted hover:text-text-primary transition-colors"
              >
                Open full page →
              </Link>

              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Show clipper section"
                onClick={toggle}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors ${
                  enabled
                    ? "bg-[color:var(--color-accent-tertiary)]/30 border-[color:var(--color-accent-tertiary)]/60"
                    : "bg-[color:var(--color-surface-2)] border-[color:var(--color-border-strong)]"
                }`}
              >
                <motion.span
                  layout
                  transition={{ type: "spring", stiffness: 700, damping: 30 }}
                  className={`inline-block h-5 w-5 rounded-full shadow-md ${
                    enabled
                      ? "bg-[color:var(--color-accent-tertiary)] ml-6"
                      : "bg-text-muted ml-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded content */}
        <AnimatePresence initial={false}>
          {hydrated && enabled && (
            <motion.div
              key="clipper-expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
              className="overflow-hidden"
            >
              <div className="pt-12">
                {/* Inline clipper leaderboard (compact version) */}
                <div className="mb-10 flex items-end justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-display font-bold text-2xl text-text-primary">
                      Top clippers this month
                    </h3>
                    <p className="mt-1 text-sm text-text-muted">
                      The 6 highest-earning creators on RelatiV.
                    </p>
                  </div>
                  <Link
                    href="/clippers"
                    className="text-sm font-mono text-text-muted hover:text-[color:var(--color-accent-tertiary)] transition-colors flex items-center gap-1"
                  >
                    See full leaderboard →
                  </Link>
                </div>
                <ClipperLeaderboard />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
