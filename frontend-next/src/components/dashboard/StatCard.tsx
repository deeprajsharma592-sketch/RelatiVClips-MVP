"use client";

/**
 * StatCard — single big-number dashboard widget.
 *
 * Variants:
 *  - default   → neutral surface
 *  - accent    → fuchsia ring + glow
 *  - violet    → purple ring + glow (clipper accent)
 *  - success   → green ring (positive delta)
 *  - warning   → gold ring (caution)
 *
 * Renders: label, big value, optional unit, optional delta (% or absolute),
 * and an optional sparkline. All props are static — no real data wiring.
 */

import { motion } from "framer-motion";

export interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: { value: string; positive?: boolean; label?: string };
  variant?: "default" | "accent" | "violet" | "success" | "warning";
  sparkline?: number[];
  icon?: string;
  caption?: string;
}

const RING = {
  default: "border-[color:var(--color-border)]",
  accent: "border-[color:var(--color-accent)]/40",
  violet: "border-[color:var(--color-accent-tertiary)]/40",
  success: "border-[color:var(--color-success)]/40",
  warning: "border-[color:var(--color-accent-secondary)]/40",
};

const GLOW = {
  default: "transparent",
  accent: "var(--color-glow-primary)",
  violet: "var(--color-glow-violet)",
  success: "transparent",
  warning: "transparent",
};

const VALUE_COLOR = {
  default: "text-text-primary",
  accent: "text-[color:var(--color-accent)]",
  violet: "text-[color:var(--color-accent-tertiary)]",
  success: "text-[color:var(--color-success)]",
  warning: "text-[color:var(--color-accent-secondary)]",
};

export default function StatCard({
  label,
  value,
  unit,
  delta,
  variant = "default",
  sparkline,
  icon,
  caption,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-[var(--radius-lg)] border ${RING[variant]} bg-[color:var(--color-surface)] p-5 group`}
      style={{ boxShadow: variant !== "default" ? `0 0 32px ${GLOW[variant]}` : undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-mono tracking-widest text-text-muted uppercase">
          {label}
        </div>
        {icon && <span className="text-text-faint text-sm">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <div className={`font-display font-bold text-3xl md:text-4xl tracking-tight ${VALUE_COLOR[variant]}`}>
          {value}
        </div>
        {unit && <div className="text-base text-text-muted font-sans">{unit}</div>}
      </div>
      {delta && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className={
              delta.positive
                ? "text-[color:var(--color-success)]"
                : "text-[color:var(--color-error)]"
            }
          >
            {delta.positive ? "▲" : "▼"} {delta.value}
          </span>
          {delta.label && <span className="text-text-muted">{delta.label}</span>}
        </div>
      )}
      {caption && (
        <div className="mt-2 text-xs text-text-faint">{caption}</div>
      )}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-4 flex items-end gap-0.5 h-8">
          {sparkline.map((v, i) => {
            const max = Math.max(...sparkline);
            const h = (v / max) * 100;
            return (
              <div
                key={i}
                className="flex-1 rounded-sm opacity-70 group-hover:opacity-100 transition-opacity"
                style={{
                  height: `${h}%`,
                  background:
                    variant === "accent"
                      ? "var(--color-accent)"
                      : variant === "violet"
                      ? "var(--color-accent-tertiary)"
                      : variant === "success"
                      ? "var(--color-success)"
                      : variant === "warning"
                      ? "var(--color-accent-secondary)"
                      : "var(--color-text-muted)",
                }}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
