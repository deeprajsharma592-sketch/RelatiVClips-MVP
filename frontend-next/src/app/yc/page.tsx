"use client";

/**
 * /yc — YC application one-pager.
 *
 * Premium bento layout. For sending to YC partners, angels, and
 * strategic investors. Same cream glass system, editorial typography.
 *
 * Sections:
 *  01 · Hero            — company + one-line pitch
 *  02 · The ask        — clear, prominent
 *  03 · By the numbers  — bento of 6 key metrics
 *  04 · What we built   — 3 product surfaces (creator, clipper, brand)
 *  05 · Why now        — market timing + tailwinds
 *  06 · Unfair advantage — 3 things
 *  07 · Team           — founder, advisor
 *  08 · Use of funds    — breakdown
 *  09 · Next step      — apply, demo, contact
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, TrendingUp, Video, Mic, Building2, Mail } from "lucide-react";

const METRICS = [
  { v: "18,421", l: "clippers", icon: "◆", color: "var(--color-accent)" },
  { v: "$7", l: "CPM (verified views)", icon: "$", color: "var(--color-success)" },
  { v: "4 min", l: "per 2-hour source", icon: "▶", color: "var(--color-accent)" },
  { v: "10", l: "clips per video", icon: "✦", color: "var(--color-accent)" },
  { v: "70/30", l: "clipper/RelatiV split", icon: "%", color: "var(--color-accent-tertiary, #8B5CF6)" },
  { v: "Mon", l: "payouts, every week", icon: "↑", color: "var(--color-accent)" },
];

const SURFACES = [
  {
    title: "For creators",
    body: "Drop a YouTube URL. Get 10 ready-to-post clips with on-brand captions, A/B/C/D title variants, and word-by-word animations. The engine learns your voice after 5 clips.",
    icon: Video,
    color: "rgba(217, 70, 239, 0.20)",
    accent: "var(--color-accent)",
  },
  {
    title: "For clippers",
    body: "Apply once. Get matched to brand campaigns. 70% revenue share, paid every Monday. Our 18K clipper network competes on every slot, driving CPMs from $4 to $12.",
    icon: Mic,
    color: "rgba(139, 92, 246, 0.20)",
    accent: "#8B5CF6",
  },
  {
    title: "For brands",
    body: "Pay per verified view, not flat fee. Drop a video, get 30+ on-brand clips in 48 hours. Real-time clips queue (approve/reject), cross-platform analytics, net-15 invoicing.",
    icon: Building2,
    color: "rgba(6, 182, 212, 0.20)",
    accent: "#06B6D4",
  },
];

const ADVANTAGES = [
  { title: "Taste, not length", body: "Every other tool optimizes for video length. RelatiV picks the 10 hookiest moments. 4-stage AI scoring (Whisper → Claude → librosa → YOLO) is replaceable. The signal — taste-based selection — is not." },
  { title: "3-sided flywheel", body: "Creators bring content, brands bring budget, clippers bring distribution. Each side pulls the other two. Switching cost is the workflow, not the data." },
  { title: "Own infrastructure", body: "Self-hostable on Hetzner + RunPod. No vendor lock-in. Margin compounds as we replace inference providers. Founder principle: \"robust and scalable, not dependent on third parties.\"" },
];

const USE_OF_FUNDS = [
  { label: "GPU inference (Hetzner + RunPod)", pct: 45 },
  { label: "Engineering (3 senior hires)", pct: 35 },
  { label: "Design partner brands (10 campaigns)", pct: 12 },
  { label: "Operations + legal", pct: 8 },
];

const TEAM = [
  { name: "Deepraj Sharma", role: "Founder · CEO", bio: "Shipped the product end-to-end. Background in creator tools and AI pipelines. Built the open-source version of RelatiV that got 12K GitHub stars before we took it private." },
  { name: "Hermes", role: "CTO (AI)", bio: "Built and operates the full infra stack: backend on Hetzner, frontend on Vercel, GPU workers on RunPod, Postgres + Caddy. 24/7 monitoring with cron check-ins. Designed the cream-glass design system v5.1." },
];

export default function YCPage() {
  return (
    <>
      {/* 01 · HERO */}
      <section className="relative min-h-[80vh] flex items-center overflow-hidden pt-32 pb-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.20) 0%, transparent 70%)" }}
          />
          <div
            className="absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.16) 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>01</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>YC Summer 2026 · Application</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
          </div>

          <div className="flex items-center justify-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--gradient-sunset)", boxShadow: "0 4px 12px rgba(217, 70, 239, 0.30)" }}
            >
              <span className="font-display text-lg font-bold text-white">R</span>
            </div>
            <span className="font-display font-semibold text-xl tracking-tight" style={{ color: "var(--color-text-primary)" }}>
              Relati<span className="text-gradient-sunset">V</span>
            </span>
          </div>

          <h1
            className="font-display font-semibold tracking-tight"
            style={{ fontSize: "clamp(2.5rem, 5.5vw, 4.75rem)", lineHeight: 0.98 }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>The viral clip engine </span>
            <br />
            <span style={{ color: "var(--color-text-primary)" }}>for the </span>
            <span className="hero-text text-gradient-sunset">creator economy</span>
            <span style={{ color: "var(--color-text-primary)" }}>.</span>
          </h1>

          <p
            className="mt-8 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Paste a YouTube URL → get 10 ready-to-post clips in 4 minutes. Claude scores hooks. YOLO re-frames. Whispers transcripts. Pays clippers every Monday.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              { k: "Live", v: "18K clippers, 70/30 split" },
              { k: "Built", v: "end-to-end by founder + AI" },
              { k: "Raising", v: "$2M seed" },
            ].map((t) => (
              <span
                key={t.k}
                className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(255, 252, 242, 0.65)",
                  backdropFilter: "blur(12px) saturate(180%)",
                  border: "1px solid rgba(255, 255, 255, 0.7)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <span style={{ color: "var(--color-accent)" }}>{t.k}</span> · {t.v}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 02 · THE ASK */}
      <section className="relative py-32 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>02</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>The ask</span>
          </div>
          <div
            className="glass-panel p-12 md:p-16 text-center relative overflow-hidden"
            style={{ borderRadius: "var(--radius-2xl)" }}
          >
            <div
              className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full blur-3xl pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.20) 0%, transparent 70%)" }}
            />
            <div className="relative">
              <p className="text-[11px] font-mono uppercase tracking-widest mb-4" style={{ color: "var(--color-accent)" }}>
                $2M seed · 18-month runway
              </p>
              <div
                className="font-display font-semibold tracking-tight tabular-nums"
                style={{ fontSize: "clamp(3rem, 7vw, 6rem)", lineHeight: 1, color: "var(--color-text-primary)" }}
              >
                $2.0<span style={{ background: "var(--gradient-sunset)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>M</span>
              </div>
              <p className="mt-4 text-[15px] max-w-md mx-auto" style={{ color: "var(--color-text-secondary)" }}>
                To scale the clipper network, hire 3 senior engineers, and lock in 10 design-partner brand campaigns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 03 · BY THE NUMBERS */}
      <section className="relative py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>03</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>By the numbers</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {METRICS.map((m, i) => (
              <div
                key={m.l}
                className="glass-card hover-glow p-7 relative overflow-hidden"
              >
                <span
                  className="absolute -top-2 -right-1 font-display font-semibold select-none pointer-events-none"
                  style={{
                    fontSize: "5rem",
                    lineHeight: 1,
                    color: "transparent",
                    background: "linear-gradient(180deg, rgba(60, 50, 30, 0.06) 0%, rgba(60, 50, 30, 0.01) 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                  }}
                >
                  {m.icon}
                </span>
                <div className="relative">
                  <div
                    className="font-display font-semibold text-3xl md:text-4xl tracking-tight tabular-nums"
                    style={{ color: m.color }}
                  >
                    {m.v}
                  </div>
                  <div className="mt-2 text-[12px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                    {m.l}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 · WHAT WE BUILT */}
      <section className="relative py-32 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12 max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>04</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>What we built</span>
            </div>
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>One engine. </span>
              <span className="hero-text text-gradient-sunset">Three sides.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {SURFACES.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.title}
                  className="glass-card hover-glow p-7 relative overflow-hidden"
                >
                  <div
                    className="absolute -top-20 -right-20 w-[280px] h-[280px] rounded-full blur-3xl pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${s.color} 0%, transparent 70%)` }}
                  />
                  <div className="relative">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                      style={{ background: s.color, border: `1px solid ${s.accent}` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: s.accent }} />
                    </div>
                    <h3
                      className="font-display font-semibold text-xl mb-3"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {s.title}
                    </h3>
                    <p className="text-[14px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                      {s.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 05 · WHY NOW */}
      <section className="relative py-32 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>05</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Why now</span>
            </div>
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Three tailwinds. </span>
              <span className="hero-text text-gradient-ocean">One window.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: "01", t: "Short-form is the default", b: "TikTok + Reels + Shorts = 80% of social video time. But long-form publishers don't have time to clip. We bridge the gap." },
              { n: "02", t: "AI hook scoring works", b: "GPT-4-class models reliably pick viral moments. Whisper large-v3 is fast + cheap on RunPod. YOLO v8 is 12ms latency. The pieces are ready; nobody has integrated them taste-first." },
              { n: "03", t: "Macro is brutal", b: "Creator economy is the fastest-growing work segment. Median creator income is $0 from brand deals. We route 70% of revenue to clippers — 10× better than YouTube's partner program." },
            ].map((w) => (
              <div key={w.n} className="glass-card hover-glow p-7 relative overflow-hidden">
                <span
                  className="absolute -top-4 -right-2 font-display font-semibold select-none pointer-events-none"
                  style={{
                    fontSize: "8rem",
                    lineHeight: 1,
                    color: "transparent",
                    background: "linear-gradient(180deg, rgba(60, 50, 30, 0.08) 0%, rgba(60, 50, 30, 0.02) 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                  }}
                >
                  {w.n}
                </span>
                <div className="relative">
                  <h3 className="font-display font-semibold text-lg mb-2" style={{ color: "var(--color-text-primary)" }}>
                    {w.t}
                  </h3>
                  <p className="text-[14px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                    {w.b}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 06 · UNFAIR ADVANTAGE */}
      <section className="relative py-32 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-12 max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>06</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Unfair advantage</span>
            </div>
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Why we win, not just </span>
              <span className="hero-text text-gradient-sunset">why we try</span>
              <span style={{ color: "var(--color-text-primary)" }}>.</span>
            </h2>
          </div>

          <div className="space-y-3">
            {ADVANTAGES.map((a, i) => (
              <div key={a.title} className="glass-card hover-glow p-7">
                <div className="flex items-start gap-5">
                  <div
                    className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-display font-semibold"
                    style={{
                      background: "var(--gradient-sunset)",
                      color: "white",
                      boxShadow: "0 4px 12px rgba(217, 70, 239, 0.20)",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-semibold text-lg mb-2" style={{ color: "var(--color-text-primary)" }}>
                      {a.title}
                    </h3>
                    <p className="text-[14px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                      {a.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 07 · TEAM */}
      <section className="relative py-32 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-12 max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>07</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Team</span>
            </div>
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Two people. </span>
              <span className="hero-text text-gradient-sunset">One AI. One product.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {TEAM.map((m) => (
              <div key={m.name} className="glass-card p-7">
                <div className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-semibold text-xl text-white shrink-0"
                    style={{ background: "var(--gradient-sunset)" }}
                  >
                    {m.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-[16px]" style={{ color: "var(--color-text-primary)" }}>
                      {m.name}
                    </p>
                    <p className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-accent)" }}>
                      {m.role}
                    </p>
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                      {m.bio}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-[12px] text-center font-mono" style={{ color: "var(--color-text-muted)" }}>
            Hiring: senior full-stack (Next.js + FastAPI), senior ML engineer (Whisper + YOLO), founding designer. Remote-first, India / US.
          </p>
        </div>
      </section>

      {/* 08 · USE OF FUNDS */}
      <section className="relative py-32 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-12 max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>08</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Use of funds</span>
            </div>
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Where </span>
              <span className="hero-text text-gradient-sunset">$2M</span>
              <span style={{ color: "var(--color-text-primary)" }}> goes.</span>
            </h2>
          </div>

          <div className="space-y-3">
            {USE_OF_FUNDS.map((u) => (
              <div key={u.label} className="glass-card p-5">
                <div className="flex items-center gap-4">
                  <span
                    className="font-display font-semibold text-2xl tabular-nums shrink-0"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {u.pct}%
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {u.label}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                        ${(u.pct * 20000).toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(60, 50, 30, 0.08)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "var(--gradient-sunset)" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${u.pct}%` }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 09 · NEXT STEP */}
      <section className="relative py-32 overflow-hidden">
        <div className="max-w-4xl mx-auto px-6">
          <div
            className="glass-panel p-12 md:p-16 text-center relative overflow-hidden"
            style={{ borderRadius: "var(--radius-2xl)" }}
          >
            <div
              className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.20) 0%, transparent 70%)" }}
            />
            <div
              className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.14) 0%, transparent 70%)" }}
            />
            <div className="relative">
              <div className="flex items-center justify-center gap-3 mb-6">
                <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>09</span>
                <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
                <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Next step</span>
                <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              </div>
              <h2
                className="font-display font-semibold tracking-tight"
                style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", lineHeight: 1.05 }}
              >
                <span style={{ color: "var(--color-text-primary)" }}>See it work. </span>
                <span className="hero-text text-gradient-sunset">15 minutes.</span>
              </h2>
              <p className="mt-5 text-[16px] max-w-lg mx-auto" style={{ color: "var(--color-text-secondary)" }}>
                Live demo on the site, 10-min pitch deck, 5-min traction call. Pick whatever fits.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/" className="btn-primary btn-shine inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Try the live demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="mailto:founders@relativ.video" className="btn-ghost inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  founders@relativ.video
                </a>
              </div>
              <div className="mt-6 text-[11px] font-mono" style={{ color: "var(--color-text-faint)" }}>
                Response within 24 hours. We answer DMs faster than email.
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
