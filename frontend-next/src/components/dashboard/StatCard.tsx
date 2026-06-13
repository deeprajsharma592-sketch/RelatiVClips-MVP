"use client";

/**
 * StatCard — single big-number dashboard widget.
 *
 * Re-skinned in v5.1 to cream glass aesthetic. Shared by /brands/dashboard
 * and /clippers/dashboard. Uses inline styles for the new color tokens
 * since the older Tailwind-utility mappings don't apply to glass surfaces.
 *
 * Variants:
 *  - default   → neutral cream glass
 *  - accent    → fuchsia ring + glow (brand dashboards)
 *  - violet    → purple ring + glow (clipper dashboards)
 *  - success   → emerald ring (positive delta)
 *  - warning   → gold ring (caution)
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

const RING: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "rgba(60, 50, 30, 0.10)",
  accent:   "rgba(217, 70, 239, 0.45)",
  violet:   "rgba(139, 92, 246, 0.45)",
  success:  "rgba(16, 185, 129, 0.45)",
  warning:  "rgba(251, 191, 36, 0.45)",
};

const GLOW: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "transparent",
  accent:   "rgba(217, 70, 239, 0.30)",
  violet:   "rgba(139, 92, 246, 0.30)",
  success:  "rgba(16, 185, 129, 0.20)",
  warning:  "rgba(251, 191, 36, 0.25)",
};

const VALUE_COLOR: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "var(--color-text-primary)",
  accent:   "var(--color-accent)",
  violet:   "#8B5CF6",
  success:  "var(--color-success)",
  warning:  "#B45309",
};

const SPARK_COLOR: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "var(--color-text-muted)",
  accent:   "var(--color-accent)",
  violet:   "#8B5CF6",
  success:  "var(--color-success)",
  warning:  "#FBBF24",
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
    <div
      className="group relative overflow-hidden rounded-[var(--radius-lg)] p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: "rgba(255, 252, 242, 0.65)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: `1px solid ${RING[variant]}`,
        boxShadow:
          variant !== "default"
            ? `0 8px 24px rgba(140, 110, 60, 0.06), 0 0 24px ${GLOW[variant]}`
            : "0 8px 24px rgba(140, 110, 60, 0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="text-[10px] font-mono tracking-widest uppercase"
          style={{ color: "var(--color-text-muted)" }}
        >
          {label}
        </div>
        {icon && (
          <span className="text-[14px]" style={{ color: "var(--color-text-faint)" }}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <div
          className="font-display font-semibold text-3xl md:text-4xl tracking-tight tabular-nums"
          style={{ color: VALUE_COLOR[variant] }}
        >
          {value}
        </div>
        {unit && (
          <div className="text-base" style={{ color: "var(--color-text-muted)" }}>
            {unit}
          </div>
        )}
      </div>
      {delta && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className="font-mono"
            style={{ color: delta.positive ? "var(--color-success)" : "var(--color-error)" }}
          >
            {delta.positive ? "▲" : "▼"} {delta.value}
          </span>
          {delta.label && (
            <span style={{ color: "var(--color-text-muted)" }}>{delta.label}</span>
          )}
        </div>
      )}
      {caption && (
        <div className="mt-2 text-xs" style={{ color: "var(--color-text-faint)" }}>
          {caption}
        </div>
      )}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-4 flex items-end gap-0.5 h-8">
          {sparkline.map((v, i) => {
            const max = Math.max(...sparkline);
            const h = (v / max) * 100;
            return (
              <motion.div
                key={i}
                className="flex-1 rounded-sm opacity-70 group-hover:opacity-100 transition-opacity"
                style={{
                  height: `${h}%`,
                  background: SPARK_COLOR[variant],
                }}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
