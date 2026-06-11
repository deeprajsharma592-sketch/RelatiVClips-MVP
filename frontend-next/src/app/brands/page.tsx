"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const CAMPAIGN_TIERS = [
  {
    name: "Launch",
    price: "$2,400",
    cadence: "/ campaign",
    description: "One video, one platform, 30 days.",
    features: [
      "1 source video (up to 2h)",
      "30 platform-ready clips",
      "TikTok or Instagram Reels",
      "On-brand captions + titles",
      "5-day turnaround",
      "1 revision round",
    ],
    highlight: false,
  },
  {
    name: "Scale",
    price: "$6,800",
    cadence: "/ campaign",
    description: "Multi-platform, multi-show.",
    features: [
      "3 source videos (up to 2h each)",
      "120 platform-ready clips",
      "All platforms (TikTok, Reels, Shorts)",
      "Hook A/B/C variants",
      "Hashtag + posting schedule",
      "3-day turnaround",
      "Unlimited revisions",
    ],
    highlight: true,
  },
  {
    name: "Always-on",
    price: "Custom",
    cadence: "",
    description: "Dedicated clipper team for your shows.",
    features: [
      "Unlimited source videos",
      "Unlimited clips",
      "Dedicated team of 4–8 clippers",
      "Brand template library",
      "Weekly strategy call",
      "Analytics dashboard",
      "Same-day turnaround",
    ],
    highlight: false,
  },
];

const CASE_STUDIES = [
  {
    brand: "Spotify",
    metric: "12.4M",
    metricLabel: "organic views in 30 days",
    body: "Wrapped 2025 podcast clips across 4 shows. Averaged 180K views per clip.",
  },
  {
    brand: "Athletic Greens",
    metric: "8.2x",
    metricLabel: "ROAS on clipper campaign",
    body: "Replaced 2 agency retainers. Got 60 clips, paid for themselves in 11 days.",
  },
  {
    brand: "MasterClass",
    metric: "$0.18",
    metricLabel: "cost per view (CPV)",
    body: "Multi-instructor campaign. 14 shows, 200 clips, 22M views.",
  },
];

export default function BrandsPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden pt-32 pb-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 right-1/4 h-[400px] w-[400px] rounded-full bg-[color:var(--color-glow-coral)] opacity-40 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 h-[300px] w-[300px] rounded-full bg-[color:var(--color-glow-gold)] opacity-30 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted"
          >
            <span className="h-1 w-1 rounded-full bg-[color:var(--color-accent)]" />
            FOR BRANDS · CAMPAIGN-BASED CLIPPING
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="font-display font-bold tracking-tight text-[clamp(2.5rem,6vw,5rem)] leading-[1.0] max-w-4xl mx-auto"
          >
            <span className="block text-text-primary">Turn one video into</span>
            <span className="block bg-gradient-to-r from-[color:var(--color-accent)] via-[color:var(--color-gradient-magenta)] to-[color:var(--color-accent-secondary)] bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient">
              50 paid clips.
            </span>
            <span className="block text-text-primary">In 48 hours.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-8 text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
          >
            RelatiV brands get a dedicated clipper team, a brand-aware AI pipeline, and analytics
            that show you exactly which hooks land. CPM-based pricing. No retainers.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="#pricing"
              className="px-7 py-4 bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)] font-semibold rounded-full shadow-[0_0_32px_var(--color-glow-coral)] hover:scale-[1.02] transition-transform"
            >
              See campaign pricing
            </Link>
            <Link
              href="/contact"
              className="px-7 py-4 border border-[color:var(--color-border-strong)] text-text-primary font-semibold rounded-full hover:border-[color:var(--color-accent)] transition-colors"
            >
              Book a 15-min walkthrough
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Case studies */}
      <section className="relative w-full py-20 px-6 bg-[color:var(--color-bg-deep)] border-y border-[color:var(--color-border)]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
              PROOF
            </span>
            <h2 className="font-display font-bold text-3xl md:text-5xl text-text-primary tracking-tight">
              Real campaigns. Real numbers.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CASE_STUDIES.map((cs, i) => (
              <motion.div
                key={cs.brand}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
              >
                <div className="text-xs font-mono text-text-muted tracking-wider uppercase mb-4">
                  {cs.brand}
                </div>
                <div className="font-display text-5xl font-bold text-[color:var(--color-accent)]">
                  {cs.metric}
                </div>
                <div className="mt-1 text-sm text-text-secondary">{cs.metricLabel}</div>
                <p className="mt-4 text-sm text-text-muted leading-relaxed">{cs.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative w-full py-24 px-6 bg-[color:var(--color-bg-base)]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display font-bold text-4xl md:text-5xl text-text-primary tracking-tight">
              Campaign pricing
            </h2>
            <p className="mt-4 text-text-secondary max-w-2xl mx-auto">
              No retainers. No surprises. You pay per campaign, you own every clip.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {CAMPAIGN_TIERS.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-[var(--radius-lg)] p-8 ${
                  tier.highlight
                    ? "border-2 border-[color:var(--color-accent)] bg-gradient-to-b from-[color:var(--color-accent)]/10 to-[color:var(--color-surface)]"
                    : "border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)] text-[10px] font-mono font-bold rounded-full">
                    MOST BOOKED
                  </span>
                )}
                <p className="text-sm font-mono text-text-muted mb-2">{tier.name}</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-display font-bold text-text-primary">
                    {tier.price}
                  </span>
                  <span className="text-text-muted text-sm">{tier.cadence}</span>
                </div>
                <p className="text-sm text-text-secondary mb-6">{tier.description}</p>
                <Link
                  href="/contact"
                  className={`block text-center w-full py-3 rounded-full font-semibold text-sm transition-all ${
                    tier.highlight
                      ? "bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)] shadow-[0_0_24px_var(--color-glow-coral)] hover:scale-[1.02]"
                      : "bg-[color:var(--color-surface-2)] text-text-primary border border-[color:var(--color-border-strong)] hover:border-[color:var(--color-accent)]"
                  }`}
                >
                  {tier.name === "Always-on" ? "Talk to sales" : "Book this campaign"}
                </Link>
                <ul className="mt-6 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="text-[color:var(--color-accent)] mt-0.5">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-24 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[color:var(--color-glow-coral)] opacity-20 blur-3xl"
        />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display font-bold text-4xl md:text-5xl text-text-primary tracking-tight">
            Ready to launch a campaign?
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            15-min walkthrough. We&apos;ll show you exactly how a brand campaign flows through RelatiV
            and what kind of ROI to expect.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)] font-semibold rounded-full shadow-[0_0_32px_var(--color-glow-coral)] hover:scale-[1.02] transition-transform"
          >
            Book a 15-min walkthrough
            <span>→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
