"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  ExternalLink,
  Filter,
  KeyRound,
  Link2,
  Loader2,
  MoveUpRight,
  RefreshCw,
  X,
} from "lucide-react";
import {
  AnalyticsResponse,
  configureYouTubeAnalytics,
  fetchSocialAnalytics,
} from "@/lib/socials";
import { InstagramIcon, YoutubeIcon } from "./SocialAccountsView";

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatWatchTime(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)} hrs`;
  return `${Math.round(minutes)} min`;
}

export default function AnalyseView({
  onConnectAccount,
}: {
  onConnectAccount?: () => void;
}) {
  const [days, setDays] = useState<7 | 28 | 90>(7);
  const [platform, setPlatform] = useState<"all" | "youtube" | "instagram">("all");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // YouTube Analytics API entry modal
  const [isYtModalOpen, setIsYtModalOpen] = useState(false);
  const [ytApiKey, setYtApiKey] = useState("");
  const [ytChannelId, setYtChannelId] = useState("");
  const [ytOAuthToken, setYtOAuthToken] = useState("");
  const [savingYt, setSavingYt] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSocialAnalytics(days, platform);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [days, platform]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleSaveYouTubeApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setYtError(null);
    setSavingYt(true);
    try {
      await configureYouTubeAnalytics({
        api_key: ytApiKey.trim() || undefined,
        channel_id: ytChannelId.trim() || undefined,
        access_token: ytOAuthToken.trim() || undefined,
      });
      setIsYtModalOpen(false);
      setYtApiKey("");
      setYtOAuthToken("");
      await loadAnalytics();
    } catch (err) {
      setYtError(err instanceof Error ? err.message : "Could not verify YouTube API credentials.");
    } finally {
      setSavingYt(false);
    }
  };

  const cycleDays = () => {
    setDays((prev) => (prev === 7 ? 28 : prev === 28 ? 90 : 7));
  };

  const cyclePlatform = () => {
    setPlatform((prev) =>
      prev === "all" ? "youtube" : prev === "youtube" ? "instagram" : "all"
    );
  };

  const summary = data?.summary;
  const chartItems =
    data?.daily && data.daily.length > 0
      ? data.daily.map((d) => ({ label: d.date.slice(5), value: d.views }))
      : (data?.videos || []).slice(0, 10).map((v) => ({
          label: v.title.slice(0, 14),
          value: v.views,
        }));
  const maxChartVal = Math.max(1, ...chartItems.map((c) => c.value));

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#F4F1E8]">
            Analytics
          </h1>
          <p className="mt-1.5 max-w-xl text-xs leading-5 text-[#85868b]">
            Live metrics pulled directly from your YouTube &amp; Instagram APIs. No sample numbers.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsYtModalOpen(true)}
            className="flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-[#18191b] px-3 text-xs text-white hover:bg-[#222428] cursor-pointer"
          >
            <KeyRound size={13} className="text-[#E7B84B]" />
            <span>YouTube Analytics API</span>
          </button>
          <button
            type="button"
            onClick={cycleDays}
            className="flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-[#18191b] px-3 text-xs text-[#c2c3c6] hover:text-white cursor-pointer"
          >
            <CalendarDays size={14} />
            <span>Last {days} days</span>
          </button>
          <button
            type="button"
            onClick={cyclePlatform}
            className="flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-[#18191b] px-3 text-xs text-[#c2c3c6] hover:text-white cursor-pointer capitalize"
          >
            <Filter size={14} />
            <span>{platform === "all" ? "All platforms" : platform}</span>
          </button>
          <button
            type="button"
            onClick={loadAnalytics}
            disabled={loading}
            className="grid h-9 w-9 place-items-center rounded-md border border-white/[0.08] bg-[#18191b] text-[#c2c3c6] hover:text-white cursor-pointer"
            title="Refresh analytics"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Not Connected Empty State */}
      {!loading && (!data || !data.connected) ? (
        <div className="relative min-h-[480px] overflow-hidden rounded-xl border border-white/[0.06] bg-[#151618]">
          <div className="absolute inset-x-0 top-0 grid grid-cols-4 border-b border-white/[0.05] opacity-45">
            {["Views", "Watch time", "Retention", "Published"].map((label) => (
              <div key={label} className="border-r border-white/[0.05] p-5 last:border-r-0">
                <p className="text-[10px] text-[#73747a]">{label}</p>
                <div className="mt-3 h-5 w-20 rounded bg-white/[0.035]" />
              </div>
            ))}
          </div>
          <div
            className="absolute inset-x-8 bottom-20 top-32 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)",
              backgroundSize: "100% 25%, 16.66% 100%",
            }}
          />
          <div className="relative z-10 mx-auto flex min-h-[480px] max-w-md flex-col items-center justify-center px-6 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-[#202124] text-[#E7B84B]">
              <Link2 size={18} />
            </span>
            <h2 className="mt-4 text-base font-medium text-white">Connect where you publish</h2>
            <p className="mt-2 text-xs leading-5 text-[#85868b]">
              Enter your YouTube Analytics API key or link your YouTube &amp; Instagram accounts to view real views, watch time, and video performance.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsYtModalOpen(true)}
                className="flex h-9 items-center gap-2 rounded-md bg-[#F4F1E8] px-4 text-xs font-semibold text-[#151515] hover:bg-white cursor-pointer"
              >
                <KeyRound size={13} />
                <span>Enter YouTube API</span>
              </button>
              {onConnectAccount && (
                <button
                  type="button"
                  onClick={onConnectAccount}
                  className="flex h-9 items-center gap-2 rounded-md border border-white/[0.1] bg-[#1e2024] px-4 text-xs font-medium text-white hover:bg-[#26282d] cursor-pointer"
                >
                  <span>Social accounts</span>
                  <MoveUpRight size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* API Notes */}
          {data?.notes && data.notes.length > 0 && (
            <div className="rounded-lg border border-white/[0.07] bg-[#161719] px-4 py-2.5 text-[11px] text-[#a5a6aa]">
              {data.notes[0]}
            </div>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/[0.07] bg-[#151618] p-4">
              <p className="text-[11px] text-[#73747a]">Views ({days}d)</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {loading ? "—" : formatNumber(summary?.views)}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-[#151618] p-4">
              <p className="text-[11px] text-[#73747a]">
                {summary?.watch_time_minutes != null ? "Watch time" : "Total likes"}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {loading
                  ? "—"
                  : summary?.watch_time_minutes != null
                  ? formatWatchTime(summary.watch_time_minutes)
                  : formatNumber(summary?.likes)}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-[#151618] p-4">
              <p className="text-[11px] text-[#73747a]">
                {summary?.avg_retention_pct != null ? "Avg retention" : "Subscribers"}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {loading
                  ? "—"
                  : summary?.avg_retention_pct != null
                  ? `${summary.avg_retention_pct}%`
                  : formatNumber(summary?.subscribers)}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-[#151618] p-4">
              <p className="text-[11px] text-[#73747a]">Published videos</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {loading ? "—" : formatNumber(summary?.published_count)}
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-xl border border-white/[0.07] bg-[#151618] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-medium text-white">
                {data?.daily && data.daily.length > 0
                  ? `Daily views (last ${days} days)`
                  : "Recent video views"}
              </h2>
              <span className="text-[11px] text-[#73747a]">
                {chartItems.length} data points
              </span>
            </div>

            {chartItems.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-xs text-[#6f7075]">
                No view data returned for this period yet.
              </div>
            ) : (
              <div className="flex h-44 items-end gap-2 pt-4">
                {chartItems.map((item, idx) => {
                  const heightPct = Math.max(6, Math.round((item.value / maxChartVal) * 100));
                  return (
                    <div
                      key={`${item.label}-${idx}`}
                      className="flex flex-1 flex-col items-center gap-1.5 min-w-0"
                    >
                      <span className="text-[10px] text-[#85868b] truncate">
                        {formatNumber(item.value)}
                      </span>
                      <div className="flex w-full flex-1 items-end justify-center">
                        <div
                          className="w-full max-w-[36px] rounded-t bg-[#E7B84B]/80 hover:bg-[#E7B84B] transition"
                          style={{ height: `${heightPct}%` }}
                          title={`${item.label}: ${item.value.toLocaleString()} views`}
                        />
                      </div>
                      <span className="w-full truncate text-center text-[10px] text-[#6f7075]">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Video Breakdown Table */}
          <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#151618]">
            <div className="border-b border-white/[0.06] px-5 py-3.5">
              <h2 className="text-xs font-medium text-white">Recent published content</h2>
            </div>

            {!data?.videos || data.videos.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#73747a]">
                No videos found on connected accounts.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {data.videos.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {v.thumbnail_url ? (
                        <img
                          src={v.thumbnail_url}
                          alt={v.title}
                          className="h-10 w-16 rounded object-cover border border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-16 rounded bg-white/[0.04] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {v.platform === "youtube" ? (
                            <YoutubeIcon className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          ) : (
                            <InstagramIcon className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                          )}
                          <p className="truncate text-xs font-medium text-white">{v.title}</p>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#73747a]">
                          {v.published_at
                            ? new Date(v.published_at).toLocaleDateString()
                            : "Published"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 shrink-0 text-right text-xs">
                      <div>
                        <div className="font-medium text-white">{formatNumber(v.views)}</div>
                        <div className="text-[10px] text-[#73747a]">Views</div>
                      </div>
                      <div className="hidden sm:block">
                        <div className="font-medium text-white">{formatNumber(v.likes)}</div>
                        <div className="text-[10px] text-[#73747a]">Likes</div>
                      </div>
                      <div className="hidden sm:block">
                        <div className="font-medium text-white">{formatNumber(v.comments)}</div>
                        <div className="text-[10px] text-[#73747a]">Comments</div>
                      </div>
                      {v.url && (
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded p-1.5 text-[#85868b] hover:bg-white/[0.06] hover:text-white"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* YouTube Analytics API Modal */}
      {isYtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#141517] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
              <div className="flex items-center gap-2">
                <YoutubeIcon className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-semibold text-white">YouTube Analytics API</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsYtModalOpen(false)}
                className="rounded-md p-1 text-[#85868b] hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveYouTubeApi} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                  YouTube Data / Analytics API Key
                </label>
                <input
                  type="password"
                  value={ytApiKey}
                  onChange={(e) => setYtApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                  Channel ID or @Handle
                </label>
                <input
                  type="text"
                  value={ytChannelId}
                  onChange={(e) => setYtChannelId(e.target.value)}
                  placeholder="UC... or @yourchannel"
                  className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                  OAuth Access Token{" "}
                  <span className="text-[#6f7075]">(optional, unlocks watch-time &amp; retention)</span>
                </label>
                <input
                  type="password"
                  value={ytOAuthToken}
                  onChange={(e) => setYtOAuthToken(e.target.value)}
                  placeholder="ya29...."
                  className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none font-mono"
                />
              </div>

              {ytError && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                  {ytError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsYtModalOpen(false)}
                  className="h-9 rounded-md border border-white/[0.08] px-3.5 text-xs text-[#a5a6aa] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingYt}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-[#F4F1E8] px-4 text-xs font-semibold text-[#151515] hover:bg-white disabled:opacity-50 cursor-pointer"
                >
                  {savingYt && <Loader2 size={13} className="animate-spin" />}
                  <span>Connect &amp; Load Analytics</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
