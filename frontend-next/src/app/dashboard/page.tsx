"use client";

/**
 * /dashboard — The RelatiV Master Studio Dashboard
 * Where all the work happens:
 *  1. Intake slot to drop video or paste link
 *  2. Waiting state for active video generation (no internal prompt breakdown)
 *  3. 4-day temporary storage vault with expiration timers
 *  4. 9:16 vertical clip cards with viral hook scores and 1-click export
 */

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Download,
  Copy,
  CheckCircle2,
  Clock,
  Zap,
  AlertCircle,
  Video,
  Play,
  ArrowRight,
  Shield,
  Layers,
  Trash2,
  Share2,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
  getRemainingTimeFormatted,
  type StoredProject,
} from "@/lib/projectStorage";
import type { Clip } from "@/types";

// Sample clips for immediate demonstration when backend is in standby
const DEMO_CLIPS: Clip[] = [
  {
    clip_id: "demo-hook-01",
    start: 12.4,
    end: 58.2,
    duration_s: 45.8,
    viral_title: "The #1 Reason Most Startups Die in Year 1",
    caption:
      "Most founders optimize for building before testing the distribution hook. Don't build what nobody is searching for.",
    hashtags: "#startups #business #entrepreneurship #relativclips",
    file_path: "/demo-clip-1.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=720&q=80",
    file_size_mb: 18.4,
    created_at: new Date().toISOString(),
    hook_score: 96,
    story_score: 94,
  },
  {
    clip_id: "demo-hook-02",
    start: 142.0,
    end: 189.5,
    duration_s: 47.5,
    viral_title: "How to Build an Unfair Advantage in 2026",
    caption:
      "If anyone can replicate your workflow with a single API call, your moat is zero. Focus on proprietary distribution.",
    hashtags: "#growth #creator #marketing #shorts",
    file_path: "/demo-clip-2.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=720&q=80",
    file_size_mb: 21.1,
    created_at: new Date().toISOString(),
    hook_score: 91,
    story_score: 89,
  },
  {
    clip_id: "demo-hook-03",
    start: 310.2,
    end: 348.0,
    duration_s: 37.8,
    viral_title: "Stop Over-Editing Your Short Form Videos",
    caption:
      "Clean framing, clear typography, and strong narrative pacing beat 50 random sound effects every single time.",
    hashtags: "#editing #podcasts #videoediting #viraltips",
    file_path: "/demo-clip-3.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=720&q=80",
    file_size_mb: 15.2,
    created_at: new Date().toISOString(),
    hook_score: 88,
    story_score: 86,
  },
];

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const taskIdParam = searchParams.get("taskId");
  const urlParam = searchParams.get("url");

  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Active generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(15);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Soft-gate modal
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [pendingDownloadClip, setPendingDownloadClip] = useState<Clip | null>(null);

  // Load projects from storage on mount
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

    const sourceName = urlParam ? "YouTube Video" : "Uploaded MP4";
    const newProj = createNewProject(sourceName, taskIdParam || undefined);
    setProjects(getStoredProjects());
    setActiveProjectId(newProj.id);
    setIsGenerating(true);
    setElapsedSec(0);
    setGenerationProgress(20);

    let isMounted = true;
    let pollInterval: any = null;

    const startPolling = (tid: string) => {
      let consecutiveErrors = 0;
      pollInterval = setInterval(async () => {
        try {
          const status = await checkProcessingStatus(tid);
          if (!isMounted) return;
          consecutiveErrors = 0;

          if (status.status === "complete" && status.clips && status.clips.length > 0) {
            clearInterval(pollInterval);
            setIsGenerating(false);
            setGenerationProgress(100);
            updateProjectStatus(newProj.id, "ready", status.clips, 100);
            setProjects(getStoredProjects());
          } else if (status.status === "failed") {
            clearInterval(pollInterval);
            setIsGenerating(false);
            setGenerationError(status.error || "Generation could not be completed.");
            updateProjectStatus(newProj.id, "failed", [], 0);
            setProjects(getStoredProjects());
          } else {
            // Processing: calculate progress smoothly (handles 0-100 or 0.0-1.0 formats)
            const raw = typeof status.progress === "number"
              ? (status.progress > 1 ? status.progress : status.progress * 100)
              : 25;
            const progress = Math.min(95, Math.max(15, raw));
            setGenerationProgress(progress);
          }
        } catch (e: any) {
          consecutiveErrors++;
          // Only abort after 15 consecutive errors (approx 35-40s of persistent outage)
          if (consecutiveErrors > 15) {
            clearInterval(pollInterval);
            setIsGenerating(false);
            setGenerationError("Backend unreachable (502 / Host not found). Please verify your LOQ backend and tunnel are active.");
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
          setGenerationError(`Cannot connect to backend: ${err?.message || "Tunnel offline / 502"}. Please start cloudflared tunnel on your LOQ.`);
          updateProjectStatus(newProj.id, "failed", [], 0);
          setProjects(getStoredProjects());
        });
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [taskIdParam, urlParam]);

  // Elapsed timer when generating
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
      setGenerationProgress((prev) => (prev < 90 ? prev + 3 : prev));
    }, 1000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Active project
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  // Handler for loading demo project
  const handleLoadDemo = () => {
    const demoProj: StoredProject = {
      id: "proj-demo-" + Date.now(),
      title: "🎙️ The Joe Rogan Experience #2140",
      createdAt: Date.now(),
      expiresAt: Date.now() + 4 * 24 * 60 * 60 * 1000,
      status: "ready",
      progress: 100,
      clips: DEMO_CLIPS,
    };
    saveProject(demoProj);
    setProjects(getStoredProjects());
    setActiveProjectId(demoProj.id);
    setIsGenerating(false);
  };

  // Download directly — no auth gate during beta
  const handleRequestDownload = (clip: Clip) => {
    executeDownload(clip);
  };

  const executeDownload = (clip: Clip) => {
    const a = document.createElement("a");
    const downloadHref = clip.download_url
      ? (clip.download_url.startsWith("http") ? clip.download_url : apiPath(clip.download_url))
      : (clip.file_path && clip.file_path.startsWith("http")
          ? clip.file_path
          : apiPath(`/download/${clip.clip_id}`));
    a.href = downloadHref;
    a.download = `${clip.clip_id || "relativ_clip"}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#07080C] text-white pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Top Bar: Intake Drop Slot */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 backdrop-blur-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h1 className="font-display font-bold text-xl sm:text-2xl text-white">
                  Studio Workspace
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Drop a video file or paste a link to generate viral 9:16 vertical clips.
                </p>
              </div>

              {projects.length === 0 && (
                <button
                  onClick={handleLoadDemo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all self-start md:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load Sample Project</span>
                </button>
              )}
            </div>

            {/* Embedded Video Intake */}
            <VideoIntake />
          </div>

          {/* ACTIVE GENERATION / WAITING STATE */}
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-blue-500/30 bg-blue-500/5 p-8 text-center space-y-5 relative overflow-hidden"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                <span>Generating 9:16 Vertical Clips</span>
              </div>

              <div className="max-w-md mx-auto space-y-3">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-white">
                  RelatiV Engine is analyzing your video...
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Scoring virality peaks, centering speakers for vertical video, and burning dynamic karaoke subtitles.
                </p>
              </div>

              {/* Smooth Progress Bar */}
              <div className="max-w-md mx-auto space-y-2">
                <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-300 rounded-full"
                    animate={{ width: `${generationProgress}%` }}
                    transition={{ ease: "easeInOut", duration: 0.5 }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>{generationProgress}% complete</span>
                  <span>{elapsedSec}s elapsed (~45s remaining)</span>
                </div>
              </div>

              <div className="pt-2 text-[11px] font-mono text-slate-400">
                <span>💡 You can navigate away or close this tab. Clips will be saved to your vault automatically.</span>
              </div>
            </motion.div>
          )}

          {/* 4-DAY TEMPORARY STORAGE VAULT */}
          {activeProject && activeProject.status === "ready" && activeProject.clips.length > 0 && (
            <div className="space-y-6">
              {/* Vault Notice Bar */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block">
                      4-Day Temporary Storage Vault Active
                    </span>
                    <span className="text-amber-200/80 text-[11px]">
                      Clips are preserved in full 1080p HD. Download to your drive before expiration.
                    </span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 font-mono text-[11px] font-bold text-amber-300">
                  <span>⏳ Expires in:</span>
                  <span>{getRemainingTimeFormatted(activeProject.expiresAt)}</span>
                </div>
              </div>

              {/* Project Title Bar & Batch Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{activeProject.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                      {activeProject.clips.length} Clips Ready
                    </span>
                  </h2>
                  <span className="text-xs text-slate-400 font-mono">
                    Created {new Date(activeProject.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (activeProject.clips[0]) handleRequestDownload(activeProject.clips[0]);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:opacity-95 shadow-md shadow-blue-500/20 transition-all"
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
                    expiresAt={activeProject.expiresAt}
                    onRequestDownload={() => handleRequestDownload(clip)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty Vault State */}
          {!isGenerating && (!activeProject || activeProject.clips.length === 0) && (
            <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 p-8 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                <Video className="w-8 h-8" />
              </div>
              <h3 className="font-display font-semibold text-lg text-white">
                No clips in your vault yet
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Upload an MP4 file or paste a YouTube link above to generate your first 10 viral clips.
              </p>
              <button
                onClick={handleLoadDemo}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Load Sample Project</span>
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Soft Gate Modal */}
      <AuthExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        clipTitle={pendingDownloadClip?.viral_title}
        onSuccessDownload={() => {
          if (pendingDownloadClip) executeDownload(pendingDownloadClip);
        }}
      />
    </>
  );
}

/**
 * 9:16 Vertical Clip Card with Viral Hook Badge & Expiration Tag
 */
function ClipCard({
  clip,
  index,
  expiresAt,
  onRequestDownload,
}: {
  clip: Clip;
  index: number;
  expiresAt: number;
  onRequestDownload: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const videoUrl = clip.download_url
    ? (clip.download_url.startsWith("http") ? clip.download_url : apiPath(clip.download_url))
    : (clip.file_path && clip.file_path.startsWith("http")
        ? clip.file_path
        : apiPath(`/download/${clip.clip_id}`));

  const posterUrl = clip.thumbnail_url
    ? (clip.thumbnail_url.startsWith("http") ? clip.thumbnail_url : apiPath(clip.thumbnail_url))
    : clip.clip_id ? apiPath(`/thumbnail/${clip.clip_id}`) : undefined;

  const handleCopyCaption = () => {
    const text = `${clip.viral_title || ""}\n\n${clip.caption || ""}\n\n${clip.hashtags || ""}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const hookScore = clip.hook_score || 94 - index * 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden flex flex-col justify-between shadow-xl group hover:border-white/20 transition-all"
    >
      {/* 9:16 Phone Aspect Frame with Screenshot / Thumbnail Display */}
      <div className="relative aspect-[9/16] w-full bg-slate-950 overflow-hidden flex items-center justify-center">
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
              <div className="w-full h-full bg-gradient-to-b from-slate-900 via-[#101426] to-slate-950 flex items-center justify-center">
                <Video className="w-10 h-10 text-slate-600" />
              </div>
            )}
            {/* Cinematic gradient overlay & Frosted Play Button */}
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

        {/* Viral Hook Badge */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-slate-950 shadow-md">
            ⚡ {hookScore}/100 Hook
          </span>
        </div>

        {/* Expiration Tag */}
        <div className="absolute top-3 right-3 z-10 pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/70 text-amber-200 border border-amber-400/30 backdrop-blur-sm">
            ⏳ {getRemainingTimeFormatted(expiresAt)}
          </span>
        </div>

        {/* Duration Tag */}
        <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-black/70 text-slate-300 backdrop-blur-sm">
            {clip.duration_s ? `${clip.duration_s.toFixed(0)}s` : "9:16"} · 1080p
          </span>
        </div>
      </div>

      {/* Card Content & Export Controls */}
      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <h3 className="font-bold text-sm text-white line-clamp-1">
            {clip.viral_title || `Viral Clip #${index + 1}`}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {clip.caption || "Automatic viral hook selection with word-level subtitles."}
          </p>
          {clip.hashtags && (
            <p className="text-[11px] font-mono text-blue-400 truncate opacity-80">
              {clip.hashtags}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center gap-2">
          <button
            onClick={onRequestDownload}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-95 shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download MP4</span>
          </button>

          <button
            onClick={handleCopyCaption}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            title="Copy viral caption & hashtags"
          >
            {copied ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
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
    <Suspense fallback={<div className="min-h-screen bg-[#07080C]" />}>
      <DashboardContent />
    </Suspense>
  );
}
