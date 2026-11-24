"use client";

import Link from "next/link";
import {
  BookOpen,
  ArrowLeft,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Scissors,
  Sparkles,
  Target,
  PlayCircle,
  CheckCircle2,
} from "lucide-react";

const PILLARS = [
  {
    icon: Scissors,
    title: "What is Clipping?",
    body: "Every podcast, founder interview, stream, or product launch contains 10–20 sharp, self-contained stories buried inside 60+ minutes of video. Clipping is the craft of isolating a complete narrative arc—Hook, Setup, and Payoff—reframing it for vertical 9:16 feeds, and adding readable word-by-word captions.",
  },
  {
    icon: TrendingUp,
    title: "Why Clipping is the New Media",
    body: "Attention shifted from polished studio commercials to native, high-retention vertical feeds on TikTok, Instagram Reels, YouTube Shorts, and X. A single 45-second clip from a zero-follower page can reach 500,000+ organic viewers overnight—something paid display ads can no longer buy cheaply.",
  },
  {
    icon: DollarSign,
    title: "Why D2C Brands Pay Clippers Real Dollars",
    body: "Paid social CPMs have climbed while audiences skip obvious ads. D2C brands (apparel, supplements, SaaS, consumer apps) and creator networks now fund clipping campaigns directly—paying independent clippers $1.50 to $5.00+ per 1,000 verified views, plus viral performance bounties.",
  },
];

const WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Pick a Brand Campaign or Creator Show",
    detail: "Browse active D2C brand briefs and creator channels looking for high-retention short-form distribution.",
  },
  {
    step: "2",
    title: "Surface Viral 30–90s Arcs with RelatiV",
    detail: "Paste the long-form YouTube link or video file. RelatiV scores hooks, tracks active speakers in 9:16, and syncs karaoke captions automatically.",
  },
  {
    step: "3",
    title: "Polish & Publish Native",
    detail: "Fine-tune pacing in Edit Studio, export watermark-free HD clips, and post across YouTube Shorts, Reels, TikTok, and X.",
  },
  {
    step: "4",
    title: "Earn Per Verified View",
    detail: "Submit your published links to the campaign tracker. As views climb, payouts settle based on campaign CPM rates.",
  },
];

export default function LearningCenterPage() {
  return (
    <main className="min-h-screen bg-[#0A0B0E] text-[#F4F1E8] pt-28 pb-24">
      <div className="mx-auto max-w-6xl px-6">
        {/* Top bar */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#141517] px-3.5 py-2 text-xs text-[#b6b7bc] transition hover:border-white/20 hover:text-white"
          >
            <ArrowLeft size={14} />
            Back to Studio
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#A8FF4F]/30 bg-[#A8FF4F]/10 px-3 py-1 font-mono text-[11px] text-[#A8FF4F]">
            <BookOpen size={12} />
            RelatiV Learning Center
          </span>
        </div>

        {/* Hero */}
        <section className="border-b border-white/10 pb-14">
          <h1 className="max-w-4xl font-display text-4xl font-semibold tracking-tight text-[#F4F1E8] sm:text-5xl lg:text-6xl leading-[1.03]">
            Clipping is the new media—and brands are paying for every view.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#a8a9af] sm:text-lg">
            Learn how short-form clipping turned long-form podcasts, streams, and founder stories into the highest-ROI distribution channel for D2C brands—and how clippers earn real dollars turning raw footage into viral clips.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/campaigns"
              className="inline-flex items-center gap-2 rounded-lg bg-[#A8FF4F] px-5 py-3 text-sm font-semibold text-[#07080B] transition hover:brightness-110"
            >
              Explore Paid Campaigns
              <ArrowUpRight size={16} />
            </Link>
            <Link
              href="/clippers"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#141517] px-5 py-3 text-sm font-medium text-[#F4F1E8] transition hover:border-white/30"
            >
              For Clippers Overview
            </Link>
          </div>
        </section>

        {/* Core 3 Pillars */}
        <section className="grid gap-6 py-14 md:grid-cols-3 border-b border-white/10">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-xl border border-white/10 bg-[#141517] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[#E7B84B]">
                <Icon size={18} />
              </div>
              <h2 className="mt-5 font-display text-xl font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#a2a3aa]">{body}</p>
            </article>
          ))}
        </section>

        {/* D2C Brand Economics Breakdown */}
        <section className="py-14 border-b border-white/10">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-[#E7B84B]">
                <Target size={14} />
                THE D2C BRAND SHIFT
              </div>
              <h2 className="mt-3 font-display text-3xl font-semibold text-[#F4F1E8]">
                Why brands pay clippers instead of buying traditional ad impressions
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[#a2a3aa]">
                A typical D2C brand spends thousands of dollars on studio shoots and Meta/TikTok ad auctions—only for users to scroll past in 0.8 seconds because it looks like an ad.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-[#d7d7da]">
                {[
                  "Clipped founder interviews & creator podcasts feel native and trustworthy",
                  "Brands only pay for verified organic views—zero wasted spend on skipped ads",
                  "Dozens of clippers test multiple hooks simultaneously to find runaway winners",
                  "Top D2C brands allocate $5,000–$50,000/month directly to clipper bounties",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#A8FF4F]" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Concrete Earnings Example Card */}
            <div className="lg:col-span-6 rounded-xl border border-white/10 bg-[#141517] p-7">
              <p className="font-mono text-xs text-[#8f9095]">SAMPLE CAMPAIGN MATH</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                How one 45-second clip earns $500+
              </h3>
              <div className="mt-6 space-y-4 border-t border-white/10 pt-5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#9b9ca3]">Brand Campaign CPM Rate</span>
                  <span className="font-mono font-semibold text-white">$2.00 / 1K views</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#9b9ca3]">Organic Views Across Shorts + Reels</span>
                  <span className="font-mono font-semibold text-white">250,000 views</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="font-medium text-white">Clipper Earnings</span>
                  <span className="font-mono text-2xl font-semibold text-[#A8FF4F]">$500.00</span>
                </div>
              </div>
              <p className="mt-4 text-xs text-[#8f9095]">
                Active clippers ship 10–30 clips per week using RelatiV&apos;s AI hook detector to compound multiple winning videos across campaigns.
              </p>
            </div>
          </div>
        </section>

        {/* How to Clip & Earn Workflow */}
        <section className="py-14">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#F4F1E8] sm:text-3xl">
                How to Start Clipping Today
              </h2>
              <p className="mt-2 text-sm text-[#9b9ca3]">
                Go from raw 1-hour YouTube video to ready-to-post viral shorts in under 5 minutes.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((item) => (
              <div key={item.step} className="rounded-xl border border-white/10 bg-[#141517] p-5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.06] font-mono text-xs font-semibold text-[#E7B84B]">
                  {item.step}
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#9b9ca3]">{item.detail}</p>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-10 flex flex-col justify-between gap-6 rounded-xl border border-white/10 bg-[#141517] p-7 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E7B84B]/15 text-[#E7B84B]">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold text-white">
                  Ready to turn long-form videos into income?
                </h3>
                <p className="mt-1 text-sm text-[#9b9ca3]">
                  Open RelatiV Studio to cut your first clips or apply to brand clipping campaigns.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-[#F4F1E8] px-5 py-2.5 text-sm font-semibold text-[#0A0B0E] transition hover:bg-white"
              >
                <PlayCircle size={16} />
                Open Studio
              </Link>
              <Link
                href="/brands"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/30"
              >
                For Brands
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
