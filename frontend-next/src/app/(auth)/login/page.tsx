"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Sparkles, Shield } from "lucide-react";
import { login, type User } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";

/**
 * Where to send a freshly-authenticated user when no explicit `next` param
 * is provided. The login response carries the role; the signup flow does
 * the same but reads from the user object too.
 */
function roleDestination(user: User): string {
  switch (user.role) {
    case "brand":
      return "/brands/dashboard";
    case "clipper":
      return "/clippers/dashboard";
    case "creator":
      return "/creators/dashboard";
    default:
      return "/account";
  }
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = search.get("next") || "/account";
  const { loginAsDemo } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setSocialLoading("google");
    setError(null);

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
      const dest = nextPath && nextPath.startsWith("/") ? nextPath : "/process";
      router.push(dest);
    }, 600);
  };

  const handleDemoBypass = () => {
    loginAsDemo(email ? email.split("@")[0] : "Deepraj Sharma", email || "deepraj@relativclips.com", "creator");
    const dest = nextPath && nextPath.startsWith("/") ? nextPath : "/process";
    router.push(dest);
  };

  // Pre-fill from query param (e.g. ?email=foo@bar) for retry-UX
  useEffect(() => {
    const e = search.get("email");
    if (e) setEmail(e);
  }, [search]);

  // Live email validation
  useEffect(() => {
    if (!email) {
      setEmailValid(null);
      return;
    }
    setEmailValid(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  }, [email]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      if (!emailValid) {
        setError("Please enter a valid email address.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const result = await login({ email: email.trim().toLowerCase(), password });
        // Honour ?next= if it points to a real, safe path; otherwise route by role
        const dest = nextPath && nextPath.startsWith("/") ? nextPath : roleDestination(result.user);
        router.push(dest);
      } catch (err: any) {
        // Surface backend error verbatim if it's a string, otherwise generic
        const msg = err?.message || "Invalid email or password.";
        // Map common errors to user-friendly copy
        if (msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.toLowerCase().includes("fetch")) {
          setBackendOffline(true);
          setError("GPU backend worker is currently in standby mode.");
        } else if (msg.toLowerCase().includes("401") || msg.toLowerCase().includes("invalid")) {
          setError("Invalid email or password. Try again, or reset below.");
        } else if (msg.toLowerCase().includes("locked")) {
          setError("Account locked after too many attempts. Try again in 15 minutes.");
        } else {
          setError(msg);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, emailValid, submitting, nextPath, router]
  );

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-32 pb-16 px-4 sm:px-6 animate-page-enter" style={{ contain: "layout paint" }}>
      {/* Soft floating glass orbs in the background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(251, 113, 133, 0.30) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.28) 0%, transparent 70%)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Brand badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-6"
        >
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium"
            style={{
              background: "rgba(255, 252, 242, 0.65)",
              backdropFilter: "blur(12px) saturate(180%)",
              WebkitBackdropFilter: "blur(12px) saturate(180%)",
              border: "1px solid rgba(255, 255, 255, 0.7)",
              color: "var(--color-text-secondary)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <Sparkles className="h-3 w-3" style={{ color: "var(--color-accent)" }} />
            <span className="tracking-wide">Welcome back</span>
          </div>
        </motion.div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="font-display font-semibold text-4xl md:text-5xl tracking-tight leading-[1.05]" style={{ color: "var(--color-text-primary)" }}>
            Sign in to <span className="hero-text text-gradient-sunset">RelatiV</span>
          </h1>
          <p className="mt-3 text-[15px] max-w-sm mx-auto" style={{ color: "var(--color-text-secondary)" }}>
            Pick up where you left off — paste a URL, finish a campaign, or check your earnings.
          </p>
        </div>

        {/* Glass form card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="glass-panel p-7 space-y-5"
        >
          {/* Primary 1-Click Social Auth (Google) */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={socialLoading !== null || submitting}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 bg-white/70 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-white/10 active:scale-[0.99] border border-slate-200/80 dark:border-white/10 transition-all shadow-sm"
          >
            {socialLoading === "google" ? (
              <motion.span
                className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-blue-500"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
            ) : (
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
            )}
            <span>Continue with Google</span>
          </button>

          {/* Clean Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 dark:border-white/10 w-full" />
            <span className="px-3 text-[11px] font-mono text-slate-500 uppercase tracking-wider relative" style={{ background: "var(--color-bg-base, #fff)" }}>
              or sign in with email
            </span>
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block mb-2 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Email
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                placeholder="you@example.com"
                className="input-glass"
                style={{
                  paddingRight: emailValid === false ? "44px" : "16px",
                  borderColor:
                    emailValid === false
                      ? "var(--color-error)"
                      : focused === "email"
                      ? "var(--color-accent)"
                      : undefined,
                }}
              />
              <AnimatePresence>
                {emailValid === false && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center text-[12px] font-bold text-text-primary"
                    style={{ background: "var(--color-error)" }}
                  >
                    !
                  </motion.div>
                )}
                {emailValid === true && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center text-[12px] font-bold text-text-primary"
                    style={{ background: "var(--color-success)" }}
                  >
                    ✓
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] font-medium transition-colors"
                style={{ color: "var(--color-accent)" }}
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                className="input-glass"
                style={{ paddingRight: "48px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--color-text-muted)" }}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Error toast */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-2"
              >
                <div
                  className="px-4 py-3 rounded-2xl text-[13px] flex items-start gap-2"
                  style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    color: "var(--color-error)",
                  }}
                >
                  <span className="mt-0.5">⚠</span>
                  <div className="flex-1">
                    <p>{error}</p>
                    {backendOffline && (
                      <p className="mt-1 text-xs opacity-90">
                        You can explore the studio in Demo Sandbox mode without backend credentials.
                      </p>
                    )}
                  </div>
                </div>

                {backendOffline && (
                  <button
                    type="button"
                    onClick={handleDemoBypass}
                    className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-all shadow"
                  >
                    <span>⚡ Enter Studio in Demo Mode</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || socialLoading !== null}
            className="btn-primary btn-shine w-full justify-center flex items-center gap-2"
            style={{ paddingTop: "15px", paddingBottom: "15px" }}
          >
            {submitting ? (
              <>
                <motion.span
                  className="inline-block h-4 w-4 rounded-full border-2 border-border border-t-text-primary"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
                <span>Signing you in…</span>
              </>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {/* Security note */}
          <div className="flex items-center justify-center gap-1.5 text-[11px]" style={{ color: "var(--color-text-faint)" }}>
            <Shield className="h-3 w-3" />
            <span>Encrypted with bcrypt · 7-day JWT session</span>
          </div>
          </form>

          {/* Quick Demo Bypass */}
          <div className="pt-2 text-center border-t border-slate-200/50 dark:border-white/5">
            <button
              type="button"
              onClick={handleDemoBypass}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-mono transition-colors"
            >
              Skip sign in · Explore in Demo Mode →
            </button>
          </div>
        </motion.div>

        {/* Footer */}
        <p className="mt-6 text-center text-[13px]" style={{ color: "var(--color-text-muted)" }}>
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup${nextPath !== "/account" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            className="font-semibold transition-colors"
            style={{ color: "var(--color-accent)" }}
          >
            Create one
          </Link>
        </p>
      </motion.div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <LoginForm />
    </Suspense>
  );
}
