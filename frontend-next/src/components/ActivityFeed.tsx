"use client";

/**
 * ActivityFeed — Scrolling list of recent pipeline events.
 * Subscribes to the same current_step changes that drive the stepper
 * and shows the last N events as a live log. Events fade in from the
 * bottom (newest at the bottom) so the eye can track the most recent
 * work without distraction.
 */

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";

export interface FeedEvent {
  id: number;          // monotonic, used as key + for diffing
  ts: number;          // performance.now() at creation
  message: string;
  step?: number;
  kind?: "step" | "sub" | "info" | "error" | "cost" | "cache";
}

interface Props {
  events: FeedEvent[];
  maxVisible?: number;
}

export function ActivityFeed({ events, maxVisible = 12 }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Auto-scroll to bottom on new event
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events.length]);

  const visible = events.slice(-maxVisible);

  return (
    <div
      className="font-mono text-[11px] leading-relaxed overflow-y-auto pr-2"
      style={{
        maxHeight: 200,
        scrollbarWidth: "thin",
      }}
    >
      <AnimatePresence initial={false}>
        {visible.map((ev) => (
          <motion.div
            key={ev.id}
            layout
            initial={{ opacity: 0, x: -8, height: 0 }}
            animate={{ opacity: 1, x: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-start gap-2 py-0.5"
          >
            <span
              className="shrink-0 mt-[1px] inline-block w-1 h-1 rounded-full"
              style={{
                background: kindColor(ev.kind),
              }}
            />
            <span
              className="shrink-0 opacity-40 tabular-nums"
              style={{ minWidth: 36 }}
            >
              {formatAge(ev.ts)}
            </span>
            {typeof ev.step === "number" && (
              <span
                className="shrink-0 px-1 rounded text-[9px] font-semibold"
                style={{
                  background: "rgba(217, 70, 239, 0.12)",
                  color: "var(--color-accent)",
                }}
              >
                S{ev.step}
              </span>
            )}
            <span className="flex-1 min-w-0 truncate" title={ev.message}>
              {ev.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}

function kindColor(kind?: FeedEvent["kind"]): string {
  switch (kind) {
    case "step":
      return "#D946EF";
    case "cost":
      return "#F59E0B";
    case "cache":
      return "#10B981";
    case "error":
      return "#EF4444";
    case "sub":
    default:
      return "currentColor";
  }
}

/** ms since the event was created — shown as a tiny +N.Ns label */
function formatAge(ts: number): string {
  const age = (performance.now() - ts) / 1000;
  if (age < 60) return `+${age.toFixed(1)}s`;
  return `+${Math.floor(age / 60)}m`;
}
