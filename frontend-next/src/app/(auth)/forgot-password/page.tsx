"use client";

/**
 * /forgot-password — request a password-reset email.
 *
 * Flow:
 *   1. User enters email
 *   2. We POST to /api/v1/auth/forgot-password (always returns 200 to
 *      avoid email enumeration)
 *   3. We show a "check your inbox" success state
 *
 * The success state intentionally doesn't tell the user whether the email
 * actually exists in our system — that's the same response the backend
 * returns, and it matches the "Sign in" page's tone of "we don't leak
 * which accounts exist."
 */

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, KeyRound, Mail, Shield } from "lucide-react";
import { requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err: any) {
      // Network / 5xx errors only — the backend always returns 200 for
      // the "email doesn't exist" case to avoid enumeration.
      setError(err?.message || "Something went wrong. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-32 pb-16 px-4 sm:px-6 animate-page-enter"
      style={{ contain: "layout paint" }}
    >
      {/* Soft floating glass orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.28) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.24) 0%, transparent 70%)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-mono bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)]">
            1
          </div>
          <div className="w-8 h-px bg-[color:var(--color-border)]" />
          <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-mono bg-[color:var(--color-surface)] text-text-muted">
            2
          </div>
        </div>

        {!submitted ? (
          <motion.form
            onSubmit={onSubmit}
            noValidate
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="glass-panel p-7 space-y-5"
          >
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium mb-4"
                style={{
                  background: "rgba(255, 252, 242, 0.65)",
                  backdropFilter: "blur(12px) saturate(180%)",
                  WebkitBackdropFilter: "blur(12px) saturate(180%)",
                  border: "1px solid rgba(255, 255, 255, 0.7)",
                  color: "var(--color-text-secondary)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <KeyRound className="h-3 w-3" style={{ color: "var(--color-accent)" }} />
                <span className="tracking-wide">Reset password</span>
              </div>
              <h1 className="font-display font-semibold text-3xl md:text-4xl tracking-tight leading-[1.1] mt-2"
                style={{ color: "var(--color-text-primary)" }}
              >
                Forgot your password?
              </h1>
              <p className="mt-3 text-[14px]" style={{ color: "var(--color-text-secondary)" }}>
                Enter the email on your account. We&apos;ll send a link to set a new password — it expires in 1 hour.
              </p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block mb-2 text-[11px] font-medium uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: "var(--color-text-faint)" }}
                />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-glass"
                  style={{ paddingLeft: "40px" }}
                />
              </div>
            </div>

            {error && (
              <div
                className="px-4 py-3 rounded-2xl text-[13px]"
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "var(--color-error)",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !email}
              className="btn-primary btn-shine w-full justify-center flex items-center gap-2"
              style={{ paddingTop: "15px", paddingBottom: "15px" }}
            >
              {submitting ? (
                <span>Sending reset link…</span>
              ) : (
                <>
                  <span>Send reset link</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px]" style={{ color: "var(--color-text-faint)" }}>
              <Shield className="h-3 w-3" />
              <span>Reset links expire in 1 hour</span>
            </div>
          </motion.form>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-7 text-center space-y-4"
          >
            <div
              className="inline-flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
              }}
            >
              <Mail className="h-6 w-6" style={{ color: "var(--color-success)" }} />
            </div>
            <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text-primary)" }}>
              Check your inbox
            </h2>
            <p className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>
              If <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>{email}</span> is on a RelatiV account, a reset link is on its way. The link expires in 1 hour.
            </p>
            <p className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              Don&apos;t see it? Check your spam folder, or try again with a different email.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
                className="btn-secondary text-[13px]"
              >
                Try a different email
              </button>
            </div>
          </motion.div>
        )}

        <p className="mt-6 text-center text-[13px]" style={{ color: "var(--color-text-muted)" }}>
          <Link href="/login" className="inline-flex items-center gap-1.5 hover:underline">
            <ArrowLeft className="h-3 w-3" />
            Back to sign in
          </Link>
        </p>
      </motion.div>
    </section>
  );
}
