"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Mic, Activity, TrendingUp, Zap } from "lucide-react";

const VERTICALS = [
  {
    icon: Mic,
    title: "Podcasters",
    body: "Auto-detect the moment your guest says something quotable. Get clips before the episode ends.",
  },
  {
    icon: Activity,
    title: "Sports Highlights",
    body: "Match events synced to commentator energy spikes. Highlight package ready when the whistle blows.",
  },
  {
    icon: TrendingUp,
    title: "Coaches & Educators",
    body: "Long lessons, short attention spans. Find the 60-second insight that drives saves and shares.",
  },
  {
    icon: Zap,
    title: "Live E-commerce",
    body: "Pin the moment of the product reveal, the demo, the discount drop. Conversion-ready reels on the fly.",
  },
];

export default function CreatorsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-mono text-accent">
            [Φ-Creators]
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-accent to-transparent" />
        </div>
        <h1 className="text-4xl font-display font-bold text-text-primary mb-3">
          For <span className="text-accent">Creators</span>
        </h1>
        <p className="text-base text-text-muted max-w-2xl font-sans">
          One video. Ten clips. Five minutes. The fastest way to ship
          short-form content from long-form recordings.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {VERTICALS.map((v, i) => (
          <motion.div
            key={v.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-6 rounded-2xl"
          >
            <v.icon className="h-6 w-6 text-accent mb-3" />
            <h3 className="text-lg font-display font-bold text-text-primary mb-2">
              {v.title}
            </h3>
            <p className="text-sm text-text-secondary font-sans leading-relaxed">
              {v.body}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/signup?role=creator"
          className="btn-primary btn-shine inline-flex items-center gap-2"
        >
          Start clipping
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/plans"
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-text-primary text-sm font-semibold rounded-full hover:border-accent transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          See pricing
        </Link>
      </div>
    </div>
  );
}
