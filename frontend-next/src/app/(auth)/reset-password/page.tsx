"use client";

/**
 * /reset-password — accept a password-reset token + set a new password.
 *
 * Flow:
 *   1. The user landed here from the link in the reset email:
 *      /reset-password?token=...
 *   2. We show a password + confirm-password form
 *   3. On submit, POST to /api/v1/auth/reset-password with the token + new password
 *   4. Success → "Password updated. Sign in now." with link to /login
 *   5. Error (bad/expired token) → link back to /forgot-password
 *
 * The token comes from the URL — the form does not have a token field. If
 * the user lands on this page with no token, we redirect to /forgot-password.
 */

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Shield } from "lucide-react";
import { resetPassword } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Token missing → friendly empty state with link back
  if (!token) {
    return (
      <div className="glass-panel p-7 text-center space-y-4">
        <div
          className="inline-flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: "rgba(251, 113, 133, 0.10)",
            border: "1px solid rgba(251, 113, 133, 0.3)",
          }}
        >
          <KeyRound className="h-6 w-6" style={{ color: "#FB7185" }} />
        </div>
        <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text-primary)" }}>
          Missing reset link
        </h2>
        <p className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>
          This page needs the reset link from your email. We didn&apos;t find a token in the URL.
        </p>
        <Link href="/forgot-password" className="btn-primary btn-shine inline-flex">
          Request a new reset link
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
      // Auto-redirect to /login after 2s
      setTimeout(() => router.push("/login?reset=success"), 2000);
    } catch (err: any) {
      setError(err?.message || "Reset failed. The link may have expired — try requesting a new one.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
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
          <KeyRound className="h-6 w-6" style={{ color: "var(--color-success)" }} />
        </div>
        <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text-primary)" }}>
          Password updated
        </h2>
        <p className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>
          You can now sign in with your new password. Redirecting to the sign-in page…
        </p>
        <Link href="/login?reset=success" className="btn-primary btn-shine inline-flex">
          Go to sign in
          <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      noValidate
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
      className="glass-panel p-7 space-y-5"
    >
      <div className="text-center">
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium mb-4"
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
          <span className="tracking-wide">Set a new password</span>
        </div>
        <h1 className="font-display font-semibold text-3xl md:text-4xl tracking-tight leading-[1.1] mt-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          Choose a new password
        </h1>
        <p className="mt-3 text-[14px]" style={{ color: "var(--color-text-secondary)" }}>
          Enter a new password for your RelatiV account. At least 8 characters.
        </p>
      </div>

      <div>
        <label htmlFor="password" className="block mb-2 text-[11px] font-medium uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          New password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input-glass"
            style={{ paddingRight: "48px" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ color: "var(--color-text-muted)" }}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="confirm" className="block mb-2 text-[11px] font-medium uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          Confirm new password
        </label>
        <input
          id="confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="input-glass"
        />
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
        disabled={submitting || !password || !confirm}
        className="btn-primary btn-shine w-full justify-center flex items-center gap-2"
        style={{ paddingTop: "15px", paddingBottom: "15px" }}
      >
        {submitting ? (
          <span>Updating password…</span>
        ) : (
          <>
            <span>Update password</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-1.5 text-[11px]" style={{ color: "var(--color-text-faint)" }}>
        <Shield className="h-3 w-3" />
        <span>Encrypted with bcrypt</span>
      </div>
    </motion.form>
  );
}

export default function ResetPasswordPage() {
  return (
    <section
      className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-32 pb-16 px-4 sm:px-6 animate-page-enter"
      style={{ contain: "layout paint" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(251, 113, 133, 0.28) 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.24) 0%, transparent 70%)" }} />
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
          <div className="w-8 h-px bg-[color:var(--color-accent)]" />
          <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-mono bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)]">
            2
          </div>
        </div>

        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <ResetPasswordForm />
        </Suspense>

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
