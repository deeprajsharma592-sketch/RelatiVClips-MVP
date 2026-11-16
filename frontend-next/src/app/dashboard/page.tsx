"use client";

/**
 * /dashboard — The RelatiV Master Studio Dashboard
 * Focused UI/UX for video intake, genuine processing status, and real clip management.
 * Clean, production-ready frontend ready for backend integration.
 */

import { Suspense, useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import VideoIntake from "@/components/VideoIntake";
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

  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Active generation state (triggered by genuine URL or file intake)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(15);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Soft-gate modal
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [pendingDownloadClip, setPendingDownloadClip] = useState<Clip | null>(null);

  // Load genuine projects from storage on mount
  useEffect(() => {
    const list = getStoredProjects();
    setProjects(list);
    if (list.length > 0 && !activeProjectId) {
      setActiveProjectId(list[0].id);
    }
  }, [activeProjectId]);

  // Handle incoming taskId or url from VideoIntake redirect
  useEffect(() => {
    if (!taskIdParam && !urlParam) return;

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
            // Real processing: calculate progress smoothly (handles 0-100 or 0.0-1.0 formats)
            const raw =
              typeof status.progress === "number"
                ? status.progress > 1
                  ? status.progress
                  : status.progress * 100
                : 25;
            const progress = Math.min(95, Math.max(15, raw));
            setGenerationProgress(progress);
          }
        } catch {
          consecutiveErrors++;
          // Abort after 15 consecutive errors (approx 35-40s of persistent outage)
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
      // Trigger the real yt-dlp pipeline on the backend
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
          setGenerationError(
            `Cannot connect to backend: ${err?.message || "Service offline"}.`
          );
          updateProjectStatus(newProj.id, "failed", [], 0);
          setProjects(getStoredProjects());
        });
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [taskIdParam, urlParam]);

  // Elapsed timer when genuine generation is active
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
    <div className="relative w-full min-h-screen py-8 sm:py-12 px-4 sm:px-6 bg-[#F7F8FA] dark:bg-[#050507] text-[#111318] dark:text-white selection:bg-cyan-400 selection:text-black transition-colors overflow-x-clip">
      {/* ── Layer 2 & 3: Dashboard Ambient Illumination (Dark Mode Only — Scoped to Dashboard) ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 z-0 overflow-hidden hidden dark:block transform-gpu will-change-transform"
      >
        {/* Supplied ambient glow asset scaled & positioned to upper center (tuned +20% luminosity) */}
        <div
          className="absolute inset-0 w-full h-full bg-top bg-no-repeat bg-cover opacity-[0.28] transform-gpu"
          style={{
            backgroundImage: "url('/dashboard-ambient-glow.jpg')",
          }}
        />
        {/* Dark readability overlay maintaining crisp component contrast */}
        <div className="absolute inset-0 bg-[#050507]/15" />
      </div>

      <div className="relative z-10 w-full max-w-[1120px] mx-auto space-y-8">
        {/* ── Studio Workspace Header ── */}
        <div className="pb-6 border-b border-black/[0.08] dark:border-white/[0.08]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400" />
            <span>STUDIO WORKSPACE</span>
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-zinc-900 dark:text-white tracking-tight">
            Studio Workspace
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 max-w-xl leading-relaxed">
            Turn long-form videos into ready-to-share short clips.
          </p>
        </div>

        {/* ── Video Intake Workspace ── */}
        <div className="w-full flex justify-center">
          <VideoIntake />
        </div>

        {/* ── ACTIVE GENERATION / WAITING STATE (Only on real job submission) ── */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl sm:rounded-3xl border border-cyan-500/20 bg-[#090b11]/90 p-8 sm:p-10 text-center space-y-5 relative overflow-hidden shadow-2xl backdrop-blur-xl"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Generating 9:16 Vertical Clips</span>
            </div>

            <div className="max-w-md mx-auto space-y-3">
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                RelatiV Engine is analyzing your video...
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Detecting dialogue peaks, centering speakers for vertical video, and generating animated subtitles.
              </p>
            </div>

            {/* Smooth Progress Bar */}
            <div className="max-w-md mx-auto space-y-2">
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-400 rounded-full"
                  animate={{ width: `${generationProgress}%` }}
                  transition={{ ease: "easeInOut", duration: 0.5 }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{generationProgress}% complete</span>
                <span>{elapsedSec}s elapsed</span>
              </div>
            </div>

            <div className="pt-2 text-xs text-zinc-500">
              <span>Clips will be saved to your workspace once processing finishes.</span>
            </div>
          </motion.div>
        )}

        {/* ── Error Banner if real generation failed ── */}
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

        {/* ── GENUINE CLIPS VAULT (Rendered only when real clips exist) ── */}
        {activeProject && activeProject.status === "ready" && activeProject.clips.length > 0 && (
          <div className="space-y-6">
            {/* Project Title Bar & Batch Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{activeProject.title}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-medium">
                    {activeProject.clips.length} Clips Ready
                  </span>
                </h2>
                <span className="text-xs text-zinc-400 mt-1 block">
                  Created {new Date(activeProject.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (activeProject.clips[0]) handleRequestDownload(activeProject.clips[0]);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold bg-white text-black hover:bg-zinc-100 shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download All Clips</span>
                </button>
              </div>
            </div>

            {/* 9:16 Vertical Clips Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeProject.clips.map((clip, index) => (
                <ClipCard
                  key={clip.clip_id || index}
                  clip={clip}
                  index={index}
                  onRequestDownload={() => handleRequestDownload(clip)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── CLEAN EMPTY VAULT STATE (Default when no genuine clips exist) ── */}
        {!isGenerating && (!activeProject || activeProject.clips.length === 0) && (
          <div className="rounded-3xl border border-black/10 dark:border-white/[0.08] bg-white dark:bg-[#090b11] p-10 sm:p-14 text-center space-y-4 shadow-sm dark:shadow-none backdrop-blur-md transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 flex items-center justify-center mx-auto text-zinc-500 dark:text-zinc-400">
              <Video className="w-6 h-6" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="font-display font-semibold text-lg sm:text-xl text-zinc-900 dark:text-white tracking-tight">
                Your clips will appear here.
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                Upload a video or paste a link to get started. Your generated clips will appear in this workspace.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Soft Gate Modal */}
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
}: {
  clip: Clip;
  index: number;
  onRequestDownload: () => void;
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
      className="rounded-2xl border border-white/10 bg-[#090b11]/90 backdrop-blur-xl overflow-hidden flex flex-col justify-between shadow-xl group hover:border-white/20 transition-all"
    >
      {/* 9:16 Phone Aspect Frame with Video / Thumbnail Display */}
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
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
            <button
              onClick={onRequestDownload}
              className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 flex items-center justify-center transition-all shadow-2xl hover:scale-105 active:scale-95 group/btn cursor-pointer"
              title="Download or preview clip"
            >
              <Play className="w-6 h-6 text-white ml-0.5 fill-white group-hover/btn:scale-110 transition-transform" />
            </button>
          </div>
        )}

        {/* Real Hook Badge (Only rendered if genuine score provided by backend) */}
        {typeof clip.hook_score === "number" && (
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-400 text-black shadow-md">
              ⚡ {clip.hook_score}/100 Hook
            </span>
          </div>
        )}

        {/* Duration Tag */}
        <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-black/80 text-zinc-300 backdrop-blur-sm">
            {clip.duration_s ? `${clip.duration_s.toFixed(0)}s` : "9:16"} · 1080p
          </span>
        </div>
      </div>

      {/* Card Content & Real Export Controls */}
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
            <p className="text-xs text-cyan-400/90 truncate font-sans">
              {clip.hashtags}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center gap-2">
          <button
            onClick={onRequestDownload}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full py-2.5 px-3 text-xs font-semibold text-black bg-white hover:bg-zinc-100 shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download MP4</span>
          </button>

          <button
            onClick={handleCopyCaption}
            className="inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 px-4 text-xs font-medium text-zinc-300 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-all cursor-pointer"
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
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050507]" />}>
      <DashboardContent />
    </Suspense>
  );
}
