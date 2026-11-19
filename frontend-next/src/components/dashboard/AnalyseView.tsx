"use client";

import { useState } from "react";
import {
  BarChart2,
  TrendingUp,
  Eye,
  Clock,
  Share2,
  Flame,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";

interface ClipAnalytics {
  id: string;
  title: string;
  source: string;
  viralityScore: number;
  views: number;
  retention: string;
  publishedTo: ("tiktok" | "youtube" | "instagram")[];
  date: string;
}

const SAMPLE_CLIPS: ClipAnalytics[] = [
  {
    id: "clip-1",
    title: "How I Scaled to $100k Without Paid Ads",
    source: "Founder Deep Dive #12",
    viralityScore: 98,
    views: 142800,
    retention: "91.4%",
    publishedTo: ["youtube", "tiktok", "instagram"],
    date: "2 days ago",
  },
  {
    id: "clip-2",
    title: "The Exact Mistake 90% of Creators Make",
    source: "Danny Duncan 24h Stream",
    viralityScore: 94,
    views: 89400,
    retention: "86.2%",
    publishedTo: ["tiktok", "youtube"],
    date: "4 days ago",
  },
  {
    id: "clip-3",
    title: "Why You Should Never Buy an Audience",
    source: "Lex Fridman #408",
    viralityScore: 89,
    views: 52710,
    retention: "78.9%",
    publishedTo: ["youtube", "instagram"],
    date: "1 week ago",
  },
];

export default function AnalyseView() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("7d");

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Analyse & Growth Pulse
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time retention telemetry and cross-platform views breakdown.
          </p>
        </div>

        {/* Time Selector */}
        <div className="flex items-center p-0.5 bg-white/[0.03] border border-white/10 rounded-lg text-xs">
          {(["7d", "30d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                timeRange === r
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1.5">
            <span>Tracked Views</span>
            <Eye size={14} className="text-zinc-500" />
          </div>
          <p className="text-xl font-bold text-white">284,910</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1">
            <TrendingUp size={11} />
            <span>+24.8% this week</span>
          </div>
        </div>

        <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1.5">
            <span>Watch Time</span>
            <Clock size={14} className="text-zinc-500" />
          </div>
          <p className="text-xl font-bold text-white">1,420 hrs</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1">
            <TrendingUp size={11} />
            <span>+18.2% retention gain</span>
          </div>
        </div>

        <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1.5">
            <span>Avg. Retention</span>
            <Flame size={14} className="text-zinc-500" />
          </div>
          <p className="text-xl font-bold text-white">85.5%</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1">
            <TrendingUp size={11} />
            <span>Top 5% in niche</span>
          </div>
        </div>

        <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1.5">
            <span>Published Across</span>
            <Share2 size={14} className="text-zinc-500" />
          </div>
          <p className="text-xl font-bold text-white">3 Channels</p>
          <p className="text-[11px] text-zinc-500 mt-1">Shorts, Reels, TikTok</p>
        </div>
      </div>

      {/* Platform Breakdown & Recommendation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Platform Share */}
        <div className="md:col-span-2 bg-[#121215] border border-white/[0.08] rounded-xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-0.5">Platform Distribution</h3>
          <p className="text-xs text-zinc-400 mb-4">View breakdown by destination channel</p>

          <div className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  YouTube Shorts
                </span>
                <span className="text-zinc-400 font-mono text-[11px]">136,750 (48%)</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-red-500 h-full w-[48%]" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-zinc-400" />
                  TikTok
                </span>
                <span className="text-zinc-400 font-mono text-[11px]">96,870 (34%)</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-white/80 h-full w-[34%]" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  Instagram Reels
                </span>
                <span className="text-zinc-400 font-mono text-[11px]">51,290 (18%)</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-zinc-400 h-full w-[18%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Insight */}
        <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Algorithm Insight</h3>
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-300 leading-relaxed">
              Clips using the <b>Statement Auto-Hook</b> generated <b>38% higher completion rate</b> compared to generic intro cuts.
            </div>
            <p className="text-xs text-zinc-400">
              Optimal clip duration: <b>32–45 seconds</b>.
            </p>
          </div>

          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
            <span>Retention model</span>
            <span className="text-emerald-400 font-medium">Online</span>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-0.5">Top Performing Clips</h3>
        <p className="text-xs text-zinc-400 mb-4">Ranked by retention and virality score</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-zinc-400">
                <th className="pb-2.5 font-semibold">Clip Title</th>
                <th className="pb-2.5 font-semibold">Viral Score</th>
                <th className="pb-2.5 font-semibold">Views</th>
                <th className="pb-2.5 font-semibold">Retention</th>
                <th className="pb-2.5 font-semibold">Platforms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {SAMPLE_CLIPS.map((clip) => (
                <tr key={clip.id} className="hover:bg-white/[0.02] transition">
                  <td className="py-3">
                    <div className="font-medium text-white">{clip.title}</div>
                    <div className="text-[10px] text-zinc-500">{clip.source}</div>
                  </td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-md font-semibold bg-white/10 text-white border border-white/10 text-[11px]">
                      ⚡ {clip.viralityScore}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-zinc-300">{clip.views.toLocaleString()}</td>
                  <td className="py-3 text-emerald-400 font-medium">{clip.retention}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      {clip.publishedTo.map((p) => (
                        <span
                          key={p}
                          className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/[0.06] text-[10px] text-zinc-400 capitalize"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
