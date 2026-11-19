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
  Sparkles,
  ExternalLink,
  Calendar,
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
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium mb-2">
            <BarChart2 size={13} />
            Performance Telemetry
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Analyse & Growth Pulse</h1>
          <p className="text-xs text-zinc-400">
            Real-time viewer retention, platform distribution, and virality metrics
          </p>
        </div>

        {/* Time Selector */}
        <div className="flex items-center p-1 bg-white/5 border border-white/10 rounded-lg text-xs">
          {(["7d", "30d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1 rounded-md font-medium transition ${
                timeRange === r
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {r === "7d" ? "Last 7 Days" : r === "30d" ? "Last 30 Days" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-[#12131A] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Tracked Views</span>
            <Eye size={15} className="text-cyan-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">284,910</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1">
            <TrendingUp size={12} />
            <span>+24.8% from last week</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#12131A] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Watch Time</span>
            <Clock size={15} className="text-purple-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">1,420 hrs</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1">
            <TrendingUp size={12} />
            <span>+18.2% retention gain</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#12131A] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Avg. Retention Rate</span>
            <Flame size={15} className="text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">85.5%</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1">
            <TrendingUp size={12} />
            <span>Top 5% in niche</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#12131A] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Shared Across</span>
            <Share2 size={15} className="text-pink-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">3 Platforms</p>
          <p className="text-[11px] text-zinc-400 mt-1">Shorts, Reels & TikTok</p>
        </div>
      </div>

      {/* Platform Breakdown Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Platform Bars */}
        <div className="md:col-span-2 bg-[#12131A] border border-white/10 rounded-xl p-6">
          <h3 className="text-sm font-bold text-white mb-1">Platform Share of Audience</h3>
          <p className="text-xs text-zinc-400 mb-6">Distribution of views across linked social channels</p>

          <div className="space-y-4">
            {/* YouTube Shorts */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  YouTube Shorts
                </span>
                <span className="text-zinc-400">136,750 views (48%)</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className="bg-red-500 h-full w-[48%]" />
              </div>
            </div>

            {/* TikTok */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  TikTok
                </span>
                <span className="text-zinc-400">96,870 views (34%)</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className="bg-cyan-400 h-full w-[34%]" />
              </div>
            </div>

            {/* Instagram Reels */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                  Instagram Reels
                </span>
                <span className="text-zinc-400">51,290 views (18%)</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className="bg-pink-500 h-full w-[18%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Hook Insights */}
        <div className="bg-[#12131A] border border-white/10 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Virality Insight</h3>
            <p className="text-xs text-zinc-400 mb-4">RelatiVSauce Recommendation</p>

            <div className="p-3.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200 leading-relaxed mb-4">
              Clips using the <b>Statement Auto-Hook</b> generated <b>38% higher completion rate</b> compared to generic intro cuts.
            </div>

            <p className="text-xs text-zinc-400">
              Optimal clip duration for your podcast content: <b>32–45 seconds</b>.
            </p>
          </div>

          <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
            <span>Algorithm calibration</span>
            <span className="text-emerald-400 font-semibold">Active</span>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-[#12131A] border border-white/10 rounded-xl p-6">
        <h3 className="text-sm font-bold text-white mb-1">Top Performing Generated Clips</h3>
        <p className="text-xs text-zinc-400 mb-4">Clips ranked by organic retention & virality score</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400">
                <th className="pb-3 font-semibold">Clip Title</th>
                <th className="pb-3 font-semibold">Viral Score</th>
                <th className="pb-3 font-semibold">Tracked Views</th>
                <th className="pb-3 font-semibold">Retention</th>
                <th className="pb-3 font-semibold">Published</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {SAMPLE_CLIPS.map((clip) => (
                <tr key={clip.id} className="hover:bg-white/[0.02] transition">
                  <td className="py-3.5">
                    <div className="font-semibold text-white">{clip.title}</div>
                    <div className="text-[11px] text-zinc-400">{clip.source}</div>
                  </td>
                  <td className="py-3.5">
                    <span className="px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-300 border border-amber-500/20 text-[11px]">
                      🔥 {clip.viralityScore}/100
                    </span>
                  </td>
                  <td className="py-3.5 font-mono text-zinc-200">{clip.views.toLocaleString()}</td>
                  <td className="py-3.5 text-emerald-400 font-medium">{clip.retention}</td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-1.5">
                      {clip.publishedTo.map((p) => (
                        <span
                          key={p}
                          className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-medium text-zinc-300 capitalize"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 text-right">
                    <button className="text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1">
                      <span>Inspect</span>
                      <ArrowUpRight size={13} />
                    </button>
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
