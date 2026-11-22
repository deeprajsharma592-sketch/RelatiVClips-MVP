"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertCircle,
  Shield,
} from "lucide-react";
import { signup, signInWithGoogle } from "@/lib/auth";
import { authPageHref, safeAuthDestination } from "@/lib/auth-destination";

function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = safeAuthDestination(search.get("next"));
  const destination = nextPath || "/dashboard";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // 1-Click Social Sign-In (Google)
  const handleGoogleSignIn = async () => {
    setSocialLoading("google");
    setSubmitError(null);

    try {
      await signInWithGoogle(destination);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Google sign-up is unavailable right now.");
      setSocialLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters long.");
      return;
    }
    if (!acceptedTerms) {
      setSubmitError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setBackendOffline(false);

    try {
      const result = await signup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: "creator",
        accept_tos: acceptedTerms,
        redirectTo: destination,
      });

      setSuccess(true);
      setNeedsVerification(Boolean(result.needsEmailVerification));
      if (!result.needsEmailVerification) {
        setTimeout(() => router.push(destination), 1000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setBackendOffline(true);
        setSubmitError("RelatiV could not connect to account services. Please retry in a moment.");
      } else {
        setSubmitError(msg || "Sign up could not be completed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-68px)] bg-[#F7F8FA] dark:bg-[#05060A] text-[#111318] dark:text-[#F3F4F6] flex flex-col justify-between selection:bg-cyan-500/20 selection:text-cyan-800 dark:selection:text-cyan-200">
      {/* Soft, faint ambient glow centered behind the form */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-indigo-500/[0.04] dark:bg-indigo-600/[0.06] rounded-full blur-[140px]" />

      {/* Main Centered Content */}
      <div className="relative z-10 w-full max-w-[460px] mx-auto px-5 sm:px-6 py-10 sm:py-14 flex-1 flex flex-col justify-center">
        {/* Centered Authentication Introduction */}
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl sm:text-[38px] text-zinc-950 dark:text-white tracking-tight leading-tight">
            Create your account.
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-2 font-sans">
            Start creating with RelatiV.
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

          {success ? (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-8 text-center space-y-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-zinc-950 dark:text-white font-display">
                {needsVerification ? "Check your email" : "Your account is ready"}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                {needsVerification
                  ? `We sent a confirmation link to ${email}. Verify your address to complete your registration.`
                  : "Opening your creator studio..."}
              </p>
              {needsVerification && (
                <div className="pt-2">
                  <Link
                    href={authPageHref("/login", nextPath)}
                    className="px-6 py-2.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-black font-semibold text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all inline-block"
                  >
                    Proceed to Sign in
                  </Link>
                </div>
              )}
            </motion.div>
          ) : (
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
                {submitError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="p-3.5 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/30 text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5"
                    role="alert"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p>{submitError}</p>
                      {backendOffline && (
                        <p className="mt-1 text-zinc-600 dark:text-white/60">
                          Account services are reconnecting. Please retry in a moment.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Registration Form */}
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Name Input */}
                <div>
                  <label
                    htmlFor="signup-name"
                    className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
                  >
                    Full name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    disabled={submitting}
                    autoComplete="name"
                    className="w-full h-12 bg-[#F0F2F6] dark:bg-[#131620] border border-black/10 dark:border-white/10 rounded-xl px-4 text-sm sm:text-base text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 font-sans focus:outline-none focus:border-black/30 dark:focus:border-white/30 focus:ring-1 focus:ring-black/10 dark:focus:ring-white/20 transition-all disabled:opacity-50"
                  />
                </div>

                {/* Email Input */}
                <div>
                  <label
                    htmlFor="signup-email"
                    className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@work.com"
                    disabled={submitting}
                    autoComplete="email"
                    className="w-full h-12 bg-[#F0F2F6] dark:bg-[#131620] border border-black/10 dark:border-white/10 rounded-xl px-4 text-sm sm:text-base text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 font-sans focus:outline-none focus:border-black/30 dark:focus:border-white/30 focus:ring-1 focus:ring-black/10 dark:focus:ring-white/20 transition-all disabled:opacity-50"
                  />
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="signup-password"
                      className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      Password
                    </label>
                    <span className="text-xs text-zinc-500 dark:text-zinc-500 font-sans">Min 8 characters</span>
                  </div>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={submitting}
                      autoComplete="new-password"
                      className="w-full h-12 bg-[#F0F2F6] dark:bg-[#131620] border border-black/10 dark:border-white/10 rounded-xl px-4 pr-11 text-sm sm:text-base text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 font-sans focus:outline-none focus:border-black/30 dark:focus:border-white/30 focus:ring-1 focus:ring-black/10 dark:focus:ring-white/20 transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Terms Acceptance */}
                <label className="flex items-start gap-2.5 text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    required
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 rounded border-black/20 dark:border-white/20 bg-zinc-100 dark:bg-[#131620] text-zinc-950 dark:text-white focus:ring-zinc-500/40 cursor-pointer"
                  />
                  <span className="leading-relaxed">
                    I agree to RelatiV&apos;s{" "}
                    <Link href="/terms" className="text-zinc-950 dark:text-white underline underline-offset-2 hover:opacity-80">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-zinc-950 dark:text-white underline underline-offset-2 hover:opacity-80">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>

                {/* Primary Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || socialLoading !== null}
                  className="w-full h-12 rounded-full bg-zinc-950 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-[#F4F6FA] font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base shadow-sm active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white dark:text-black" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <span>Create account</span>
                  )}
                </button>
              </form>

              {/* Switch to Sign In */}
              <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.06] text-center text-sm text-zinc-600 dark:text-zinc-400 font-sans">
                Already have an account?{" "}
                <Link
                  href={authPageHref("/login", nextPath)}
                  className="text-zinc-950 dark:text-white font-semibold hover:underline transition-colors"
                >
                  Sign in →
                </Link>
              </div>
            </div>
          )}
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

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-80px)] bg-[#05060A]" />}>
      <SignupForm />
    </Suspense>
  );
}
