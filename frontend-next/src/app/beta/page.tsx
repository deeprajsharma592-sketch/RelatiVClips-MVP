import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Bug, MessageSquare, Gift, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Public Beta — RelatiV",
  description:
    "RelatiV is in public beta. Get early access, help shape the product, and earn lifetime Pro features in exchange for feedback.",
};

const PERKS = [
  {
    icon: Gift,
    title: "Free Pro for beta testers",
    body: "Every active beta user gets free Pro for the duration of the beta — and a discount after launch.",
  },
  {
    icon: Bug,
    title: "Direct line to the founders",
    body: "Bug? Feature request? DM us in Discord. We respond in < 24h during the beta window.",
  },
  {
    icon: CheckCircle2,
    title: "Vote on the roadmap",
    body: "Beta users get early access to the public roadmap and shape the next 3 months of features.",
  },
  {
    icon: MessageSquare,
    title: "Your name in the credits",
    body: "Beta contributors who give meaningful feedback get a 'Beta Builder' badge and credit in our launch post.",
  },
];

const STATUS = [
  { label: "Core clip engine", state: "stable" },
  { label: "Taste-based AI selection (LLM)", state: "beta" },
  { label: "Auto-captions + brand colors", state: "stable" },
  { label: "3-sided marketplace (creators, brands, clippers)", state: "beta" },
  { label: "Stripe payments + clipper payouts", state: "alpha" },
  { label: "Discord bot + view verification", state: "alpha" },
];

const STATE_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  stable: { bg: "rgba(16, 185, 129, 0.12)", fg: "#10B981", label: "Stable" },
  beta: { bg: "rgba(252, 211, 77, 0.12)", fg: "#FCD34D", label: "Beta" },
  alpha: { bg: "rgba(255, 119, 233, 0.12)", fg: "#FF77E9", label: "Alpha" },
};

export default function BetaPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 pt-20 pb-32">
      {/* Hero */}
      <div className="text-center mb-16">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider mb-6"
          style={{
            background: "linear-gradient(135deg, rgba(252, 211, 77, 0.18) 0%, rgba(255, 119, 233, 0.18) 100%)",
            border: "1px solid rgba(252, 211, 77, 0.35)",
            color: "var(--color-text-primary)",
            letterSpacing: "0.08em",
          }}
        >
          <Sparkles className="w-3 h-3" style={{ color: "#FCD34D" }} />
          Public Beta · v2.0.0
        </div>
        <h1
          className="font-display text-5xl md:text-6xl font-semibold tracking-tight mb-6"
          style={{ color: "var(--color-text-primary)" }}
        >
          Help us ship the<br />
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            best
          </span>{" "}
          clip engine
        </h1>
        <p
          className="text-lg max-w-2xl mx-auto leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          RelatiV is in active public beta. We&apos;re shipping fast and learning from
          real users — and we&apos;d love for you to be one of them. Every beta
          tester gets free Pro during the beta window.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            href="/signup"
            className="px-6 py-3 rounded-full text-sm font-medium transition-all"
            style={{
              background: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)",
              color: "#1A1814",
              boxShadow: "0 4px 12px rgba(252, 211, 77, 0.30)",
            }}
          >
            Start clipping free
          </Link>
          <Link
            href="https://discord.gg/relativ"
            className="px-6 py-3 rounded-full text-sm font-medium transition-all"
            style={{
              background: "var(--glass-light)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          >
            Join the Discord
          </Link>
        </div>
      </div>

      {/* Perks */}
      <section className="mb-20">
        <h2
          className="text-[11px] font-mono uppercase tracking-widest mb-6 text-center"
          style={{ color: "var(--color-text-muted)" }}
        >
          What you get
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {PERKS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="p-5 rounded-2xl"
                style={{
                  background: "var(--glass-light)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <Icon
                  className="w-5 h-5 mb-3"
                  style={{ color: "#FCD34D" }}
                />
                <h3
                  className="font-display text-lg font-semibold mb-1.5"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {p.title}
                </h3>
                <p
                  className="text-[14px] leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {p.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Status table */}
      <section>
        <h2
          className="text-[11px] font-mono uppercase tracking-widest mb-6 text-center"
          style={{ color: "var(--color-text-muted)" }}
        >
          What&apos;s in the beta
        </h2>
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--glass-light)",
            border: "1px solid var(--color-border)",
          }}
        >
          {STATUS.map((s, i) => {
            const st = STATE_STYLES[s.state];
            return (
              <div
                key={s.label}
                className="flex items-center justify-between px-5 py-3.5"
                style={{
                  borderTop:
                    i === 0 ? "none" : "1px solid var(--color-border)",
                }}
              >
                <span
                  className="text-[14px]"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {s.label}
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider"
                  style={{
                    background: st.bg,
                    color: st.fg,
                    letterSpacing: "0.08em",
                  }}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
        <p
          className="text-center text-[12px] mt-6"
          style={{ color: "var(--color-text-faint)" }}
        >
          Last updated 2026-06-15 · updates ship every Tuesday
        </p>
      </section>
    </main>
  );
}
