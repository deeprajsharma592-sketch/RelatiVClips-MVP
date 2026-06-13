"use client";

/**
 * /account — the user's own profile view.
 *
 * Re-skinned in v5.1 to cream glass aesthetic. Available to any logged-in user.
 * Shows:
 *  - Role badge + role-specific profile fields
 *  - Account metadata (created, last login, etc.)
 *  - Logout button
 *  - Quick links to role-appropriate dashboards
 *
 * This is intentionally the "first stop" after signup. It does NOT
 * show private data — just what the user themselves can see.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, LogOut, Mail, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { ROLE_LABEL, type UserRole } from "@/lib/auth";
import { resendVerification } from "@/lib/api";

const ROLE_ACCENT: Record<UserRole, { color: string; bg: string; border: string; label: string; gradient: string }> = {
  creator: {
    color: "var(--color-accent)",
    bg: "rgba(217, 70, 239, 0.10)",
    border: "rgba(217, 70, 239, 0.45)",
    label: "Creator",
    gradient: "var(--gradient-sunset)",
  },
  brand: {
    color: "var(--color-accent)",
    bg: "rgba(217, 70, 239, 0.10)",
    border: "rgba(217, 70, 239, 0.45)",
    label: "D2C Brand",
    gradient: "var(--gradient-sunset)",
  },
  clipper: {
    color: "#8B5CF6",
    bg: "rgba(139, 92, 246, 0.10)",
    border: "rgba(139, 92, 246, 0.45)",
    label: "Paying Clipper",
    gradient: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
  },
};

const DASHBOARD_LINKS: Record<UserRole, { href: string; label: string }> = {
  creator: { href: "/creators/dashboard", label: "Creator dashboard" },
  brand: { href: "/brands/dashboard", label: "Brand dashboard" },
  clipper: { href: "/clippers/dashboard", label: "Clipper dashboard" },
};

export default function AccountPage() {
  const { user, loading, logout, refresh } = useAuth();
  const router = useRouter();
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendError, setResendError] = useState<string | null>(null);

  const handleResendVerification = async () => {
    setResendState("sending");
    setResendError(null);
    try {
      await resendVerification();
      setResendState("sent");
      // Auto-revert after 5s
      setTimeout(() => setResendState("idle"), 5000);
    } catch (e: any) {
      setResendError(e?.message || "Failed to send. Try again in a moment.");
      setResendState("error");
    }
  };

  if (loading) {
    return (
      <section className="relative min-h-[60vh] flex items-center justify-center pt-32 px-6">
        <div className="flex items-center gap-3" style={{ color: "var(--color-text-muted)" }}>
          <motion.div
            className="h-4 w-4 rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
          <span className="text-sm">Loading your account…</span>
        </div>
      </section>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") {
      router.push("/login");
    }
    return (
      <section className="relative min-h-[60vh] flex items-center justify-center pt-32 px-6">
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Redirecting to sign in…
        </div>
      </section>
    );
  }

  const role = ROLE_ACCENT[user.role];
  const dash = DASHBOARD_LINKS[user.role];
  const isClipper = user.role === "clipper";

  return (
    <section className="relative min-h-[80vh] overflow-hidden pt-32 pb-20 px-6">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 -right-20 h-[500px] w-[500px] rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${isClipper ? "rgba(139, 92, 246, 0.18)" : "rgba(217, 70, 239, 0.18)"} 0%, transparent 70%)` }}
        />
        <div
          className="absolute top-1/2 -left-20 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Section marker */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>01</span>
          <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
          <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Your account</span>
        </div>

        {/* Header card */}
        <div
          className="rounded-[var(--radius-xl)] p-8 mb-6 relative overflow-hidden"
          style={{
            background: "rgba(255, 252, 242, 0.70)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: `1px solid ${role.border}`,
            boxShadow: `0 0 0 1px ${role.border} inset, 0 16px 48px rgba(140, 110, 60, 0.08)`,
          }}
        >
          <div
            className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full blur-3xl pointer-events-none"
            style={{ background: `radial-gradient(circle, ${role.bg} 0%, transparent 70%)` }}
          />
          <div className="relative flex items-start gap-5">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center font-display font-semibold text-2xl text-white shrink-0"
              style={{
                background: role.gradient,
                boxShadow: `0 8px 24px ${isClipper ? "rgba(139, 92, 246, 0.30)" : "rgba(217, 70, 239, 0.30)"}`,
              }}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1
                  className="font-display font-semibold text-2xl md:text-3xl tracking-tight truncate"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {user.name}
                </h1>
                <span
                  className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border"
                  style={{ color: role.color, borderColor: role.border, background: role.bg }}
                >
                  {role.label}
                </span>
                {!user.is_verified && (
                  <span
                    className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(140, 110, 60, 0.10)",
                      color: "var(--color-text-muted)",
                      border: "1px solid rgba(60, 50, 30, 0.10)",
                    }}
                  >
                    Unverified
                  </span>
                )}
              </div>
              <div className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>{user.email}</div>
              <div className="mt-2 text-[10px] font-mono" style={{ color: "var(--color-text-faint)" }}>
                ID {user.id} · joined {new Date(user.created_at).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={logout}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-full transition-colors"
              style={{
                background: "rgba(255, 252, 242, 0.6)",
                border: "1px solid rgba(60, 50, 30, 0.10)",
                color: "var(--color-text-secondary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.40)";
                e.currentTarget.style.color = "var(--color-error)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(60, 50, 30, 0.10)";
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>

        {/* Unverified-email banner (v7 — tier 1.2) */}
        {!user.is_verified && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-start gap-3 p-4 rounded-2xl border"
            style={{
              background: "rgba(217, 70, 239, 0.05)",
              borderColor: "rgba(217, 70, 239, 0.20)",
            }}
          >
            <Mail
              className="h-5 w-5 mt-0.5 shrink-0"
              style={{ color: "var(--color-accent)" }}
            />
            <div className="flex-1 text-[13px]">
              <p className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Your email isn&apos;t verified yet.
              </p>
              <p className="mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                Some features are gated until you verify. We sent a link to{" "}
                <span className="font-mono">{user.email}</span> when you signed up.
              </p>
              {resendState === "sent" && (
                <p className="mt-1 text-[12px]" style={{ color: "var(--color-success)" }}>
                  Verification email sent. Check your inbox (and spam folder).
                </p>
              )}
              {resendState === "error" && resendError && (
                <p className="mt-1 text-[12px]" style={{ color: "var(--color-error)" }}>
                  {resendError}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendState === "sending" || resendState === "sent"}
                  className="text-[12px] font-semibold underline disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: "var(--color-accent)" }}
                >
                  {resendState === "sending"
                    ? "Sending…"
                    : resendState === "sent"
                    ? "Sent ✓"
                    : "Resend verification email →"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Two columns: profile + actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Profile data */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>02</span>
              <span className="h-px w-8" style={{ background: "var(--color-border-strong)" }} />
              <h2 className="font-display font-semibold text-[16px]" style={{ color: "var(--color-text-primary)" }}>Your profile</h2>
            </div>
            <div className="space-y-3">
              {Object.entries(user.profile).map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 text-[13px]">
                  <span
                    className="font-mono text-[10px] tracking-wider uppercase shrink-0"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {k}
                  </span>
                  <span
                    className="text-right break-all max-w-[60%]"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {formatValue(v)}
                  </span>
                </div>
              ))}
              {Object.keys(user.profile).length === 0 && (
                <p className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
                  No profile data yet.
                </p>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>03</span>
              <span className="h-px w-8" style={{ background: "var(--color-border-strong)" }} />
              <h2 className="font-display font-semibold text-[16px]" style={{ color: "var(--color-text-primary)" }}>Quick actions</h2>
            </div>
            <div className="space-y-3">
              <Link
                href={dash.href}
                className="btn-primary btn-shine w-full justify-center inline-flex text-[13px]"
                style={{ background: role.gradient, padding: "12px 24px" }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {dash.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/plans"
                className="btn-glass w-full justify-center inline-flex text-[13px]"
                style={{ padding: "11px 24px" }}
              >
                View plans
              </Link>
              <Link
                href="/"
                className="btn-ghost w-full justify-center inline-flex text-[13px]"
                style={{ padding: "11px 24px" }}
              >
                Back to home
              </Link>
            </div>
            <div
              className="mt-6 pt-4 text-[10px] font-mono"
              style={{ color: "var(--color-text-faint)", borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}
            >
              Last login: {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "—"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "string" && v.length === 0) return "—";
  return String(v);
}
