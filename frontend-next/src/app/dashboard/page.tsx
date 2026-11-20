"use client";

/**
 * /dashboard — RelatiV Creative Studio Master Dashboard
 * Design standard: Crisp edges (rounded-lg / rounded-xl), monochrome palette with subtle gold accents,
 * zero cheesy grids, zero double navbar. Matches OpusClip studio reference.
 */

import React, { Suspense, useState, useEffect, Component, type ErrorInfo, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  Video,
  Play,
  Share2,
  Sparkles,
  Crown,
  Calendar as CalendarIcon,
  Palette,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import StudioSidebar, { StudioTab } from "@/components/dashboard/StudioSidebar";
import StudioHeader from "@/components/dashboard/StudioHeader";
import StudioHero from "@/components/dashboard/StudioHero";
import UpgradeModal from "@/components/dashboard/UpgradeModal";
import AnalyseView from "@/components/dashboard/AnalyseView";
import SocialAccountsView from "@/components/dashboard/SocialAccountsView";
import ProjectsView from "@/components/dashboard/ProjectsView";
import AuthExportModal from "@/components/AuthExportModal";
import { useAuth } from "@/lib/AuthContext";
import { apiPath } from "@/lib/apiBase";
import { checkProcessingStatus, submitYouTubeUrl } from "@/lib/api";
import {
  getStoredProjects,
  createNewProject,
  updateProjectStatus,
  clearAllStoredProjects,
  type StoredProject,
} from "@/lib/projectStorage";
import type { Clip } from "@/types";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  const taskIdParam = searchParams.get("taskId");
  const urlParam = searchParams.get("url");
  const tabParam = searchParams.get("tab") as StudioTab | null;

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<StudioTab>(
    tabParam && ["home", "projects", "brand-kit", "assets", "calendar", "analyse", "socials"].includes(tabParam)
      ? tabParam
      : "home"
  );

  // Modals
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [pendingDownloadClip, setPendingDownloadClip] = useState<Clip | null>(null);

  // Projects State
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Active generation state (triggered by genuine URL or file intake)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(15);
  const [currentStepName, setCurrentStepName] = useState<string>("Analyzing video stream...");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load genuine projects from storage on mount
  useEffect(() => {
    const list = getStoredProjects();
    setProjects(list);
    if (list.length > 0 && !activeProjectId) {
      setActiveProjectId(list[0].id);
    }
  }, [activeProjectId]);

  const refreshProjects = () => {
    const list = getStoredProjects();
    setProjects(list);
    if (list.length > 0 && !activeProjectId) {
      setActiveProjectId(list[0].id);
    }
  };

  // Handle incoming taskId or url from VideoIntake redirect
  useEffect(() => {
    if (!taskIdParam && !urlParam) return;

    setActiveTab("home");
    const sourceName = urlParam ? "YouTube Video" : "Uploaded Video";
    const newProj = createNewProject(sourceName, taskIdParam || undefined);
    setProjects(getStoredProjects());
    setActiveProjectId(newProj.id);
    setIsGenerating(true);
    setElapsedSec(0);
    setGenerationProgress(20);

    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const startPolling = (tid: string) => {
      let consecutiveErrors = 0;
      pollInterval = setInterval(async () => {
        try {
          const status = await checkProcessingStatus(tid);
          if (!isMounted) return;
          consecutiveErrors = 0;

          if (status.status === "complete" && status.clips && status.clips.length > 0) {
            if (pollInterval) clearInterval(pollInterval);
            setIsGenerating(false);
            setGenerationProgress(100);
            updateProjectStatus(newProj.id, "ready", status.clips, 100);
            setProjects(getStoredProjects());
          } else if (status.status === "failed") {
            if (pollInterval) clearInterval(pollInterval);
            setIsGenerating(false);
            setGenerationError(status.error || "Generation could not be completed.");
            updateProjectStatus(newProj.id, "failed", [], 0);
            setProjects(getStoredProjects());
          } else {
            const raw =
              typeof status.progress === "number"
                ? status.progress > 1
                  ? status.progress
                  : status.progress * 100
                : 25;
            const progress = Math.min(95, Math.max(15, raw));
            setGenerationProgress(progress);
            if (status.step_name || status.current_step) {
              setCurrentStepName(status.step_name || status.current_step || "Analyzing video stream...");
            }
          }
        } catch {
          consecutiveErrors++;
          if (consecutiveErrors > 15) {
            if (pollInterval) clearInterval(pollInterval);
            setIsGenerating(false);
            setGenerationError(
              "Backend unreachable (502 / Host not found). Please verify your processing backend is running."
            );
            updateProjectStatus(newProj.id, "failed", [], 0);
            setProjects(getStoredProjects());
          }
        }
      }, 2500);
    };

    if (taskIdParam) {
      startPolling(taskIdParam);
    } else if (urlParam) {
      submitYouTubeUrl(urlParam)
        .then((init) => {
          if (!isMounted) return;
          if (init.taskId) {
            startPolling(init.taskId);
          } else {
            setTimeout(() => {
              if (!isMounted) return;
              setIsGenerating(false);
              setGenerationError("Backend did not return a task ID. Check backend logs.");
              updateProjectStatus(newProj.id, "failed", [], 0);
              setProjects(getStoredProjects());
            }, 1000);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setIsGenerating(false);
          setGenerationError(`Cannot connect to backend: ${err?.message || "Service offline"}.`);
          updateProjectStatus(newProj.id, "failed", [], 0);
          setProjects(getStoredProjects());
        });
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [taskIdParam, urlParam]);

  // Elapsed timer when generation is active
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
      setGenerationProgress((prev) => (prev < 90 ? prev + 3 : prev));
    }, 1000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Active genuine project
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  // Real download handler
  const handleRequestDownload = (clip: Clip) => {
    executeDownload(clip);
  };

  const executeDownload = (clip: Clip) => {
    const a = document.createElement("a");
    const downloadHref = clip.download_url
      ? clip.download_url.startsWith("http")
        ? clip.download_url
        : apiPath(clip.download_url)
      : clip.file_path && clip.file_path.startsWith("http")
      ? clip.file_path
      : apiPath(`/download/${clip.clip_id}`);
    a.href = downloadHref;
    a.download = `${clip.clip_id || "relativ_clip"}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-[#09090C] text-white items-center justify-center font-sans">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#09090C] text-white selection:bg-white selection:text-black font-sans">
      {/* ── Studio Sidebar (Flush to top, sharp edges) ── */}
      <StudioSidebar
        activeTab={activeTab}
        onSelectTab={(t) => setActiveTab(t)}
        onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
      />

      {/* ── Main Studio Stage ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header & Upgrade Banner */}
        <StudioHeader onOpenUpgrade={() => setIsUpgradeModalOpen(true)} />

        {/* Content Pane */}
        <main className="flex-1 w-full min-w-0 max-w-[1800px] mx-auto p-5 sm:p-8 xl:p-10 space-y-8">
          {/* TAB 1: HOME STUDIO */}
          {activeTab === "home" && (
            <div className="space-y-8">
              {/* Studio Central Hero Intake Station */}
              <StudioHero
                onStartProcess={(tid) => {
                  router.push(`/dashboard?taskId=${tid}`);
                }}
                onSubmitUrl={(u) => {
                  router.push(`/dashboard?url=${encodeURIComponent(u)}`);
                }}
                onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
              />

              {/* ── ACTIVE GENERATION / WAITING STATE ── */}
              {isGenerating && (
                <div className="rounded-xl border border-white/10 bg-[#121215] p-6 text-center space-y-4 shadow-xl">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium bg-white/5 border border-white/10 text-zinc-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span>Processing 9:16 Vertical Video</span>
                  </div>

                  <div className="max-w-md mx-auto space-y-1.5">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {currentStepName || "RelatiV Engine is analyzing your video..."}
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Detecting peak retention moments, reframing face positions, and rendering subtitles.
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="max-w-md mx-auto space-y-1.5">
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full bg-white rounded-full"
                        animate={{ width: `${generationProgress}%` }}
                        transition={{ ease: "easeInOut", duration: 0.5 }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                      <span>{generationProgress}% complete</span>
                      <span>{elapsedSec}s elapsed</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Error Banner ── */}
              {generationError && !isGenerating && (
                <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-3 text-xs text-rose-300">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{generationError}</span>
                  </div>
                  <button
                    onClick={() => setGenerationError(null)}
                    className="text-xs text-rose-300 hover:text-white underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* ── GENUINE CLIPS VAULT ── */}
              {activeProject && activeProject.status === "ready" && (activeProject.clips?.length || 0) > 0 && (
                <div className="space-y-5 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span>{activeProject.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-zinc-200 border border-white/10 font-medium">
                          {activeProject.clips?.length || 0} Clips
                        </span>
                      </h2>
                      <span suppressHydrationWarning className="text-xs text-zinc-500 mt-0.5 block">
                        Generated {activeProject.createdAt ? new Date(activeProject.createdAt).toLocaleDateString() : "Today"} · 1080×1920 60FPS
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setActiveTab("socials")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 bg-white/5 hover:bg-white/10 text-white transition cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Publish to Socials</span>
                      </button>

                      <button
                        onClick={() => {
                          if (activeProject.clips?.[0]) handleRequestDownload(activeProject.clips[0]);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-white text-black hover:bg-zinc-200 transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download All</span>
                      </button>
                    </div>
                  </div>

                  {/* 9:16 Vertical Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {(activeProject.clips || []).map((clip, index) => (
                      <ClipCard
                        key={clip.clip_id || index}
                        clip={clip}
                        index={index}
                        onRequestDownload={() => handleRequestDownload(clip)}
                        onCrossPublish={() => setActiveTab("socials")}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Empty Vault ── */}
              {!isGenerating && (!activeProject || (activeProject.clips?.length || 0) === 0) && (
                <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-10 text-center space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h3 className="font-medium text-sm text-white">
                      Your generated clips will appear here
                    </h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Drop a YouTube link above or upload video footage to extract clips.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY PROJECTS */}
          {activeTab === "projects" && (
            <ProjectsView
              projects={projects}
              onSelectProject={(id) => {
                setActiveProjectId(id);
                setActiveTab("home");
              }}
              onRefresh={refreshProjects}
              onNewClip={() => setActiveTab("home")}
            />
          )}

          {/* TAB 3: ANALYSE */}
          {activeTab === "analyse" && <AnalyseView />}

          {/* TAB 4: SOCIAL ACCOUNTS & CROSS-PLATFORM PUBLISHER */}
          {activeTab === "socials" && <SocialAccountsView />}

          {/* TAB 5: BRAND KIT (PRO GATED) */}
          {activeTab === "brand-kit" && (
            <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-10 text-center space-y-4">
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mx-auto">
                <Palette className="w-5 h-5" />
              </div>
              <div className="max-w-sm mx-auto space-y-1.5">
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  👑 Pro Feature
                </span>
                <h2 className="text-base font-bold text-white">Brand Kits & Custom Watermarks</h2>
                <p className="text-xs text-zinc-400">
                  Set custom brand fonts, logo stamps, and remove default watermark exports across all generated clips.
                </p>
              </div>
              <button
                onClick={() => setIsUpgradeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Upgrade to Pro ($11.99/mo)</span>
              </button>
            </div>
          )}

          {/* TAB 6: ASSET LIBRARY */}
          {activeTab === "assets" && (
            <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-10 text-center space-y-4">
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mx-auto">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div className="max-w-sm mx-auto space-y-1.5">
                <h2 className="text-base font-bold text-white">Asset & B-roll Library</h2>
                <p className="text-xs text-zinc-400">
                  Store custom audio stingers, overlay memes, and video assets for your clips.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("home")}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition cursor-pointer"
              >
                <span>Back to Home Studio</span>
              </button>
            </div>
          )}

          {/* TAB 7: CALENDAR */}
          {activeTab === "calendar" && (
            <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-10 text-center space-y-4">
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mx-auto">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div className="max-w-sm mx-auto space-y-1.5">
                <h2 className="text-base font-bold text-white">Publishing Calendar</h2>
                <p className="text-xs text-zinc-400">
                  Plan and queue your upcoming drops across YouTube Shorts, TikTok, and Instagram Reels.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("socials")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Go to Socials Scheduler</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── MODALS ── */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />

      <AuthExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        clipTitle={pendingDownloadClip?.viral_title}
      />
    </div>
  );
}

/**
 * 9:16 Vertical Clip Card (Sharp edges, clean monochrome)
 */
function ClipCard({
  clip,
  index,
  onRequestDownload,
  onCrossPublish,
}: {
  clip: Clip;
  index: number;
  onRequestDownload: () => void;
  onCrossPublish: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const videoUrl = clip.download_url
    ? clip.download_url.startsWith("http")
      ? clip.download_url
      : apiPath(clip.download_url)
    : clip.file_path && clip.file_path.startsWith("http")
    ? clip.file_path
    : apiPath(`/download/${clip.clip_id}`);

  const posterUrl = clip.thumbnail_url
    ? clip.thumbnail_url.startsWith("http")
      ? clip.thumbnail_url
      : apiPath(clip.thumbnail_url)
    : clip.clip_id
    ? apiPath(`/thumbnail/${clip.clip_id}`)
    : undefined;

  const handleCopyCaption = () => {
    const text = `${clip.viral_title || ""}\n\n${clip.caption || ""}\n\n${clip.hashtags || ""}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#121215] overflow-hidden flex flex-col justify-between shadow-lg group hover:border-white/20 transition-all font-sans">
      {/* 9:16 Aspect Frame */}
      <div className="relative aspect-[9/16] w-full bg-black overflow-hidden flex items-center justify-center">
        {!videoError ? (
          <video
            src={videoUrl}
            poster={posterUrl}
            className="w-full h-full object-cover"
            controls
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
          />
        ) : (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={clip.viral_title || "Clip thumbnail"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-[#121215] flex items-center justify-center">
                <Video className="w-8 h-8 text-zinc-600" />
              </div>
            )}
            <button
              onClick={onRequestDownload}
              className="absolute inset-0 m-auto w-12 h-12 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all cursor-pointer"
            >
              <Play className="w-5 h-5 text-white ml-0.5 fill-white" />
            </button>
          </div>
        )}

        {/* Hook Score Badge */}
        {typeof clip.hook_score === "number" && (
          <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white text-black shadow-md">
              ⚡ {clip.hook_score}/100
            </span>
          </div>
        )}

        {/* Duration */}
        <div className="absolute bottom-2.5 right-2.5 z-10 pointer-events-none">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-black/80 text-zinc-300 backdrop-blur-sm">
            {clip.duration_s ? `${clip.duration_s.toFixed(0)}s` : "9:16"}
          </span>
        </div>
      </div>

      {/* Card Info */}
      <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-xs text-white line-clamp-1">
            {clip.viral_title || `Clip #${index + 1}`}
          </h3>
          {clip.caption && (
            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
              {clip.caption}
            </p>
          )}
        </div>

        {/* Action Buttons (Clean rounded-lg) */}
        <div className="pt-1 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onRequestDownload}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 px-2.5 text-xs font-semibold text-black bg-white hover:bg-zinc-200 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              onClick={handleCopyCaption}
              className="inline-flex items-center justify-center gap-1 rounded-md py-1.5 px-2.5 text-xs font-medium text-zinc-300 bg-white/[0.05] hover:bg-white/10 border border-white/10 transition cursor-pointer"
              title="Copy caption"
            >
              {copied ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <button
            onClick={onCrossPublish}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 px-2 text-[11px] font-medium text-zinc-300 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] transition cursor-pointer"
          >
            <Share2 className="w-3 h-3 text-zinc-400" />
            <span>Publish to Socials</span>
          </button>
        </div>
      </div>
    </div>
  );
}

class DashboardErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("Studio caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090C] flex flex-col items-center justify-center p-6 text-center text-white font-sans">
          <div className="max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#121216] p-8 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-white">Studio Session Recovered</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              A temporary browser state occurred. Click below to refresh your workspace.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition cursor-pointer"
              >
                Reload Studio
              </button>
              <button
                onClick={() => {
                  clearAllStoredProjects();
                  this.setState({ hasError: false, error: null });
                  window.location.href = "/dashboard";
                }}
                className="w-full py-2 px-4 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white font-medium text-xs transition cursor-pointer"
              >
                Reset Studio Cache
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DashboardPage() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-[#09090C]" />}>
        <DashboardContent />
      </Suspense>
    </DashboardErrorBoundary>
  );
}
