"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import ClipperLeaderboard from "@/components/ClipperLeaderboard";

type AdSlot = {
  id: string;
  badge: string;
  badgeHue: "coral" | "gold" | "violet" | "teal";
  title: string;
  body: string;
  cta: string;
  href: string;
  ctaStyle: "primary" | "secondary" | "ghost";
  meta?: string;
};

const AD_SLOTS: AdSlot[] = [
  {
    id: "brands",
    badge: "FOR BRANDS",
    badgeHue: "coral",
    title: "Run a campaign with 18,000+ clippers",
    body: "Drop your raw footage. Get 50+ on-brand, platform-ready clips in 48 hours. CPM-based pricing. Dedicated clipper team.",
    cta: "Launch a campaign",
    href: "/brands",
    ctaStyle: "primary",
    meta: "From $2,400 / campaign",
  },
  {
    id: "clippers",
    badge: "FOR CREATORS",
    badgeHue: "violet",
    title: "Become a RelatiV clipper. Get paid per clip.",
    body: "Apply once. Get matched with shows. Keep 70% of every clip that lands. Average top clipper earns $4,200 / month.",
    cta: "Apply to clip",
    href: "/clippers/apply",
    ctaStyle: "primary",
    meta: "Open intake · 2,400 applicants this month",
  },
  {
    id: "campaigns",
    badge: "LIVE CAMPAIGN",
    badgeHue: "gold",
    title: "Spotify Wrapped 2026 — sponsor opportunity",
    body: "We're packaging 100 short-form hooks for Spotify's biggest podcasters. One brand slot left for the November drop.",
    cta: "Reserve the slot",
    href: "/brands/spotify-wrapped",
    ctaStyle: "secondary",
    meta: "1 of 4 slots remaining",
  },
];

const HUE_BADGE_BG: Record<AdSlot["badgeHue"], string> = {
  coral: "bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)] border-[color:var(--color-accent)]/30",
  gold: "bg-[color:var(--color-accent-secondary)]/15 text-[color:var(--color-accent-secondary)] border-[color:var(--color-accent-secondary)]/30",
  violet: "bg-[color:var(--color-accent-tertiary)]/15 text-[color:var(--color-accent-tertiary)] border-[color:var(--color-accent-tertiary)]/30",
  teal: "bg-[color:var(--color-accent-quaternary)]/15 text-[color:var(--color-accent-quaternary)] border-[color:var(--color-accent-tertiary)]/30",
};

const CTA_CLASSES: Record<AdSlot["ctaStyle"], string> = {
  primary:
    "bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)] hover:bg-[color:var(--color-accent-hover)] shadow-[0_0_24px_var(--color-glow-primary)]",
  secondary:
    "bg-[color:var(--color-surface-2)] text-text-primary border border-[color:var(--color-border-strong)] hover:border-[color:var(--color-accent)]",
  ghost:
    "text-text-primary hover:text-[color:var(--color-accent)]",
};

