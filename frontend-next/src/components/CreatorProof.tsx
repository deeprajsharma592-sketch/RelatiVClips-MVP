"use client";

import { motion } from "framer-motion";
import { TrendingUp, Users, Eye, Sparkles, CheckCircle2 } from "lucide-react";

const STATS = [
  { metric: "150K+", label: "Short-form views generated", subtext: "Across TikTok, Reels & Shorts" },
  { metric: "+266%", label: "Average reach increase", subtext: "For long-form creators" },
  { metric: "60s", label: "Average turnaround", subtext: "From YouTube link to 10 clips" },
  { metric: "98.4%", label: "Caption accuracy", subtext: "Powered by Whisper AI" },
];

const CREATORS = [
  {
    name: "Aarush V.",
    handle: "@aarush_clips",
    niche: "Tech & Podcasts",
    subs: "420K Followers",
    quote: "RelatiV cut our clipping time from 6 hours to 5 minutes. The hook detection actually picks moments that hold retention.",
    growth: "+310% views",
    avatar: "👨‍💻",
  },
  {
    name: "Elena Rostova",
    handle: "@elenatalks",
    niche: "Interviews & Lifestyle",
    subs: "890K Followers",
    quote: "The auto-reframe never cuts off heads during dual-speaker interviews. It looks like my editor spent half a day in Premiere.",
    growth: "+1.8M reach",
    avatar: "🎙️",
  },
  {
    name: "Devon M.",
    handle: "@devonaction",
    niche: "Gaming & IRL",
    subs: "1.2M Followers",
    quote: "Being able to paste a 3-hour Twitch VOD and get 10 ready-to-post vertical shorts with animated captions is a cheat code.",
    growth: "+4.2M views",
    avatar: "🎮",
  },
];

export default function CreatorProof() {
  return (
    <section className="relative py-16 sm:py-18 px-4 sm:px-6 bg-[#F7F8FA] dark:bg-[#050507] text-[#111318] dark:text-white border-t border-b border-black/[0.08] dark:border-white/5 transition-colors">
      <div className="w-full max-w-[1600px] mx-auto">
        {/* KPI Trust Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-12 border-b border-black/[0.08] dark:border-white/10">
          {STATS.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: idx * 0.08 }}
              className="text-center"
            >
              <p className="font-display font-extrabold text-3xl sm:text-4xl lg:text-[44px] text-zinc-900 dark:text-white tracking-tight">
                {stat.metric}
              </p>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                {stat.label}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-500 font-mono mt-0.5">
                {stat.subtext}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Creator Growth Section */}
        <div className="mt-12 text-center">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Built for creators who want to{" "}
            <span className="text-emerald-600 dark:text-emerald-400">grow faster.</span>
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto">
            See how top short-form clippers use RelatiV to dominate the feed.
          </p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            {CREATORS.map((c, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
                className="rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-zinc-950/80 p-5 flex flex-col justify-between shadow-sm dark:shadow-none hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-black/[0.04] dark:bg-white/10 flex items-center justify-center text-lg">
                        {c.avatar}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-white">{c.name}</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">{c.handle}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      {c.growth}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
                    "{c.quote}"
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>{c.niche}</span>
                  <span className="text-zinc-700 dark:text-zinc-400 font-semibold">{c.subs}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
