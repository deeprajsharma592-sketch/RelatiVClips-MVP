"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage is a legitimate external-system sync
    setVisible(!window.localStorage.getItem("cookie-consent"));
  }, []);

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem("cookie-consent", "dismissed");
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
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[calc(100%-2rem)]"
        >
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: "rgba(255, 252, 242, 0.85)",
              backdropFilter: "blur(24px) saturate(200%)",
              WebkitBackdropFilter: "blur(24px) saturate(200%)",
              border: "1px solid rgba(255, 255, 255, 0.7)",
              boxShadow: "0 16px 48px rgba(140, 110, 60, 0.18), 0 1px 0 rgba(255, 255, 255, 0.6) inset",
            }}
          >
            <div
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "var(--gradient-sunset)" }}
            >
              <Cookie className="h-4 w-4 text-white" />
            </div>
            <p className="flex-1 text-[12px] leading-snug" style={{ color: "var(--color-text-secondary)" }}>
              <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>Heads up:</span> we use local storage for auth + preferences. No tracking, no third-party cookies.
            </p>
            <button
              onClick={accept}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-transform hover:scale-105"
              style={{
                background: "var(--gradient-sunset)",
                color: "#FFFFFF",
                boxShadow: "0 2px 8px rgba(217, 70, 239, 0.25)",
              }}
            >
              Got it
            </button>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ color: "var(--color-text-muted)", background: "rgba(60, 50, 30, 0.04)" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
