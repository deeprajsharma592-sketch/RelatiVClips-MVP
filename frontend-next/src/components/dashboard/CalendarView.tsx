"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Film,
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  ConnectedAccount,
  ScheduledPost,
  SocialPlatform,
  connectSocialAccount,
  createScheduledPost,
  deleteScheduledPost,
  fetchScheduledPosts,
  fetchSocialAccounts,
  publishScheduledPostNow,
  updateScheduledPost,
} from "@/lib/socials";
import { InstagramIcon, YoutubeIcon } from "./SocialAccountsView";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CalendarClipOption {
  id: string;
  title: string;
  videoUrl: string;
}

function toLocalDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CalendarView({
  onOpenSocials,
  availableClips = [],
}: {
  onOpenSocials: () => void;
  availableClips?: CalendarClipOption[];
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Schedule modal state
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("#shorts #reels");
  const [targetPlatforms, setTargetPlatforms] = useState<SocialPlatform[]>([]);
  const [scheduleDate, setScheduleDate] = useState(() => toLocalDateInput(new Date()));
  const [scheduleTime, setScheduleTime] = useState("18:30");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Post inspector modal
  const [activePost, setActivePost] = useState<ScheduledPost | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [postBusy, setPostBusy] = useState(false);

  // YouTube Auto-Upload modal state
  const [isYtUploadModalOpen, setIsYtUploadModalOpen] = useState(false);
  const [ytUploadChannelId, setYtUploadChannelId] = useState("");
  const [ytUploadAccessToken, setYtUploadAccessToken] = useState("");
  const [ytUploadRefreshToken, setYtUploadRefreshToken] = useState("");
  const [connectingYtUpload, setConnectingYtUpload] = useState(false);
  const [ytUploadError, setYtUploadError] = useState<string | null>(null);
  const [ytUploadSuccess, setYtUploadSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accRes, schedRes] = await Promise.all([
        fetchSocialAccounts(),
        fetchScheduledPosts(),
      ]);
      const accList = accRes.accounts || [];
      setAccounts(accList);
      setPosts(schedRes.posts || []);
      setTargetPlatforms(
        accList
          .map((a) => a.platform)
          .filter((p): p is SocialPlatform => p === "youtube" || p === "instagram")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear(),
      month = cursor.getMonth();
    const first = new Date(year, month, 1),
      start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [cursor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const key = toLocalDateInput(new Date(p.scheduled_at));
      const arr = map.get(key) || [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [posts]);

  const ytAccount = accounts.find((a) => a.platform === "youtube");
  const igAccount = accounts.find((a) => a.platform === "instagram");
  const anyConnected = Boolean(ytAccount || igAccount);

  const move = (amount: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1));
  const today = new Date();

  const openScheduleModal = (day?: Date) => {
    setScheduleDate(toLocalDateInput(day || new Date()));
    setScheduleTime("18:30");
    setModalError(null);
    if (availableClips.length > 0 && !selectedClipId) {
      setSelectedClipId(availableClips[0].id);
      setVideoUrl(availableClips[0].videoUrl);
      if (!title) setTitle(availableClips[0].title);
    }
    setIsScheduleOpen(true);
  };

  const togglePlatform = (p: SocialPlatform) => {
    setTargetPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const handleClipSelect = (clipId: string) => {
    setSelectedClipId(clipId);
    const found = availableClips.find((c) => c.id === clipId);
    if (found) {
      setVideoUrl(found.videoUrl);
      if (!title.trim()) setTitle(found.title);
    }
  };

  const handleCreateSchedule = async (publishNow: boolean) => {
    setModalError(null);
    if (!title.trim()) {
      setModalError("Please enter a post title.");
      return;
    }
    if (targetPlatforms.length === 0) {
      setModalError("Select at least one connected platform (YouTube or Instagram).");
      return;
    }
    const iso = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    setSaving(true);
    try {
      const res = await createScheduledPost({
        clip_id: selectedClipId || undefined,
        video_url: videoUrl.trim() || undefined,
        title: title.trim(),
        caption: caption.trim(),
        hashtags: hashtags.trim() || undefined,
        platforms: targetPlatforms,
        scheduled_at: iso,
        timezone_name: Intl.DateTimeFormat().resolvedOptions().timeZone,
        publish_now: publishNow,
      });
      setPosts((prev) => [...prev, res.post]);
      setIsScheduleOpen(false);
      setTitle("");
      setCaption("");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Could not schedule post.");
    } finally {
      setSaving(false);
    }
  };

  const openPostDetail = (post: ScheduledPost) => {
    setActivePost(post);
    const dt = new Date(post.scheduled_at);
    setRescheduleDate(toLocalDateInput(dt));
    setRescheduleTime(
      `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
    );
  };

  const handleReschedule = async () => {
    if (!activePost) return;
    setPostBusy(true);
    try {
      const iso = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
      const res = await updateScheduledPost(activePost.id, { scheduled_at: iso });
      setPosts((prev) => prev.map((p) => (p.id === activePost.id ? res.post : p)));
      setActivePost(res.post);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reschedule post.");
    } finally {
      setPostBusy(false);
    }
  };

  const handlePublishNow = async () => {
    if (!activePost) return;
    setPostBusy(true);
    try {
      const res = await publishScheduledPostNow(activePost.id);
      setPosts((prev) => prev.map((p) => (p.id === activePost.id ? res.post : p)));
      setActivePost(res.post);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setPostBusy(false);
    }
  };

  const handleDeletePost = async () => {
    if (!activePost) return;
    setPostBusy(true);
    try {
      await deleteScheduledPost(activePost.id);
      setPosts((prev) => prev.filter((p) => p.id !== activePost.id));
      setActivePost(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setPostBusy(false);
    }
  };

  const handleConnectYtUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setYtUploadError(null);
    setYtUploadSuccess(null);
    setConnectingYtUpload(true);
    try {
      const res = await connectSocialAccount({
        platform: "youtube",
        channel_id: ytUploadChannelId.trim() || undefined,
        access_token: ytUploadAccessToken.trim() || undefined,
        refresh_token: ytUploadRefreshToken.trim() || undefined,
        auto_publish: true,
      });
      setYtUploadSuccess(res.message || "Connected YouTube Auto-Upload successfully!");
      await loadData();
      setTimeout(() => {
        setIsYtUploadModalOpen(false);
        setYtUploadSuccess(null);
        setYtUploadAccessToken("");
        setYtUploadRefreshToken("");
      }, 1200);
    } catch (err) {
      setYtUploadError(err instanceof Error ? err.message : "Failed to connect YouTube for Auto-Upload.");
    } finally {
      setConnectingYtUpload(false);
    }
  };

  return (
    <div className="space-y-5 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#F4F1E8]">
            Publishing calendar
          </h1>
          <p className="mt-1 text-xs text-[#85868b]">
            Schedule and auto-publish clips to your connected YouTube and Instagram accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!ytAccount && (
            <button
              type="button"
              onClick={() => {
                setYtUploadError(null);
                setYtUploadSuccess(null);
                setIsYtUploadModalOpen(true);
              }}
              className="flex h-9 items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 text-xs text-red-200 hover:bg-red-500/20 cursor-pointer"
            >
              <YoutubeIcon className="w-3.5 h-3.5 text-red-400" />
              <span>Connect YouTube Auto-Upload</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSocials}
            className="flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-[#18191b] px-3 text-xs text-[#c2c3c6] hover:text-white cursor-pointer"
          >
            <span
              className={`h-2 w-2 rounded-full ${ytAccount ? "bg-emerald-400" : "bg-zinc-600"}`}
            />
            <span>YouTube</span>
            <span
              className={`ml-1 h-2 w-2 rounded-full ${igAccount ? "bg-emerald-400" : "bg-zinc-600"}`}
            />
            <span>Instagram</span>
          </button>

          <button
            type="button"
            onClick={() => openScheduleModal()}
            className="flex h-9 items-center gap-2 rounded-md bg-[#F4F1E8] px-4 text-xs font-semibold text-[#151515] hover:bg-white transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Schedule post</span>
          </button>
        </div>
      </div>

      {/* Auto-upload prompt when YouTube is not connected */}
      {!loading && !ytAccount && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-xs text-red-200">
            <YoutubeIcon className="w-4 h-4 shrink-0 text-red-400" />
            <span>
              Connect YouTube to auto-upload and schedule clips directly as YouTube Shorts.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setYtUploadError(null);
              setYtUploadSuccess(null);
              setIsYtUploadModalOpen(true);
            }}
            className="h-8 shrink-0 rounded-md bg-[#F4F1E8] px-3 text-xs font-semibold text-[#151515] hover:bg-white cursor-pointer"
          >
            Connect Auto-Upload
          </button>
        </div>
      )}

      {/* Prompt if neither YouTube nor Instagram is connected */}
      {!loading && !anyConnected && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-xs text-amber-200">
            <AlertCircle size={15} className="shrink-0 text-amber-400" />
            <span>
              Connect your YouTube or Instagram API account first to schedule and publish posts directly from the calendar.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenSocials}
            className="h-8 shrink-0 rounded-md bg-[#F4F1E8] px-3 text-xs font-semibold text-[#151515] hover:bg-white cursor-pointer"
          >
            Connect accounts
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Calendar Grid */}
      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#161719]">
        <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-4">
          <button
            type="button"
            onClick={() => move(-1)}
            className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.07] text-[#85868b] hover:text-white cursor-pointer"
          >
            <ChevronLeft size={15} />
          </button>
          <div className="flex items-center gap-3">
            <b className="text-sm font-medium text-white">
              {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </b>
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="rounded border border-white/[0.08] px-2 py-0.5 text-[10px] text-[#a5a6aa] hover:text-white cursor-pointer"
            >
              Today
            </button>
          </div>
          <button
            type="button"
            onClick={() => move(1)}
            className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.07] text-[#85868b] hover:text-white cursor-pointer"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-white/[0.06]">
          {WEEK.map((day) => (
            <div key={day} className="p-3 text-center text-[10px] font-medium text-[#77787d]">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday = day.toDateString() === today.toDateString();
            const key = toLocalDateInput(day);
            const dayPosts = postsByDay.get(key) || [];

            return (
              <div
                key={key}
                onClick={() => openScheduleModal(day)}
                className={`group min-h-24 border-b border-r border-white/[0.05] p-2 text-left align-top hover:bg-white/[0.025] sm:min-h-28 cursor-pointer transition ${
                  inMonth ? "text-[#a5a6aa]" : "text-[#4f5054]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-[11px] ${
                      isToday ? "bg-[#E7B84B] font-semibold text-black" : ""
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-[#77787d] transition">
                    +
                  </span>
                </div>

                <div className="mt-1.5 space-y-1">
                  {dayPosts.slice(0, 3).map((post) => {
                    const timeStr = new Date(post.scheduled_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const statusDot =
                      post.status === "published"
                        ? "bg-emerald-400"
                        : post.status === "failed"
                        ? "bg-red-400"
                        : "bg-amber-400";

                    return (
                      <button
                        key={post.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPostDetail(post);
                        }}
                        className="flex w-full items-center gap-1.5 rounded border border-white/[0.08] bg-[#202226] px-1.5 py-1 text-left text-[10px] text-white hover:border-white/25 transition cursor-pointer"
                      >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot}`} />
                        <span className="truncate flex-1 font-medium">{post.title}</span>
                        <span className="text-[9px] text-[#85868b] shrink-0">{timeStr}</span>
                      </button>
                    );
                  })}
                  {dayPosts.length > 3 && (
                    <div className="px-1 text-[10px] text-[#85868b]">
                      +{dayPosts.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="flex items-center gap-2 text-[11px] text-[#6f7075]">
        <Clock3 size={13} />
        Times use your device timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </p>

      {/* Schedule New Post Modal */}
      {isScheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-white/[0.1] bg-[#141517] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
              <h3 className="text-sm font-semibold text-white">Schedule post</h3>
              <button
                type="button"
                onClick={() => setIsScheduleOpen(false)}
                className="rounded-md p-1 text-[#85868b] hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Target platforms */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[#a5a6aa]">
                  Platforms
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={!ytAccount}
                    onClick={() => togglePlatform("youtube")}
                    className={`flex items-center justify-between rounded-lg border p-2.5 text-left text-xs transition ${
                      !ytAccount
                        ? "border-white/[0.05] bg-white/[0.01] text-[#5a5b60] cursor-not-allowed"
                        : targetPlatforms.includes("youtube")
                        ? "border-white/30 bg-white/10 text-white cursor-pointer"
                        : "border-white/[0.08] bg-white/[0.02] text-[#a5a6aa] cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-red-600 text-white shrink-0">
                        <YoutubeIcon className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">YouTube Shorts</div>
                        <div className="text-[10px] text-[#77787d] truncate">
                          {ytAccount ? ytAccount.handle : "Not connected"}
                        </div>
                      </div>
                    </div>
                    {targetPlatforms.includes("youtube") && (
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={!igAccount}
                    onClick={() => togglePlatform("instagram")}
                    className={`flex items-center justify-between rounded-lg border p-2.5 text-left text-xs transition ${
                      !igAccount
                        ? "border-white/[0.05] bg-white/[0.01] text-[#5a5b60] cursor-not-allowed"
                        : targetPlatforms.includes("instagram")
                        ? "border-white/30 bg-white/10 text-white cursor-pointer"
                        : "border-white/[0.08] bg-white/[0.02] text-[#a5a6aa] cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white shrink-0">
                        <InstagramIcon className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">Instagram Reels</div>
                        <div className="text-[10px] text-[#77787d] truncate">
                          {igAccount ? igAccount.handle : "Not connected"}
                        </div>
                      </div>
                    </div>
                    {targetPlatforms.includes("instagram") && (
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    )}
                  </button>
                </div>
              </div>

              {/* Clip selector or URL */}
              {availableClips.length > 0 && (
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                    Select generated clip
                  </label>
                  <select
                    value={selectedClipId}
                    onChange={(e) => handleClipSelect(e.target.value)}
                    className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white focus:border-white/25 focus:outline-none"
                  >
                    <option value="">Custom video URL...</option>
                    {availableClips.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                  Video URL (MP4 / public clip URL)
                </label>
                <div className="relative">
                  <Film size={13} className="absolute left-3 top-2.5 text-[#6f7075]" />
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] pl-8 pr-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Clip title for YouTube Shorts..."
                  className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                  Caption
                </label>
                <textarea
                  rows={2}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Post description..."
                  className="w-full rounded-md border border-white/[0.08] bg-[#0e0f11] p-2.5 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                    Date
                  </label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white focus:border-white/25 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                    Time
                  </label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white focus:border-white/25 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                  Hashtags
                </label>
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white font-mono focus:border-white/25 focus:outline-none"
                />
              </div>

              {modalError && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                  {modalError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleCreateSchedule(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.05] px-3.5 text-xs font-medium text-white hover:bg-white/[0.1] disabled:opacity-50 cursor-pointer"
                >
                  <Send size={13} />
                  <span>Publish now</span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleCreateSchedule(false)}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-[#F4F1E8] px-4 text-xs font-semibold text-[#151515] hover:bg-white disabled:opacity-50 cursor-pointer"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>Save to calendar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing Post Detail Modal */}
      {activePost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#141517] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-3.5">
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-[#85868b]">
                  {activePost.status}
                </span>
                <h3 className="truncate text-sm font-semibold text-white">{activePost.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePost(null)}
                className="rounded-md p-1 text-[#85868b] hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {activePost.caption && (
              <p className="text-xs text-[#a5a6aa] leading-relaxed">{activePost.caption}</p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {activePost.platforms.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white"
                >
                  {p === "youtube" ? (
                    <YoutubeIcon className="w-3 h-3 text-red-500" />
                  ) : (
                    <InstagramIcon className="w-3 h-3 text-pink-400" />
                  )}
                  <span className="capitalize">{p}</span>
                </span>
              ))}
            </div>

            {activePost.error_message && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                {activePost.error_message}
              </div>
            )}

            {activePost.publish_results && Object.keys(activePost.publish_results).length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
                {Object.entries(activePost.publish_results).map(([plat, res]) => (
                  <div key={plat} className="flex items-center justify-between gap-2">
                    <span className="capitalize text-[#a5a6aa]">{plat}</span>
                    {res.post_url ? (
                      <a
                        href={res.post_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                      >
                        <span>View post</span>
                        <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="text-red-300 text-[11px] truncate">{res.error || res.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activePost.status !== "published" && (
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="h-9 rounded-md border border-white/[0.08] bg-[#0e0f11] px-2.5 text-xs text-white"
                />
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="h-9 rounded-md border border-white/[0.08] bg-[#0e0f11] px-2.5 text-xs text-white"
                />
              </div>
            )}

            <div className="flex items-center justify-between border-t border-white/[0.07] pt-3">
              <button
                type="button"
                disabled={postBusy}
                onClick={handleDeletePost}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-red-300 hover:bg-red-500/10 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>

              {activePost.status !== "published" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={postBusy}
                    onClick={handleReschedule}
                    className="h-8 rounded-md border border-white/[0.1] px-3 text-xs text-white hover:bg-white/[0.06] cursor-pointer"
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    disabled={postBusy}
                    onClick={handlePublishNow}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#F4F1E8] px-3 text-xs font-semibold text-[#151515] hover:bg-white cursor-pointer"
                  >
                    {postBusy && <Loader2 size={12} className="animate-spin" />}
                    <span>Publish now</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* YouTube Auto-Upload Direct Connect Modal */}
      {isYtUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-white/[0.1] bg-[#141517] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
              <div className="flex items-center gap-2">
                <YoutubeIcon className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-semibold text-white">Connect YouTube Auto-Upload</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsYtUploadModalOpen(false)}
                className="rounded-md p-1 text-[#85868b] hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-white/[0.1] bg-white/[0.04] p-3 text-[11px] leading-relaxed text-[#b6b7bc] space-y-2">
              <p className="font-semibold text-white/90">How to get your OAuth Upload Token (2 minutes):</p>
              <ol className="list-decimal pl-4 space-y-1.5 text-[#9c9da3]">
                <li>
                  Open{" "}
                  <a
                    href="https://developers.google.com/oauthplayground/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-white underline decoration-white/40 hover:text-red-400"
                  >
                    Google OAuth 2.0 Playground <ExternalLink size={11} className="inline ml-0.5" />
                  </a>
                </li>
                <li>
                  In <strong>Step 1</strong> (&quot;Select &amp; authorize APIs&quot;), scroll down and expand <strong>YouTube Data API v3</strong>.
                </li>
                <li>
                  Check: <code className="text-emerald-400 font-mono text-[10px]">https://www.googleapis.com/auth/youtube.upload</code>
                </li>
                <li>
                  Click the blue <strong>Authorize APIs</strong> button and select your Google / YouTube account.
                </li>
                <li>
                  In <strong>Step 2</strong> (&quot;Exchange authorization code for tokens&quot;), click <strong>Exchange authorization code for tokens</strong>.
                </li>
                <li>
                  Copy the generated <strong>Access token</strong> (starts with <code className="text-white font-mono text-[10px]">ya29...</code>) and paste it below.
                </li>
              </ol>
            </div>

            <form onSubmit={handleConnectYtUpload} className="mt-4 space-y-3.5" autoComplete="off">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                  YouTube Channel ID or @Handle
                </label>
                <input
                  type="text"
                  value={ytUploadChannelId}
                  onChange={(e) => setYtUploadChannelId(e.target.value)}
                  placeholder="e.g. UCfitaW1RjKzcXd6Y_MT_72Q or @mychannel"
                  required
                  className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                  OAuth Access Token <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="password"
                  value={ytUploadAccessToken}
                  onChange={(e) => setYtUploadAccessToken(e.target.value)}
                  placeholder="ya29.a0..."
                  required
                  className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none font-mono"
                />
                <p className="mt-1 text-[10px] text-[#71727a]">
                  Access token with youtube.upload permission from OAuth 2.0 Playground.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                  Refresh Token <span className="text-[#6f7075]">(optional, enables automatic token renewals)</span>
                </label>
                <input
                  type="password"
                  value={ytUploadRefreshToken}
                  onChange={(e) => setYtUploadRefreshToken(e.target.value)}
                  placeholder="1//04..."
                  className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none font-mono"
                />
              </div>

              {ytUploadError && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                  {ytUploadError}
                </p>
              )}

              {ytUploadSuccess && (
                <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
                  {ytUploadSuccess}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsYtUploadModalOpen(false)}
                  className="h-9 rounded-md border border-white/[0.08] px-3.5 text-xs text-[#a5a6aa] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectingYtUpload}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-[#F4F1E8] px-4 text-xs font-semibold text-[#151515] hover:bg-white disabled:opacity-50 cursor-pointer"
                >
                  {connectingYtUpload && <Loader2 size={13} className="animate-spin" />}
                  <span>Connect Auto-Upload</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
