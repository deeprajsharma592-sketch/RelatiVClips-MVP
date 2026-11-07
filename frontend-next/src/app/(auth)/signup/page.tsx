"use client";

/**
 * /signup — Streamlined, frictionless 1-step signup
 * No roadblocks, no 8-field interrogation.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { signup, type UserRole } from "@/lib/auth";

const CONTENT_TYPES = [
  { id: "podcasts", label: "🎙️ Podcasts" },
  { id: "talking_head", label: "🗣️ Talking Head / Advice" },
  { id: "education", label: "📚 Education & Tech" },
  { id: "gaming", label: "🎮 Gaming & Live Streams" },
  { id: "brand", label: "🛍️ Brand & E-Commerce" },
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedType, setSelectedType] = useState("podcasts");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters long.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const role: UserRole = selectedType === "brand" ? "brand" : "creator";
      await signup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        specialty: selectedType,
        accept_tos: true,
      });

      setSuccess(true);
      setTimeout(() => {
        router.push("/process");
      }, 1000);
    } catch (err: any) {
      setSubmitError(err?.message || "Sign up failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden pt-28 pb-16 px-4 sm:px-6">
      {/* Background ambient light */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[450px] w-[500px] rounded-full bg-blue-500/10 blur-[140px]" />
        <div className="absolute bottom-10 right-1/4 h-[300px] w-[350px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        <div
          className="rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-2xl transition-all"
          style={{
            background: "var(--glass-light-strong)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.7)",
          }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-medium mb-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Sparkles className="w-3 h-3" />
              Instant Free Access
            </span>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
              Create your account
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Turn long videos into viral 9:16 vertical clips in seconds.
            </p>
          </div>

          {success ? (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-12 text-center space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Account Created!</h2>
              <p className="text-xs text-slate-500">Redirecting you to the studio...</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Deepraj Sharma"
                  disabled={submitting}
                  className="w-full rounded-xl px-4 py-3 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="deepraj@example.com"
                  disabled={submitting}
                  className="w-full rounded-xl px-4 py-3 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  disabled={submitting}
                  className="w-full rounded-xl px-4 py-3 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Content Type Pill Picker */}
              <div className="pt-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  What do you primarily create?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CONTENT_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSelectedType(type.id)}
                      className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                        selectedType === type.id
                          ? "bg-blue-600 text-white font-medium shadow-sm shadow-blue-500/30"
                          : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/5"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl py-3.5 px-6 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:opacity-95 shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Start Clipping Free</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>No credit card required. Free during beta.</span>
              </div>
            </form>
          )}

          {/* Footer link */}
          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-100 dark:border-white/5">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
