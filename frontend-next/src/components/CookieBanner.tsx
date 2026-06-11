"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CookieBanner() {
  // Hide on first paint (server + client first render), then check localStorage
  // after mount. The lazy-initializer approach causes an SSR/CSR element-exists
  // mismatch (server renders nothing, client renders a div) which
  // suppressHydrationWarning can't suppress — it only mutes text/attr diffs.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(!window.localStorage.getItem("cookie-consent"));
  }, []);

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4"
        >
          <div className="max-w-7xl mx-auto bg-[#0A0A0A] border border-border rounded-[4px] p-4 flex items-center justify-between gap-4 shadow-2xl">
            <p className="text-sm text-text-muted font-sans flex-1">
              This site uses local storage for functionality only. No third-party tracking cookies are used.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={decline}
                className="px-3 py-2 text-xs text-text-muted font-sans hover:text-white transition-colors"
              >
                Decline
              </button>
              <button
                onClick={accept}
                className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-[4px] font-sans"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
