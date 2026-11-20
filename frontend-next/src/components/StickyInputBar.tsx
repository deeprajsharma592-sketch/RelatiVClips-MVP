"use client";

/**
 * StickyConversionDock — OpusClip-style unobtrusive floating bottom dock
 * Replaces the buggy top bar that was covering section headings on scroll.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Video } from "lucide-react";
import SickLoadingTransition from "./SickLoadingTransition";

interface StickyInputBarProps {
  threshold?: number;
}

export default function StickyInputBar({ threshold = 500 }: StickyInputBarProps) {
  const router = useRouter();
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const isPast = latest > threshold;
    setVisible((prev) => (isPast !== prev ? isPast : prev));
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setIsSubmitting(true);
  };

  return (
    <>
      <AnimatePresence>
        {visible && !isSubmitting && (
          <motion.div
            key="sticky-conversion-dock"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 25 }}
            className="fixed bottom-6 inset-x-0 z-50 pointer-events-none flex justify-center px-4"
          >
            <div className="pointer-events-auto flex items-center gap-3 p-1.5 pl-4 rounded-xl border border-black/10 dark:border-white/20 bg-white/95 dark:bg-zinc-950/90 text-zinc-900 dark:text-white backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(255,255,255,0.08)] max-w-4xl w-full transition-colors">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-600 dark:text-zinc-300 whitespace-nowrap hidden sm:flex">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span>60 Mins Free</span>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube link to clip..."
                  className="w-full bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                  style={{ outline: "none", boxShadow: "none" }}
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-all duration-200 active:scale-95 shrink-0 cursor-pointer shadow-sm hover:shadow-md"
                >
                  <span>Clip now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SICK LOADING TRANSITION OVERLAY ── */}
      {isSubmitting && url && (
        <SickLoadingTransition
          url={url}
          autoRedirect={true}
        />
      )}
    </>
  );
}
