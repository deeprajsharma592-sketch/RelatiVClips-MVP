"use client";

/**
 * /account — the user's own profile view.
 *
 * Available to any logged-in user. Shows:
 *  - Role badge + role-specific profile fields
 *  - Account metadata (created, last login, etc.)
 *  - Logout button
 *  - Quick links to role-appropriate dashboards (when we wire them up)
 *
 * This is intentionally the "first stop" after signup. It does NOT
 * show private data — just what the user themselves can see.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { ROLE_LABEL, type UserRole } from "@/lib/auth";

const ROLE_ACCENT: Record<UserRole, { color: string; bg: string; border: string; glow: string; label: string }> = {
  creator: {
    color: "var(--color-accent)",
    bg: "var(--color-accent)/10",
    border: "var(--color-accent)/30",
    glow: "var(--color-glow-primary)",
    label: "Creator",
  },
  brand: {
    color: "var(--color-accent)",
    bg: "var(--color-accent)/10",
    border: "var(--color-accent)/30",
    glow: "var(--color-glow-primary)",
    label: "D2C Brand",
  },
  clipper: {
    color: "var(--color-accent-tertiary)",
    bg: "var(--color-accent-tertiary)/10",
    border: "var(--color-accent-tertiary)/30",
    glow: "var(--color-glow-violet)",
    label: "Paying Clipper",
  },
};

const DASHBOARD_LINKS: Record<UserRole, { href: string; label: string }> = {
  creator: { href: "/creators/dashboard", label: "Creator dashboard (preview)" },
  brand: { href: "/brands/dashboard", label: "Brand dashboard" },
  clipper: { href: "/clippers/dashboard", label: "Clipper dashboard" },
};

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <section className="relative min-h-[60vh] flex items-center justify-center pt-32 px-6">
        <div className="text-text-muted">Loading…</div>
      </section>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") {
      router.push("/login");
    }
    return (
      <section className="relative min-h-[60vh] flex items-center justify-center pt-32 px-6">
        <div className="text-text-muted">Redirecting to sign in…</div>
      </section>
    );
  }

  const role = ROLE_ACCENT[user.role];
  const dash = DASHBOARD_LINKS[user.role];

  return (
    <section className="relative min-h-[80vh] overflow-hidden pt-32 pb-16 px-6">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full opacity-25 blur-[140px]"
          style={{ background: role.color }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header card */}
        <div
          className="rounded-[var(--radius-lg)] border p-8 mb-6"
          style={{
            borderColor: role.border,
            background: `linear-gradient(180deg, ${role.bg}, var(--color-surface))`,
            boxShadow: `0 0 40px ${role.glow}`,
          }}
        >
          <div className="flex items-start gap-5">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center font-display font-bold text-2xl text-[color:var(--color-bg-base)]"
              style={{ background: role.color }}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-display font-bold text-2xl md:text-3xl text-text-primary truncate">
                  {user.name}
                </h1>
                <span
                  className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded-full border"
                  style={{ color: role.color, borderColor: role.border }}
                >
                  {role.label.toUpperCase()}
                </span>
                {!user.is_verified && (
                  <span className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded-full bg-[color:var(--color-text-faint)]/15 text-text-muted border border-[color:var(--color-border)]">
                    UNVERIFIED
                  </span>
                )}
              </div>
              <div className="text-sm text-text-secondary">{user.email}</div>
              <div className="mt-2 text-[10px] font-mono text-text-faint">
                ID {user.id} · joined {new Date(user.created_at).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={logout}
              className="shrink-0 px-4 py-2 text-sm font-medium border border-[color:var(--color-border-strong)] rounded-full text-text-secondary hover:text-text-primary hover:border-[color:var(--color-error)] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Two columns: profile + actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Profile data */}
          <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
            <h2 className="font-display font-semibold text-text-primary mb-4">Your profile</h2>
            <div className="space-y-3">
              {Object.entries(user.profile).map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-text-muted font-mono text-[10px] tracking-wider uppercase shrink-0">
                    {k}
                  </span>
                  <span className="text-text-primary text-right break-all max-w-[60%]">
                    {formatValue(v)}
                  </span>
                </div>
              ))}
              {Object.keys(user.profile).length === 0 && (
                <p className="text-sm text-text-muted">No profile data yet.</p>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
            <h2 className="font-display font-semibold text-text-primary mb-4">Quick actions</h2>
            <div className="space-y-3">
              <Link
                href={dash.href}
                className="block w-full py-3 px-4 text-sm font-semibold rounded-full text-[color:var(--color-bg-base)] text-center hover:scale-[1.01] transition-transform"
                style={{ background: role.color }}
              >
                {dash.label} →
              </Link>
              <Link
                href="/plans"
                className="block w-full py-3 px-4 text-sm font-medium border border-[color:var(--color-border-strong)] rounded-full text-text-primary text-center hover:border-[color:var(--color-accent)] transition-colors"
              >
                View plans
              </Link>
              <Link
                href="/"
                className="block w-full py-3 px-4 text-sm font-medium border border-[color:var(--color-border)] rounded-full text-text-secondary text-center hover:text-text-primary transition-colors"
              >
                Back to home
              </Link>
            </div>
            <div className="mt-6 pt-4 border-t border-[color:var(--color-border)] text-[10px] font-mono text-text-faint">
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
