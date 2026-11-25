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
  Pencil,
  ArrowLeft,
  EllipsisVertical,
} from "lucide-react";
import StudioSidebar, { StudioTab } from "@/components/dashboard/StudioSidebar";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
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
import ClipThumbnail from "@/components/dashboard/ClipThumbnail";
import AuthExportModal from "@/components/AuthExportModal";
import { useAuth } from "@/lib/AuthContext";
import { getPolarCheckoutUrl } from "@/lib/polar";
import { authPageHref } from "@/lib/auth-destination";
import { apiPath } from "@/lib/apiBase";
import { checkProcessingStatus, getActiveProcessingTasks, submitYouTubeUrl } from "@/lib/api";
import {
  getStoredProjects,
  createNewProject,
  updateProjectStatus,
  updateProjectTaskId,
  updateProjectSource,
  clearAllStoredProjects,
  type StoredProject,
} from "@/lib/projectStorage";
import { getYouTubeThumbnail } from "@/lib/youtube";
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
  const tabParam = searchParams.get("tab") as StudioTab | "edit-studio" | null;

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<StudioTab>(
    tabParam === "edit-studio" ? "projects" : tabParam && ["home", "projects", "brand-kit", "assets", "calendar", "analyse", "socials"].includes(tabParam)
      ? tabParam
      : "home"
  );

  // Modals
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [pendingDownloadClip, setPendingDownloadClip] = useState<Clip | null>(null);
  const [inspectedClip, setInspectedClip] = useState<{ clip: Clip; index: number } | null>(null);
  const [selectedEditClip, setSelectedEditClip] = useState<{ clip: Clip; index: number; projectId: string } | null>(null);

  // Projects State
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [vaultProjectId, setVaultProjectId] = useState<string | null>(null);

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

  useEffect(() => {
    setProjects(getStoredProjects());
  }, []);

  const refreshProjects = () => setProjects(getStoredProjects());

  // Handle incoming taskId or url from VideoIntake redirect
  useEffect(() => {
    if (!taskIdParam && !urlParam) {
      let cancelled = false;
      void (async () => {
        // Verify with backend first so stale localStorage never locks UI,
        // and any real active backend job locks UI into "Processing..."
        const live = await getActiveProcessingTasks();
        if (cancelled) return;
        if (live.active && live.tasks.length > 0) {
          router.replace(`/dashboard?taskId=${encodeURIComponent(live.tasks[0].task_id)}`);
          return;
        }
        try {
          window.localStorage.removeItem("relativ:active-job");
        } catch {}
      })();
      return () => {
        cancelled = true;
      };
    }

    let restoredTaskId = taskIdParam || undefined;
    if (!restoredTaskId && urlParam) {
      try {
        const saved = JSON.parse(window.localStorage.getItem("relativ:active-job") || "null") as
          | { taskId?: string; url?: string; savedAt?: number }
          | null;
        const fresh = saved?.savedAt && Date.now() - saved.savedAt < 24 * 60 * 60 * 1000;
        if (saved?.taskId && saved.url === urlParam && fresh) restoredTaskId = saved.taskId;
      } catch {}
    }

    const existing = getStoredProjects().find((project) => restoredTaskId && project.taskId === restoredTaskId);
    if (existing && existing.status === "ready" && existing.clips.length > 0) {
      try {
        const pendingJob = JSON.parse(window.localStorage.getItem("relativ:active-job") || "null");
        if (pendingJob?.taskId === restoredTaskId) {
          setActiveProjectId(existing.id);
          window.localStorage.removeItem("relativ:active-job");
        }
      } catch {}
      setIsGenerating(false);
      router.replace("/dashboard");
      return;
    }

    setActiveTab("home");
    const sourceName = urlParam ? "YouTube Video" : "Uploaded Video";
    const newProj = existing || createNewProject(sourceName, restoredTaskId);
    setProjects(getStoredProjects());
    setActiveProjectId(newProj.id);
    setIsGenerating(true);
    setElapsedSec(0);
    setGenerationProgress(20);

    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const startPolling = (tid: string) => {
      updateProjectTaskId(newProj.id, tid);
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
      const pollOnce = async () => {
        try {
          const status = await checkProcessingStatus(tid);
          if (!isMounted) return;
          consecutiveErrors = 0;
          updateProjectSource(newProj.id, status.source_name, status.source_thumbnail_url);

          if (status.status === "complete" && status.clips && status.clips.length > 0) {
            if (pollInterval) clearInterval(pollInterval);
            setIsGenerating(false);
            setGenerationError(null);
            setGenerationProgress(100);
            updateProjectStatus(newProj.id, "ready", status.clips, 100);
            setProjects(getStoredProjects());
            window.localStorage.removeItem("relativ:active-job");
            router.replace("/dashboard");
          } else if (status.status === "failed") {
            if (pollInterval) clearInterval(pollInterval);
            setIsGenerating(false);
            setGenerationError(status.error || "Generation could not be completed.");
            updateProjectStatus(newProj.id, "failed", [], 0);
            setProjects(getStoredProjects());
            window.localStorage.removeItem("relativ:active-job");
            router.replace("/dashboard");
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
      };
      void pollOnce();
      pollInterval = setInterval(() => void pollOnce(), 2500);
    };

    if (restoredTaskId) {
      startPolling(restoredTaskId);
    } else if (urlParam) {
      let captionStyle: Record<string, unknown> | undefined;
      try { captionStyle = captionStyleParam ? JSON.parse(captionStyleParam) : undefined; } catch { captionStyle = undefined; }
      void (async () => {
        try {
          // On page reload with ?url=..., check if this job is already running
          // on the backend instead of submitting a duplicate job that hits the
          // plan's active-task concurrency limit.
          const live = await getActiveProcessingTasks();
          if (!isMounted) return;
          if (live.active && live.tasks.length > 0) {
            startPolling(live.tasks[0].task_id);
            return;
          }
          const init = await submitYouTubeUrl(urlParam, {
            captionStyle,
            tailBufferSeconds: tailBufferParam === "0" ? 0 : 5,
            thumbnailOutroSeconds: thumbnailOutroParam === "0" ? 0 : 4,
          });
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
        } catch (err: unknown) {
          if (!isMounted) return;
          const msg = err instanceof Error ? err.message : "Service offline";
          if (msg.toLowerCase().includes("active processing task")) {
            const live = await getActiveProcessingTasks();
            if (!isMounted) return;
            if (live.active && live.tasks.length > 0) {
              startPolling(live.tasks[0].task_id);
              return;
            }
          }
          setIsGenerating(false);
          setGenerationError(msg);
          updateProjectStatus(newProj.id, "failed", [], 0);
          setProjects(getStoredProjects());
        }
      })();
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
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const vaultProject = projects.find((project) => project.id === vaultProjectId);

  // Whenever the active project is ready or has completed clips, ensure generation state is dismissed
  useEffect(() => {
    if (activeProject && activeProject.status === "ready" && (activeProject.clips?.length || 0) > 0) {
      setIsGenerating(false);
      if (activeTab !== "home") setActiveProjectId(null);
    }
  }, [activeTab, activeProject?.id, activeProject?.status, activeProject?.clips?.length]);

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

  const renderProjectClips = (project: StoredProject, showEditAction = false) => (
    <div className="space-y-4 pt-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-zinc-200">
            {project.title && project.title !== "My Clips Project"
              ? project.title
              : "Give me highlight compilations of all the exciting moments in this video"}{" "}
            <span className="text-zinc-400 font-normal">({project.clips?.length || 0})</span>
          </h2>
          <span suppressHydrationWarning className="text-xs text-zinc-500 mt-0.5 block">
            Generated {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : "Today"} · 1080×1920 Vertical HD
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
              if (project.clips?.[0]) handleRequestDownload(project.clips[0]);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-white text-black hover:bg-zinc-200 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download All</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 py-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4">
        {(project.clips || []).map((clip, index) => (
          <ClipCard
            key={clip.clip_id || index}
            clip={clip}
            index={index}
            onSelect={() => setInspectedClip({ clip, index })}
            onRequestDownload={() => handleRequestDownload(clip)}
            onSchedule={() => setInspectedClip({ clip, index })}
            onEdit={showEditAction ? () => setSelectedEditClip({ clip, index, projectId: project.id }) : undefined}
          />
        ))}
      </div>
    </div>
  );

  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-[#09090C] text-white items-center justify-center font-sans">
        <DashboardLoading />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen text-white selection:bg-[#E7B84B] selection:text-black font-sans">
      {/* ── Studio Sidebar (Flush to top, sharp edges) ── */}
      <StudioSidebar
        activeTab={activeTab}
        onSelectTab={(t) => setActiveTab(t)}
      />

      {/* ── Main Studio Stage ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header & Upgrade Banner */}
        <StudioHeader projects={projects} onOpenUpgrade={() => setIsUpgradeModalOpen(true)} />

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
              <h1 className="mx-auto text-center text-[clamp(1.8rem,3vw,2.5rem)] font-semibold leading-tight tracking-[-0.045em] text-[#F4F1E8]">Make a clip from any long video.</h1>
              {/* Studio Central Hero Intake Station */}
              <StudioHero
                isGenerating={isGenerating}
                onStartProcess={(tid) => {
                  router.push(`/dashboard?taskId=${tid}`);
                }}
                onSubmitUrl={(u, config) => {
                  const styleQuery = config.captionStyle ? `&captionStyle=${encodeURIComponent(JSON.stringify(config.captionStyle))}` : "";
                  const finishQuery = `&tailBuffer=${config.includeNaturalTail ? 5 : 0}&thumbnailOutro=${config.includeThumbnailOutro ? 4 : 0}`;
                  router.push(`/dashboard?url=${encodeURIComponent(u)}${styleQuery}${finishQuery}`);
                }}
                onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
              />

              {/* ── ACTIVE GENERATION / WAITING STATE (Only when actively processing and project is not ready) ── */}
              {isGenerating && (!activeProject || (activeProject.status !== "ready" && (activeProject.clips?.length || 0) === 0)) && (
                <div className="rounded-2xl border border-white/10 bg-[#121215]/80 backdrop-blur-xl p-4 sm:p-6 shadow-2xl">
                  <VideoProcessingView
                    thumbnailUrl={
                      getYouTubeThumbnail(urlParam) ||
                      activeProject?.clips?.[0]?.thumbnail_url ||
                      null
                    }
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

              {activeProject?.status === "ready" && !!activeProject.clips?.length && renderProjectClips(activeProject)}

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

          {activeTab === "projects" && (
            vaultProject ? (
              <section className="space-y-5">
                <button
                  type="button"
                  onClick={() => setVaultProjectId(null)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back to Clip Vault
                </button>
                {vaultProject.clips?.length ? renderProjectClips(vaultProject, true) : (
                  <div className="rounded-xl border border-white/10 px-5 py-8">
                    <h2 className="text-lg font-medium">{vaultProject.title}</h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      {vaultProject.status === "processing" ? "This project is still generating clips." : "There are no clips in this folder yet."}
                    </p>
                  </div>
                )}
              </section>
            ) : <>
              <ProjectsView
                projects={projects}
                onSelectProject={setVaultProjectId}
                onRefresh={refreshProjects}
                onNewClip={() => {
                  setIsGenerating(false);
                  setActiveTab("home");
                }}
              />
            </>
          )}

          {/* TAB 3: ANALYSE */}
          {activeTab === "analyse" && (
            <AnalyseView onConnectAccount={() => setActiveTab("socials")} />
          )}

          {/* TAB 4: SOCIAL ACCOUNTS & CROSS-PLATFORM PUBLISHER */}
          {activeTab === "socials" && (
            <SocialAccountsView onOpenCalendar={() => setActiveTab("calendar")} />
          )}

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
                <span>Upgrade to Pro (<span className="line-through text-zinc-500 font-normal">$24.99</span> $14.99/mo)</span>
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
            <CalendarView
              onOpenSocials={() => setActiveTab("socials")}
              availableClips={projects.flatMap((p) =>
                (p.clips || []).map((c, idx) => ({
                  id: c.clip_id || `${p.id}-${idx}`,
                  title: c.viral_title || c.caption || `${p.title} #${idx + 1}`,
                  videoUrl: c.download_url || "",
                }))
              )}
            />
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
      />
      <ClipEditorModal
        clip={selectedEditClip?.clip || null}
        index={selectedEditClip?.index || 0}
        onClose={() => setSelectedEditClip(null)}
        onSaveSuccess={(updated) => {
          const project = getStoredProjects().find(({ id }) => id === selectedEditClip?.projectId);
          if (!project) return;
          const clips = (project.clips || []).map((item) => item.clip_id === updated.clip_id ? updated : item);
          updateProjectStatus(project.id, "ready", clips, 100);
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
  onEdit?: () => void;
}) {
  const score =
    typeof clip.hook_score === "number" && clip.hook_score > 0
      ? clip.hook_score
      : typeof clip.story_score === "number" && clip.story_score > 0
      ? clip.story_score
      : typeof (clip as any).score === "number" && (clip as any).score > 0
      ? (clip as any).score
      : Math.max(72, 91 - index * 5);
  const durationSec = clip.duration_s || 60;
  const mins = Math.floor(durationSec / 60);
  const secs = Math.floor(durationSec % 60).toString().padStart(2, "0");

  const title = clip.viral_title || `Clip #${index + 1}`;
  const actions = [
    { label: "Schedule clip", icon: Calendar, run: onSchedule },
    { label: "Download clip", icon: Download, run: onRequestDownload },
    ...(onEdit ? [{ label: "Edit clip", icon: Pencil, run: onEdit }] : []),
  ];

  return (
    <article className="relative min-w-0 rounded-2xl border border-transparent p-2 transition-colors hover:border-amber-300/15 hover:bg-amber-300/5 focus-within:border-amber-300/15 focus-within:bg-amber-300/5 sm:p-3">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Preview ${title}`}
        className="group relative block aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-xl bg-[#141418] text-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <Video className="h-8 w-8" aria-hidden="true" />
        </div>
        <ClipThumbnail
          clip={clip}
          alt=""
          className="relative h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
        />
        <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-black">
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </span>
        </span>
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] text-white">
          {mins}:{secs}
        </span>
      </button>

      <div className="mt-2 flex items-start justify-between gap-1">
        <h3 className="min-w-0 text-sm font-semibold leading-snug text-zinc-100 sm:text-base" title={title}>
          <span className="line-clamp-2">{title}</span>
        </h3>
        <details
          className="relative shrink-0 open:z-10"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && event.currentTarget.open) {
              event.stopPropagation();
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary
            aria-label={`Actions for ${title}`}
            className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden"
          >
            <EllipsisVertical className="h-5 w-5" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-white/10 bg-[#1b1c20] p-1 shadow-xl">
            {actions.map(({ label, icon: Icon, run }) => (
              <button
                key={label}
                type="button"
                onClick={(event) => {
                  const menu = event.currentTarget.closest("details");
                  if (menu) {
                    menu.open = false;
                    menu.querySelector("summary")?.focus();
                  }
                  run();
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 focus-visible:bg-white/10"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </details>
      </div>
      <div className="mt-1 text-xs font-medium text-zinc-400">Clip score <span className="text-amber-300">{score}</span></div>
    </article>
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

  return user ? <DashboardContent /> : <DashboardLoading />;
}

export default function DashboardPage() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={<DashboardLoading />}>
        <DashboardEntry />
      </Suspense>
    </DashboardErrorBoundary>
  );
}
