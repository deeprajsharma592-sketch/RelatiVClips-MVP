"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      router.push("/account");
    } catch (err: any) {
      setError(err?.message || "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden pt-32 pb-16 px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/3 h-[400px] w-[400px] rounded-full bg-[color:var(--color-glow-primary)] opacity-30 blur-[120px]" />
        <div className="absolute bottom-0 right-1/3 h-[300px] w-[300px] rounded-full bg-[color:var(--color-glow-violet)] opacity-25 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
            SIGN IN
          </span>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-text-primary tracking-tight mt-2">
            Welcome back.
          </h1>
          <p className="mt-2 text-text-secondary text-sm">
            Sign in to your creator, brand, or clipper account.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/80 backdrop-blur p-6 space-y-4"
        >
          <label className="block">
            <span className="block mb-2 text-xs font-mono tracking-wider text-text-muted uppercase">
              Email
            </span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[color:var(--color-bg-base)] border border-[color:var(--color-border)] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-[color:var(--color-accent)]"
            />
          </label>
          <label className="block">
            <span className="block mb-2 text-xs font-mono tracking-wider text-text-muted uppercase">
              Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[color:var(--color-bg-base)] border border-[color:var(--color-border)] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-[color:var(--color-accent)]"
            />
          </label>

          {error && (
            <div className="rounded-md border border-[color:var(--color-error)]/30 bg-[color:var(--color-error)]/10 px-3 py-2 text-sm text-[color:var(--color-error)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)] font-semibold rounded-full shadow-[0_0_24px_var(--color-glow-primary)] hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {submitting ? "Signing in…" : "Sign in →"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[color:var(--color-accent)] hover:underline">
            Create one
          </Link>
        </p>
      </motion.div>
    </section>
  );
}
