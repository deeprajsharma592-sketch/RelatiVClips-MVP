"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Download, Sparkles, X, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useState } from "react";

interface AuthExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessDownload: () => void;
  clipTitle?: string;
}

export default function AuthExportModal({
  isOpen,
  onClose,
  onSuccessDownload,
  clipTitle,
}: AuthExportModalProps) {
  const { loginAsDemo } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleAuth = () => {
    setLoading(true);
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (googleClientId) {
      const redirectUri = `${window.location.origin}/api/v1/auth/google/callback`;
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=openid%20email%20profile&access_type=offline`;
      window.location.href = googleAuthUrl;
      return;
    }

    setTimeout(() => {
      loginAsDemo("Creator", "creator@gmail.com", "creator");
      setLoading(false);
      onSuccessDownload();
      onClose();
    }, 500);
  };

  const handleGuestDownload = () => {
    loginAsDemo("Guest Creator", "guest@relativclips.com", "creator");
    onSuccessDownload();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0c0e17] p-6 sm:p-8 text-white shadow-2xl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon Badge */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5">
            <Download className="w-6 h-6 text-white" />
          </div>

          <h3 className="font-display font-bold text-2xl text-white tracking-tight">
            Your 9:16 clips are ready!
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
            Continue with Google to download in full 1080p HD and keep your clips saved in your 4-day temporary vault.
          </p>

          {clipTitle && (
            <div className="mt-4 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-slate-300 truncate">
              📹 {clipTitle}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {/* 1-Click Google OAuth */}
            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-medium text-sm text-slate-950 bg-white hover:bg-slate-100 active:scale-[0.99] transition-all shadow-md font-semibold"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Instant Guest Download Fallback */}
            <button
              onClick={handleGuestDownload}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-mono text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition-all"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Instant Download as Guest</span>
            </button>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>4-day secure temporary vault · No spam</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
