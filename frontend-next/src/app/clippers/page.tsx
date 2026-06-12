"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import LiveTicker from "@/components/LiveTicker";
import CreatorStats from "@/components/CreatorStats";
import ClipperSection from "@/components/ClipperSection";

export default function ClippersPage() {
  return (
    <>
      {/* Hero — clipper section landing */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden pt-32 pb-16">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute top-0 left-1/3 h-[500px] w-[500px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.20) 0%, transparent 70%)" }}
          />
          <div
            className="absolute bottom-0 right-1/3 h-[400px] w-[400px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.18) 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
          {/* Section marker */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>01</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>For clippers</span>
          </div>

          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full text-[11px] font-medium"
            style={{
              background: "rgba(255, 252, 242, 0.7)",
              backdropFilter: "blur(12px) saturate(180%)",
              border: "1px solid rgba(255, 255, 255, 0.7)",
              color: "var(--color-text-secondary)",
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: "#10B981" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#10B981" }} />
            </span>
            <span className="font-mono tabular-nums">18,421</span> clippers active
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="font-display font-semibold tracking-tight max-w-5xl mx-auto"
            style={{ fontSize: "clamp(2.75rem, 6vw, 5.5rem)", lineHeight: 0.98 }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Short-form is a </span>
            <span className="hero-text text-gradient-sunset" style={{ fontSize: "1.1em" }}>creator economy.</span>
            <br />
            <span style={{ color: "var(--color-text-primary)" }}>Get paid to live in it.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-8 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            RelatiV clippers earn a living cutting hooks from the world&apos;s best shows. Apply once.
            Get matched. Keep 70% of every clip that lands. Payouts every Monday.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/clippers/apply"
              className="btn-primary btn-shine inline-flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Apply to clip
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#how-it-works"
              className="btn-ghost inline-flex items-center gap-2"
            >
              How it works
            </Link>
          </motion.div>
        </div>
      </section>

      <LiveTicker />
      <CreatorStats />
      <ClipperSection />

      {/* How it works */}
      <section id="how-it-works" className="relative w-full py-24 px-6 bg-[color:var(--color-bg-deep)] border-y border-[color:var(--color-border)]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display font-bold text-3xl md:text-5xl text-text-primary">
              How the clipper economy works
            </h2>
            <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto">
              From application to first payout in 14 days.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: "01", title: "Apply", body: "5-minute form. Show us 3 of your best clips. We review within 48 hours." },
              { step: "02", title: "Get matched", body: "We pair you with shows that match your style. Tech, comedy, sports, education — your call." },
              { step: "03", title: "Clip", body: "Use RelatiV to find the hooks. Render, caption, post. Submit your best 5 per show per week." },
              { step: "04", title: "Get paid", body: "70/30 split. Weekly payouts via Stripe, PayPal, or UPI. Average top clipper: $4,200/mo." },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative p-6 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
              >
                <div className="text-[10px] font-mono tracking-widest text-[color:var(--color-accent-tertiary)]">
                  STEP {s.step}
                </div>
                <h3 className="mt-2 font-display font-bold text-xl text-text-primary">{s.title}</h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">{s.body}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link
              href="/clippers/apply"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)] font-semibold rounded-full shadow-[0_0_32px_var(--color-glow-primary)] hover:scale-[1.02] transition-transform"
            >
              Start your application
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
