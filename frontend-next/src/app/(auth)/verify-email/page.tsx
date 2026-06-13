"use client";

/**
 * /verify-email — confirm an email address using a token from the welcome email.
 *
 * Flow:
 *   1. User lands here from /verify-email?token=... in the welcome email
 *   2. On mount, we GET /api/v1/auth/verify-email?token=...
 *   3. Three states:
 *      - loading: "Verifying your email..."
 *      - success: "Email verified! You can close this tab." + link to /account
 *      - error: "Invalid or expired link" + link to /account (where they can resend)
 *
 * The token comes from the URL, not the form. If the user lands on this page
 * with no token, we show a "missing token" state.
 */

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Mail, RefreshCw } from "lucide-react";
import { verifyEmail } from "@/lib/api";

type VerifyState = "loading" | "success" | "error" | "no-token";

function VerifyEmailForm() {
  const search = useSearchParams();
  const token = search.get("token") || "";

  const [state, setState] = useState<VerifyState>(token ? "loading" : "no-token");
  const [message, setMessage] = useState<string>("Verifying your email…");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await verifyEmail(token);
        if (cancelled) return;
        setMessage(r.message || "Email verified.");
        setState("success");
      } catch (err: any) {
        if (cancelled) return;
        setMessage(err?.message || "Invalid or expired verification link.");
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="glass-panel p-7 text-center space-y-4">
      {/* Icon + state badge */}
      {state === "loading" && (
        <>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: "rgba(139, 92, 246, 0.10)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
            }}
          >
            <motion.span
              className="inline-block h-6 w-6 rounded-full border-2 border-violet-400/30 border-t-violet-500"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text-primary)" }}>
            Verifying your email
          </h2>
          <p className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>{message}</p>
        </>
      )}

      {state === "success" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
            }}
          >
            <CheckCircle2 className="h-7 w-7" style={{ color: "var(--color-success)" }} />
          </div>
          <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text-primary)" }}>
            Email verified
          </h2>
          <p className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>{message}</p>
          <p className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            You can close this tab and head back to RelatiV.
          </p>
          <Link href="/account" className="btn-primary btn-shine inline-flex">
            Go to my account
          </Link>
        </motion.div>
      )}

      {state === "error" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: "rgba(251, 113, 133, 0.10)",
              border: "1px solid rgba(251, 113, 133, 0.3)",
            }}
          >
            <AlertCircle className="h-7 w-7" style={{ color: "#FB7185" }} />
          </div>
          <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text-primary)" }}>
            Verification failed
          </h2>
          <p className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>{message}</p>
          <p className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            The link may have expired (24-hour limit) or already been used.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Link href="/account" className="btn-secondary text-[13px]">
              Go to my account
            </Link>
            <Link href="/account" className="btn-primary btn-shine text-[13px]">
              <RefreshCw className="h-3.5 w-3.5" />
              Resend verification
            </Link>
          </div>
        </motion.div>
      )}

      {state === "no-token" && (
        <div className="space-y-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: "rgba(139, 92, 246, 0.10)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
            }}
          >
            <Mail className="h-6 w-6" style={{ color: "#8B5CF6" }} />
          </div>
          <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text-primary)" }}>
            Check your email
          </h2>
          <p className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>
            Your verification link should be in your inbox. Click the button in the email to verify.
          </p>
          <Link href="/account" className="btn-secondary text-[13px]">
            Go to my account
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <section
      className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-32 pb-16 px-4 sm:px-6 animate-page-enter"
      style={{ contain: "layout paint" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.28) 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.24) 0%, transparent 70%)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <VerifyEmailForm />
        </Suspense>
      </motion.div>
    </section>
  );
}
