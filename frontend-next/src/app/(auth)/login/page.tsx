"use client";

import { useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Shield, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { login, signInWithGoogle, type User } from "@/lib/auth";
import { authPageHref, safeAuthDestination } from "@/lib/auth-destination";

/**
 * Routes user to their appropriate destination based on role or explicit `next` param.
 */
function roleDestination(user: User): string {
  switch (user.role) {
    case "brand":
      return "/brands/dashboard";
    case "clipper":
      return "/clippers/dashboard";
    case "creator":
      return "/dashboard";
    default:
      return "/account";
  }
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = safeAuthDestination(search.get("next"));

  const [email, setEmail] = useState(() => search.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailValid = email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : null;

  const handleGoogleSignIn = async () => {
    setSocialLoading("google");
    setError(null);

    try {
      await signInWithGoogle(nextPath || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in is unavailable right now.");
      setSocialLoading(null);
    }
  };

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
        const dest = nextPath || roleDestination(result.user);
        router.push(dest);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Invalid email or password.";
        if (msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.toLowerCase().includes("fetch")) {
          setBackendOffline(true);
          setError("RelatiV's account service is temporarily unavailable. Please try again shortly.");
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
    <div className="relative min-h-[calc(100vh-68px)] bg-[#F7F8FA] dark:bg-[#05060A] text-[#111318] dark:text-[#F3F4F6] flex flex-col justify-between selection:bg-cyan-500/20 selection:text-cyan-800 dark:selection:text-cyan-200">
      {/* Soft, faint ambient glow centered behind the form */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-indigo-500/[0.04] dark:bg-indigo-600/[0.06] rounded-full blur-[140px]" />

      {/* Main Centered Content */}
      <div className="relative z-10 w-full max-w-[460px] mx-auto px-5 sm:px-6 py-10 sm:py-14 flex-1 flex flex-col justify-center">
        {/* Centered Authentication Introduction */}
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl sm:text-[38px] text-zinc-950 dark:text-white tracking-tight leading-tight">
            Welcome back.
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-2 font-sans">
            Sign in to your RelatiV workspace.
          </p>
        </div>

        {/* Elevated Authentication Form Container */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl bg-white dark:bg-[#0D0F15] border border-black/[0.08] dark:border-white/[0.08] p-7 sm:p-9 shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
          {/* Subtle top edge illumination highlight */}
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/15 to-transparent rounded-t-3xl" />

          <div className="space-y-5">
            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={socialLoading !== null || submitting}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-medium text-sm text-zinc-800 dark:text-white bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.09] active:scale-[0.99] border border-black/[0.08] dark:border-white/[0.08] transition-all cursor-pointer disabled:opacity-50"
            >
              {socialLoading === "google" ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-600 dark:text-zinc-400" />
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
              <div className="border-t border-black/[0.08] dark:border-white/[0.08] w-full" />
              <span className="bg-white dark:bg-[#0D0F15] px-3 text-xs text-zinc-500 dark:text-zinc-500 font-sans relative">
                or continue with email
              </span>
            </div>

            {/* Error Notification */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="p-3.5 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/30 text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{error}</p>
                    {backendOffline && (
                      <p className="mt-1 text-zinc-600 dark:text-white/60">
                        Account services are currently reconnecting. Your saved projects remain safe.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email & Password Form */}
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              {/* Email Input */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@work.com"
                  disabled={submitting}
                  className="w-full h-12 bg-[#F0F2F6] dark:bg-[#131620] border border-black/10 dark:border-white/10 rounded-xl px-4 text-sm sm:text-base text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 font-sans focus:outline-none focus:border-black/30 dark:focus:border-white/30 focus:ring-1 focus:ring-black/10 dark:focus:ring-white/20 transition-all disabled:opacity-50"
                />
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={submitting}
                    className="w-full h-12 bg-[#F0F2F6] dark:bg-[#131620] border border-black/10 dark:border-white/10 rounded-xl px-4 pr-11 text-sm sm:text-base text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 font-sans focus:outline-none focus:border-black/30 dark:focus:border-white/30 focus:ring-1 focus:ring-black/10 dark:focus:ring-white/20 transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={submitting || socialLoading !== null}
                className="w-full h-12 rounded-full bg-zinc-950 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-[#F4F6FA] font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base shadow-sm active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white dark:text-black" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign in</span>
                )}
              </button>
            </form>

            {/* Switch to Sign Up */}
            <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.06] text-center text-sm text-zinc-600 dark:text-zinc-400 font-sans">
              Don&apos;t have an account?{" "}
              <Link
                href={authPageHref("/signup", nextPath === "/account" ? null : nextPath)}
                className="text-zinc-950 dark:text-white font-semibold hover:underline transition-colors"
              >
                Create one →
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Compact Auth-Specific Footer */}
      <footer className="relative z-10 w-full max-w-[460px] mx-auto px-6 py-6 text-center">
        <div className="flex items-center justify-center gap-4 text-xs text-zinc-500 dark:text-zinc-500 font-sans">
          <Link href="/privacy" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">
            Privacy
          </Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">
            Terms
          </Link>
          <span>·</span>
          <span>©RelatiV</span>
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-80px)] bg-[#05060A]" />}>
      <LoginForm />
    </Suspense>
  );
}
