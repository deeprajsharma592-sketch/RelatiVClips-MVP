"use client";

/**
 * /dashboard — RelatiV Creative Studio Master Dashboard
 * Dark obsidian aesthetic, high-contrast typography, premium SaaS taste.
 * Features:
 * - Studio Sidebar: Home, Projects, Brand Kit, Asset Library, Analyse, Socials, Calendar
 * - Studio Header: Upgrade announcement banner, credits pill, quick upgrade CTA
 * - Studio Hero: 1-click intake, content archetype recipe pills, demo projects
 * - Active Generation: Waveform equalizer, stage tracker, real backend polling
 * - Genuine Clips Vault: 9:16 vertical cards with score badges, download & copy
 * - Analyse View: Retention curves, platform view splits, top clips leaderboard
 * - Socials View: Connected YouTube / TikTok / Instagram cards & cross-platform uploader
 * - Projects View: Filterable library of all generated projects
 * - Upgrade Modal: 3-tier pricing (Starter $5.99 / Pro $11.99 / Custom Business)
 */

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  Video,
  Play,
  ArrowRight,
  Share2,
  Sparkles,
  Crown,
  Calendar as CalendarIcon,
  Palette,
  FolderOpen,
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
  saveProject,
  createNewProject,
  updateProjectStatus,
  type StoredProject,
} from "@/lib/projectStorage";
import type { Clip } from "@/types";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const taskIdParam = searchParams.get("taskId");
  const urlParam = searchParams.get("url");

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<StudioTab>("home");

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

  return (
    <div className="flex min-h-screen bg-[#07080B] text-white selection:bg-cyan-400 selection:text-black">
      {/* ── Studio Sidebar (Sticky Desktop, Dark Glass) ── */}
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
        <main className="flex-1 p-6 sm:p-10 max-w-[1280px] w-full mx-auto space-y-10">
          {/* TAB 1: HOME STUDIO */}
          {activeTab === "home" && (
            <div className="space-y-10">
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
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border border-cyan-500/30 bg-[#090b11]/90 p-8 sm:p-10 text-center space-y-5 relative overflow-hidden shadow-2xl backdrop-blur-xl"
                >
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>Auto-Generating 9:16 Vertical Viral Clips</span>
                  </div>

                  <div className="max-w-md mx-auto space-y-2">
                    <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                      {currentStepName || "RelatiV Engine is analyzing your video..."}
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                      Detecting dialogue peaks, centering speakers for vertical video, and generating animated subtitles.
                    </p>
                  </div>

                  {/* Audio Equalizer Waveform */}
                  <div className="flex items-center justify-center gap-1.5 h-7 max-w-xs mx-auto">
                    {Array.from({ length: 18 }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          height: [
                            "20%",
                            `${Math.max(25, Math.sin((i + generationProgress * 0.2) * 0.9) * 90 + 10)}%`,
                            "30%",
                          ],
                        }}
                        transition={{
                          duration: 0.5 + (i % 4) * 0.1,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="w-1 rounded-full bg-cyan-400"
                      />
                    ))}
                  </div>

                  {/* Progress Bar */}
                  <div className="max-w-md mx-auto space-y-2">
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 rounded-full"
                        animate={{ width: `${generationProgress}%` }}
                        transition={{ ease: "easeInOut", duration: 0.5 }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                      <span>{generationProgress}% complete</span>
                      <span>{elapsedSec}s elapsed</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Error Banner ── */}
              {generationError && !isGenerating && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-3 text-xs text-rose-300">
                  <div className="flex items-center gap-2.5">
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
              {activeProject && activeProject.status === "ready" && activeProject.clips.length > 0 && (
                <div className="space-y-6 pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                        <span>{activeProject.title}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-semibold">
                          {activeProject.clips.length} Clips Ready
                        </span>
                      </h2>
                      <span className="text-xs text-zinc-400 mt-1 block">
                        Generated {new Date(activeProject.createdAt).toLocaleDateString()} · 1080×1920 60FPS
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveTab("socials")}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Publish to Socials</span>
                      </button>

                      <button
                        onClick={() => {
                          if (activeProject.clips[0]) handleRequestDownload(activeProject.clips[0]);
                        }}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-white text-black hover:bg-zinc-100 shadow-md transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download All</span>
                      </button>
                    </div>
                  </div>

                  {/* 9:16 Vertical Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeProject.clips.map((clip, index) => (
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
              {!isGenerating && (!activeProject || activeProject.clips.length === 0) && (
                <div className="rounded-3xl border border-white/10 bg-[#0B0C10] p-12 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
                    <Video className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h3 className="font-display font-semibold text-lg text-white tracking-tight">
                      Your generated clips will appear here
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans">
                      Paste a YouTube URL above or upload your footage. The RelatiV viral AI engine will detect hook moments, reframe to 9:16, and generate animated captions.
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
            <div className="rounded-3xl border border-white/10 bg-[#0B0C10] p-12 text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Palette className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  👑 Pro Feature
                </span>
                <h2 className="text-xl font-bold text-white">Custom Brand Kits & Watermark Removal</h2>
                <p className="text-xs text-zinc-400">
                  Save your brand fonts, signature colors, custom intro stingers, and remove default watermark exports across all clips.
                </p>
              </div>
              <button
                onClick={() => setIsUpgradeModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold text-xs shadow-lg hover:opacity-95 transition"
              >
                <Crown className="w-4 h-4" />
                <span>Upgrade to Pro ($11.99/mo)</span>
              </button>
            </div>
          )}

          {/* TAB 6: ASSET LIBRARY */}
          {activeTab === "assets" && (
            <div className="rounded-3xl border border-white/10 bg-[#0B0C10] p-12 text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
                <FolderOpen className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h2 className="text-xl font-bold text-white">Asset & B-roll Library</h2>
                <p className="text-xs text-zinc-400">
                  Upload custom sound effects, overlay memes, lower-third graphics, and royalty-free trending background music for your clips.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("home")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-bold text-xs hover:bg-zinc-100 transition"
              >
                <span>Back to Home Studio</span>
              </button>
            </div>
          )}

          {/* TAB 7: CALENDAR */}
          {activeTab === "calendar" && (
            <div className="rounded-3xl border border-white/10 bg-[#0B0C10] p-12 text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                <CalendarIcon className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h2 className="text-xl font-bold text-white">Content Publishing Calendar</h2>
                <p className="text-xs text-zinc-400">
                  Visual timeline for scheduled YouTube Shorts, TikTok, and Instagram Reels drops. Queue 30 days of daily viral content in one sitting.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("socials")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold text-xs shadow-lg hover:opacity-95 transition"
              >
                <Share2 className="w-4 h-4" />
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
 * 9:16 Vertical Clip Card for Genuine Backend Output
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
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl border border-white/10 bg-[#090b11] overflow-hidden flex flex-col justify-between shadow-xl group hover:border-cyan-500/30 transition-all"
    >
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
              <div className="w-full h-full bg-[#0d1017] flex items-center justify-center">
                <Video className="w-10 h-10 text-zinc-600" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
            <button
              onClick={onRequestDownload}
              className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 flex items-center justify-center transition-all shadow-2xl hover:scale-105 active:scale-95 group/btn cursor-pointer"
            >
              <Play className="w-6 h-6 text-white ml-0.5 fill-white group-hover/btn:scale-110 transition-transform" />
            </button>
          </div>
        )}

        {/* Hook Score Badge */}
        {typeof clip.hook_score === "number" && (
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-400 text-black shadow-md">
              ⚡ {clip.hook_score}/100 Hook
            </span>
          </div>
        )}

        {/* Duration */}
        <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-black/80 text-zinc-300 backdrop-blur-sm">
            {clip.duration_s ? `${clip.duration_s.toFixed(0)}s` : "9:16"} · 1080p
          </span>
        </div>
      </div>

      {/* Card Info */}
      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <h3 className="font-bold text-sm text-white line-clamp-1">
            {clip.viral_title || `Clip #${index + 1}`}
          </h3>
          {clip.caption && (
            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
              {clip.caption}
            </p>
          )}
          {clip.hashtags && (
            <p className="text-xs text-cyan-400/90 truncate font-mono">
              {clip.hashtags}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onRequestDownload}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold text-black bg-white hover:bg-zinc-100 shadow-md transition active:scale-[0.98] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download MP4</span>
            </button>

            <button
              onClick={handleCopyCaption}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-medium text-zinc-300 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition cursor-pointer"
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
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Publish to YouTube / TikTok / Reels</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07080B]" />}>
      <DashboardContent />
    </Suspense>
  );
}