export default function ClipperSection() {
  return (
    <section className="relative w-full py-24 px-6 bg-[color:var(--color-bg-base)] overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-[color:var(--color-glow-violet)] opacity-30 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-[500px] w-[500px] rounded-full bg-[color:var(--color-glow-primary)] opacity-25 blur-[120px]" />

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
            <span className="h-1 w-1 rounded-full bg-[color:var(--color-accent-tertiary)]" />
            THE CLIPPER ECONOMY
          </span>
          <h2 className="font-display font-bold text-4xl md:text-6xl text-text-primary tracking-tight max-w-4xl mx-auto leading-[1.05]">
            Hire a clipper.
            <br />
            <span className="bg-gradient-to-r from-[color:var(--color-accent-tertiary)] via-[color:var(--color-gradient-magenta)] to-[color:var(--color-accent)] bg-clip-text text-transparent">
              Or become one.
            </span>
          </h2>
          <p className="mt-6 text-lg text-text-secondary max-w-2xl mx-auto font-sans leading-relaxed">
            The RelatiV clipper network is the world&apos;s first marketplace for short-form video talent.
            Brands post campaigns. Clippers compete. Viewers win.
          </p>
        </motion.div>

        {/* AD SLOTS — 3 cards: Brands / Creators / Live Campaign */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20">
          {AD_SLOTS.map((slot, i) => (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-gradient-to-br from-[color:var(--color-surface)] to-[color:var(--color-surface-2)] p-6 transition-all hover:border-[color:var(--color-border-strong)]"
            >
              {/* Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold tracking-widest border ${HUE_BADGE_BG[slot.badgeHue]}`}
              >
                {slot.badge}
              </span>

              {/* Title + body */}
              <h3 className="mt-4 font-display font-bold text-xl text-text-primary leading-tight">
                {slot.title}
              </h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">{slot.body}</p>

              {/* Meta */}
              {slot.meta && (
                <div className="mt-4 text-xs font-mono text-text-muted">{slot.meta}</div>
              )}

              {/* CTA */}
              <div className="mt-6 flex items-center gap-3">
                <Link
                  href={slot.href}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${CTA_CLASSES[slot.ctaStyle]}`}
                >
                  {slot.cta}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>

              {/* Hover glow */}
              <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-[color:var(--color-glow-primary)] opacity-0 group-hover:opacity-30 blur-3xl transition-opacity duration-500" />
            </motion.div>
          ))}
        </div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-10 flex items-end justify-between flex-wrap gap-4"
        >
          <div>
            <h3 className="font-display font-bold text-2xl md:text-3xl text-text-primary">
              Top clippers this month
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              The 6 highest-earning creators on RelatiV. Updated daily.
            </p>
          </div>
          <Link
            href="/clippers"
            className="text-sm font-mono text-text-muted hover:text-[color:var(--color-accent)] transition-colors flex items-center gap-1"
          >
            See full leaderboard
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </motion.div>

        <ClipperLeaderboard />

        {/* Bottom dual CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Link
            href="/clippers/apply"
            className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-accent-tertiary)]/30 bg-[color:var(--color-surface)] p-8 transition-all hover:border-[color:var(--color-accent-tertiary)]/60"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-[10px] font-mono tracking-widest text-[color:var(--color-accent-tertiary)] mb-2">
                  FOR CREATORS
                </div>
                <h3 className="font-display font-bold text-2xl text-text-primary leading-tight">
                  I want to clip
                </h3>
                <p className="mt-2 text-sm text-text-secondary max-w-md">
                  Join 18,000+ creators earning from short-form. Apply once, get matched with shows, keep 70% of every clip.
                </p>
              </div>
              <div className="shrink-0 h-12 w-12 rounded-full bg-[color:var(--color-accent-tertiary)]/15 border border-[color:var(--color-accent-tertiary)]/30 flex items-center justify-center text-[color:var(--color-accent-tertiary)] text-xl group-hover:scale-110 transition-transform">
                →
              </div>
            </div>
          </Link>

          <Link
            href="/brands"
            className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-accent)]/30 bg-[color:var(--color-surface)] p-8 transition-all hover:border-[color:var(--color-accent)]/60"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-[10px] font-mono tracking-widest text-[color:var(--color-accent)] mb-2">
                  FOR BRANDS
                </div>
                <h3 className="font-display font-bold text-2xl text-text-primary leading-tight">
                  I want to hire clippers
                </h3>
                <p className="mt-2 text-sm text-text-secondary max-w-md">
                  Launch a campaign. Get 50+ on-brand, platform-ready clips in 48 hours. CPM-based. Dedicated team.
                </p>
              </div>
              <div className="shrink-0 h-12 w-12 rounded-full bg-[color:var(--color-accent)]/15 border border-[color:var(--color-accent)]/30 flex items-center justify-center text-[color:var(--color-accent)] text-xl group-hover:scale-110 transition-transform">
                →
              </div>
            </div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
