"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ThemeToggle — 3-way cycle (light → dark → system → light)
 * Sits in the header. Shows the current mode as an icon and label.
 * The morphing icon is animated with framer-motion (AnimatePresence).
 */
export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — next-themes needs a tick to know the system theme
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Skeleton while SSR-hydrating
    return (
      <div
        className="w-9 h-9 rounded-full"
        style={{ background: "var(--color-surface-2)" }}
        aria-hidden
      />
    );
  }

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  // Pick the right icon for the CURRENT mode (not the cycle step)
  const isDark = resolvedTheme === "dark";
  const Icon = theme === "system" ? Monitor : isDark ? Moon : Sun;
  const label = theme === "system" ? "System" : isDark ? "Dark" : "Light";

  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${label} — click to change`}
      title={`Theme: ${label} (click to cycle)`}
      className="
        relative w-9 h-9 rounded-full
        flex items-center justify-center
        border border-[var(--color-border-strong)]
        bg-[var(--color-surface)]
        hover:bg-[var(--color-surface-2)]
        hover:border-[var(--color-accent)]
        transition-all duration-200
        shadow-sm
      "
      style={{ color: "var(--color-text-secondary)" }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.18, ease: [0.34, 1.56, 0.64, 1] }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Icon size={15} strokeWidth={2.2} />
        </motion.span>
      </AnimatePresence>

      {/* Tiny dot indicator in the corner — gold = system mode */}
      {theme === "system" && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
          style={{ background: "var(--color-accent)", boxShadow: "0 0 4px var(--color-gold-glow)" }}
          aria-hidden
        />
      )}
    </button>
  );
}
