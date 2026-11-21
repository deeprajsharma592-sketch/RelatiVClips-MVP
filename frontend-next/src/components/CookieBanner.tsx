"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";

const URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Show once per session (persists across page navs)
    const dismissed = sessionStorage.getItem("url-banner-dismissed");
    if (!dismissed) setVisible(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!URL_REGEX.test(url.trim())) {
      setError(true);
      setTimeout(() => setError(false), 1500);
      return;
    }
    setDone(true);
    sessionStorage.setItem("url-banner-dismissed", "1");
    setTimeout(() => {
      setVisible(false);
      router.push(`/process?url=${encodeURIComponent(url.trim())}`);
    }, 800);
  };

  const dismiss = () => {
    sessionStorage.setItem("url-banner-dismissed", "1");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", damping: 22, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
        >
          <div
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
            style={{
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(24px) saturate(200%)",
              WebkitBackdropFilter: "blur(24px) saturate(200%)",
              border: "1px solid rgba(255, 255, 255, 0.8)",
              boxShadow: "0 16px 48px rgba(59, 130, 246, 0.12), 0 1px 0 rgba(255, 255, 255, 0.6) inset",
            }}
          >
            <div
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)",
              }}
            >
              <Link2 className="h-4 w-4 text-white" />
            </div>
            <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
              <input
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(false); }}
                placeholder="Paste a YouTube link…"
                className="flex-1 text-[13px] outline-none bg-transparent"
                style={{
                  color: error ? "#F97316" : done ? "#10B981" : "var(--color-text-primary)",
                  transition: "color 0.2s",
                }}
                autoFocus
              />
              <button
                type="submit"
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105"
                style={{
                  background: done
                    ? "linear-gradient(135deg, #10B981, #06B6D4)"
                    : "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)",
                  color: "#FFFFFF",
                  boxShadow: done
                    ? "0 2px 8px rgba(16, 185, 129, 0.3)"
                    : "0 2px 8px rgba(59, 130, 246, 0.25)",
                  transition: "background 0.3s, box-shadow 0.3s",
                }}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
              </button>
            </form>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ color: "var(--color-text-muted)", background: "rgba(60, 50, 30, 0.04)" }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
