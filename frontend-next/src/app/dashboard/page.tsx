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
  Palette,
  FolderOpen,
  RefreshCw,
  Calendar,
  Zap,
  Pencil,
} from "lucide-react";
import StudioSidebar, { StudioTab } from "@/components/dashboard/StudioSidebar";
import StudioHeader from "@/components/dashboard/StudioHeader";
import StudioHero from "@/components/dashboard/StudioHero";
import UpgradeModal from "@/components/dashboard/UpgradeModal";
import ClipInspectorModal from "@/components/ClipInspectorModal";
import ClipEditorModal from "@/components/dashboard/editor/ClipEditorModal";
import VideoProcessingView from "@/components/VideoProcessingView";
import AnalyseView from "@/components/dashboard/AnalyseView";
import SocialAccountsView from "@/components/dashboard/SocialAccountsView";
import ProjectsView from "@/components/dashboard/ProjectsView";
import CalendarView from "@/components/dashboard/CalendarView";
import EditStudioView from "@/components/dashboard/EditStudioView";
import AuthExportModal from "@/components/AuthExportModal";
import { useAuth } from "@/lib/AuthContext";
import { getPolarCheckoutUrl } from "@/lib/polar";
import { authPageHref } from "@/lib/auth-destination";
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
  const { user, refresh: refreshUser } = useAuth();
  const [mounted, setMounted] = useState(false);

  const taskIdParam = searchParams.get("taskId");
  const urlParam = searchParams.get("url");
  const captionStyleParam = searchParams.get("captionStyle");
  const tailBufferParam = searchParams.get("tailBuffer");
  const thumbnailOutroParam = searchParams.get("thumbnailOutro");
  const paymentSucceeded = searchParams.get("payment") === "success";
  const tabParam = searchParams.get("tab") as StudioTab | null;

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<StudioTab>(
    tabParam && ["home", "edit-studio", "projects", "brand-kit", "assets", "calendar", "analyse", "socials"].includes(tabParam)
      ? tabParam
      : "home"
  );

  // Modals
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [pendingDownloadClip, setPendingDownloadClip] = useState<Clip | null>(null);
  const [inspectedClip, setInspectedClip] = useState<{ clip: Clip; index: number } | null>(null);
  const [selectedEditClip, setSelectedEditClip] = useState<{ clip: Clip; index: number } | null>(null);

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

  useEffect(() => {
    if (!paymentSucceeded) return;
    void refreshUser();
    const timer = window.setTimeout(() => void refreshUser(), 2500);
    return () => window.clearTimeout(timer);
  }, [paymentSucceeded, refreshUser]);

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
      try {
        window.localStorage.setItem(
          "relativ:active-job",
          JSON.stringify({ taskId: tid, url: urlParam || null, savedAt: Date.now() })
        );
      } catch {
        // Query-string taskId remains sufficient when storage is unavailable.
      }
      if (taskIdParam !== tid) {
        router.replace(`/dashboard?taskId=${encodeURIComponent(tid)}`);
      }
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
            window.localStorage.removeItem("relativ:active-job");
          } else if (status.status === "failed") {
            if (pollInterval) clearInterval(pollInterval);
            setIsGenerating(false);
            setGenerationError(status.error || "Generation could not be completed.");
            updateProjectStatus(newProj.id, "failed", [], 0);
            setProjects(getStoredProjects());
            window.localStorage.removeItem("relativ:active-job");
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
      try {
        const saved = JSON.parse(window.localStorage.getItem("relativ:active-job") || "null") as
          | { taskId?: string; url?: string; savedAt?: number }
          | null;
        const fresh = saved?.savedAt && Date.now() - saved.savedAt < 24 * 60 * 60 * 1000;
        if (saved?.taskId && saved.url === urlParam && fresh) {
          startPolling(saved.taskId);
          return () => {
            isMounted = false;
            if (pollInterval) clearInterval(pollInterval);
          };
        }
      } catch {
        // Invalid storage should never block a legitimate new submission.
      }
      let captionStyle: Record<string, unknown> | undefined;
      try { captionStyle = captionStyleParam ? JSON.parse(captionStyleParam) : undefined; } catch { captionStyle = undefined; }
      submitYouTubeUrl(urlParam, {
        captionStyle,
        tailBufferSeconds: tailBufferParam === "0" ? 0 : 3,
        thumbnailOutroSeconds: thumbnailOutroParam === "0" ? 0 : 4,
      })
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
  }, [router, taskIdParam, urlParam, captionStyleParam, tailBufferParam, thumbnailOutroParam]);

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
    <div className="flex min-h-screen bg-[#111214] text-white selection:bg-[#E7B84B] selection:text-black font-sans">
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
        <main className="flex-1 w-full min-w-0 max-w-[1480px] mx-auto p-5 pb-24 sm:p-8 sm:pb-24 lg:pb-10 xl:px-12 xl:py-10 space-y-8">
          {paymentSucceeded && (
            <div role="status" className="mx-auto flex max-w-5xl items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div><span className="font-semibold">Upgrade confirmed.</span> Your plan and credit balance are refreshing now.</div>
            </div>
          )}
          {/* TAB 1: HOME STUDIO */}
          {activeTab === "home" && (
            <div className="mx-auto max-w-[1120px] space-y-6 sm:space-y-7">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a9ba1]">
                    <span className="size-1.5 rounded-full bg-[#E7B84B]" />
                    Creator workspace
                  </div>
                  <h1 className="text-[clamp(1.8rem,3vw,2.5rem)] font-semibold leading-tight tracking-[-0.045em] text-[#F4F1E8]">Make a clip from any long video.</h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#9a9ba1]">Add a source and RelatiV will find the strongest moments, frame the subject, and finish your captions.</p>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs text-[#b9b9bd]">
                  <Zap className="size-3.5 text-[#E7B84B]" />
                  200 credits per finished clip
                </div>
              </div>
              {/* Studio Central Hero Intake Station */}
              <StudioHero
                onStartProcess={(tid) => {
                  router.push(`/dashboard?taskId=${tid}`);
                }}
                onSubmitUrl={(u, config) => {
                  const styleQuery = config.captionStyle ? `&captionStyle=${encodeURIComponent(JSON.stringify(config.captionStyle))}` : "";
                  const finishQuery = `&tailBuffer=${config.includeNaturalTail ? 3 : 0}&thumbnailOutro=${config.includeThumbnailOutro ? 4 : 0}`;
                  router.push(`/dashboard?url=${encodeURIComponent(u)}${styleQuery}${finishQuery}`);
                }}
                onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
                hasEditableClip={Boolean(activeProject?.clips?.length)}
                onOpenEditor={() => {
                  const clip = activeProject?.clips?.[0];
                  if (clip) setSelectedEditClip({ clip, index: 0 });
                }}
              />

              {/* ── ACTIVE GENERATION / WAITING STATE (Thinking AI Blob + Green Filling Thumbnail) ── */}
              {isGenerating && (
                <div className="rounded-2xl border border-white/10 bg-[#121215]/80 backdrop-blur-xl p-4 sm:p-6 shadow-2xl">
                  <VideoProcessingView
                    thumbnailUrl={activeProject?.clips?.[0]?.thumbnail_url || null}
                    progress={generationProgress}
                  />
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
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                    <div>
                      <h2 className="text-base sm:text-lg font-medium text-zinc-200">
                        {activeProject.title && activeProject.title !== "My Clips Project"
                          ? activeProject.title
                          : "Give me highlight compilations of all the exciting moments in this video"}{" "}
                        <span className="text-zinc-400 font-normal">({activeProject.clips?.length || 0})</span>
                      </h2>
                      <span suppressHydrationWarning className="text-xs text-zinc-500 mt-0.5 block">
                        Generated {activeProject.createdAt ? new Date(activeProject.createdAt).toLocaleDateString() : "Today"} · 1080×1920 Vertical HD
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

                  {/* 9:16 Vertical Grid matching Opus Clip exact style */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                    {(activeProject.clips || []).map((clip, index) => (
                      <ClipCard
                        key={clip.clip_id || index}
                        clip={clip}
                        index={index}
                        onSelect={() => setInspectedClip({ clip, index })}
                        onRequestDownload={() => handleRequestDownload(clip)}
                        onSchedule={() => setInspectedClip({ clip, index })}
                        onEdit={() => setSelectedEditClip({ clip, index })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Empty Vault ── */}
              {!isGenerating && (!activeProject || (activeProject.clips?.length || 0) === 0) && (
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#151619] px-5 py-8 sm:px-8 sm:py-9">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(231,184,75,0.08),transparent_55%)]" />
                  <div className="relative mx-auto flex max-w-lg flex-col items-center text-center">
                    <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-white/[0.1] bg-white/[0.04] text-[#d7d4ca] shadow-[inset_0_1px_rgba(255,255,255,.06)]">
                      <Video className="size-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-[#F4F1E8]">Your clips will show up here</h3>
                    <p className="mt-1.5 text-xs leading-5 text-[#85868c]">Paste a video link or upload footage to create your first set of clips.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY PROJECTS */}
          {activeTab === "edit-studio" && (
            <EditStudioView
              projects={projects}
              onEdit={(clip, index) => setSelectedEditClip({ clip, index })}
              onCreateClip={() => setActiveTab("home")}
            />
          )}

          {/* TAB 3: MY PROJECTS */}
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
            <CalendarView onSchedule={() => setActiveTab("socials")} />
          )}
        </main>
      </div>

      {/* ── MODALS ── */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onSelectPlan={(planKey) => {
          if (!user) {
            router.push(`/signup?plan=${encodeURIComponent(planKey)}&next=/dashboard`);
            return;
          }
          const checkoutUrl = getPolarCheckoutUrl(planKey, user);
          window.location.href = checkoutUrl;
        }}
      />

      <AuthExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        clipTitle={pendingDownloadClip?.viral_title}
      />

      {/* ── OpusClip Master Clip Inspector & YouTube Shorts Scheduler ── */}
      <ClipInspectorModal
        clip={inspectedClip?.clip || null}
        index={inspectedClip?.index || 0}
        isOpen={!!inspectedClip}
        onClose={() => setInspectedClip(null)}
        onRequestDownload={(c) => handleRequestDownload(c)}
        onOpenEditor={(clip) => {
          setInspectedClip(null);
          const index = activeProject?.clips.findIndex((candidate) => candidate.clip_id === clip.clip_id) ?? 0;
          setSelectedEditClip({ clip, index: Math.max(0, index) });
        }}
      />
      <ClipEditorModal
        clip={selectedEditClip?.clip || null}
        index={selectedEditClip?.index || 0}
        onClose={() => setSelectedEditClip(null)}
        onSaveSuccess={(updated) => {
          if (!activeProject) return;
          const clips = (activeProject.clips || []).map((item) => item.clip_id === updated.clip_id ? updated : item);
          updateProjectStatus(activeProject.id, "ready", clips, 100);
          setProjects(getStoredProjects());
        }}
      />
    </div>
  );
}

/**
 * 9:16 Vertical Clip Card (OpusClip exact match: clean poster, neon score, schedule & download icons)
 */
function ClipCard({
  clip,
  index,
  onSelect,
  onRequestDownload,
  onSchedule,
  onEdit,
}: {
  clip: Clip;
  index: number;
  onSelect: () => void;
  onRequestDownload: () => void;
  onSchedule: () => void;
  onEdit: () => void;
}) {
  const [videoError, setVideoError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const posterUrl = clip.thumbnail_url
    ? clip.thumbnail_url.startsWith("http")
      ? clip.thumbnail_url
      : apiPath(clip.thumbnail_url)
    : clip.clip_id
    ? apiPath(`/thumbnail/${clip.clip_id}`)
    : undefined;

  const score =
    typeof clip.hook_score === "number" && clip.hook_score > 0
      ? clip.hook_score
      : typeof clip.story_score === "number" && clip.story_score > 0
      ? clip.story_score
      : typeof (clip as any).score === "number" && (clip as any).score > 0
      ? (clip as any).score
      : Math.max(72, 91 - index * 5);
  const durationSec = clip.duration_s || 60;
  const mins = Math.floor(durationSec / 60).toString().padStart(2, "0");
  const secs = Math.floor(durationSec % 60).toString().padStart(2, "0");

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col justify-between rounded-xl overflow-hidden cursor-pointer transition-all duration-300 font-sans"
    >
      {/* 9:16 Aspect Frame */}
      <div className="relative aspect-[9/16] w-full bg-[#0d0e12] rounded-xl overflow-hidden border border-white/10 group-hover:border-emerald-500/50 shadow-md group-hover:shadow-[0_8px_30px_rgba(16,185,129,0.18)] transition-all">
        {posterUrl && (
          <img
            src={posterUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-125 pointer-events-none"
          />
        )}
        {posterUrl && !videoError ? (
          <img
            src={posterUrl}
            alt={clip.viral_title || "Clip thumbnail"}
            className="relative z-10 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setVideoError(true)}
          />
        ) : (
          <div className="relative z-10 w-full h-full bg-[#141418] flex items-center justify-center">
            <Video className="w-8 h-8 text-zinc-600" />
          </div>
        )}

        {/* Play Icon Overlay on Hover */}
        <div
          className={`absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] flex items-center justify-center transition-opacity duration-200 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center shadow-2xl pl-1 group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 fill-black" />
          </div>
        </div>

        {/* Timecode Badge (e.g. 00:00 01:13) */}
        <div className="absolute bottom-2.5 right-2.5 z-20 pointer-events-none">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-black/85 text-zinc-200 backdrop-blur-md border border-white/10">
            00:00 {mins}:{secs}
          </span>
        </div>
      </div>

      {/* Metadata Row below card (Score + Schedule + Download) */}
      <div className="pt-2.5 pb-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          {/* Neon Virality Score */}
          <span className="font-mono text-xl font-bold text-[#22c55e] tracking-tight leading-none drop-shadow-[0_0_8px_rgba(34,197,94,0.35)]">
            {score}
          </span>

          {/* Quick Action Icons: Schedule & Download matching reference */}
          <div className="flex items-center gap-1.5">
            {/* Calendar / Schedule Icon */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSchedule();
              }}
              title="Schedule to YouTube Shorts"
              className="p-1 rounded text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
            </button>

            {/* Download Icon */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestDownload();
              }}
              title="Download clip"
              className="p-1 rounded text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-medium text-xs text-zinc-200 line-clamp-2 leading-snug group-hover:text-white transition-colors">
          {clip.viral_title || `Clip #${index + 1}`}
        </h3>
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

function DashboardEntry() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading || user) return;
    const query = searchParams.toString();
    const next = query ? `/dashboard?${query}` : "/dashboard";
    router.replace(`${authPageHref("/login", next)}&auth_error=session`);
  }, [loading, user, router, searchParams]);

  return user ? <DashboardContent /> : <div className="min-h-screen bg-[#09090C]" />;
}

export default function DashboardPage() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-[#09090C]" />}>
        <DashboardEntry />
      </Suspense>
    </DashboardErrorBoundary>
  );
}
