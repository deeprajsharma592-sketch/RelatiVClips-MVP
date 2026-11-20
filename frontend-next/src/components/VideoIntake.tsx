"use client";

/**
 * VideoIntake — Primary Video Input with Local Upload First + YouTube Secondary
 * Completely aligned with the RelatiV Cinematic Dark Design System
 */

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  Link2,
  FileVideo,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { uploadVideoFile, submitLocalVideo } from "@/lib/api";
import SickLoadingTransition from "./SickLoadingTransition";
import { getDashDashboardUrl } from "@/lib/domain";

const URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;

const CAPTION_FONTS = [
  { id: "studio", label: "Studio", family: "Relativ Montserrat" },
  { id: "impact", label: "Impact", family: "Relativ Anton" },
  { id: "broadcast", label: "Broadcast", family: "Relativ Barlow" },
  { id: "clean", label: "Clean", family: "Relativ Open Sans" },
] as const;

interface VideoIntakeProps {
  className?: string;
  onStartProcess?: (taskId: string) => void;
}

export default function VideoIntake({
  className = "",
  onStartProcess,
}: VideoIntakeProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"url" | "upload">("url");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [captionFont, setCaptionFont] = useState("studio");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle local file selection
  const handleFileProcess = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
        setError("Please select a valid video file (MP4, MOV, WEBM, MKV).");
        return;
      }
      setError(null);
      setSelectedFile(file);
      setUploadProgress(0);
      setUploadStatus("Uploading video to engine...");

      try {
        // Step 1: Upload file
        const { filePath } = await uploadVideoFile(file, (pct) => {
          setUploadProgress(pct);
          setUploadStatus(`Uploading: ${pct}%`);
        });

        setUploadStatus("Starting AI virality pipeline...");
        // Step 2: Kick off local pipeline
        const init = await submitLocalVideo(filePath);

        if (onStartProcess) {
          onStartProcess(init.taskId);
        } else {
          router.push(`/dashboard?taskId=${encodeURIComponent(init.taskId)}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload video.");
        setUploadProgress(null);
        setSelectedFile(null);
      }
    },
    [router, onStartProcess]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = youtubeUrl.trim();
    if (!trimmed) return;
    if (!URL_REGEX.test(trimmed)) {
      setError("Please enter a valid YouTube URL (youtube.com or youtu.be)");
      return;
    }
    setError(null);
    setIsTransitioning(true);
  };

  return (
    <div className={`w-full max-w-[840px] mx-auto ${className}`}>
      {/* ── Connected Tab Bar ── */}
      <div className="flex items-end px-3 sm:px-6">
        <button
          type="button"
          onClick={() => {
            setActiveTab("url");
            setError(null);
          }}
          className={`relative flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-t-2xl text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer z-10 ${
            activeTab === "url"
              ? "bg-white dark:bg-[#090b11] text-zinc-900 dark:text-white border-t border-x border-black/10 dark:border-white/10 shadow-sm dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
              : "bg-black/[0.03] dark:bg-white/[0.02] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] border-t border-x border-transparent"
          }`}
        >
          <Link2 className={`w-4 h-4 ${activeTab === "url" ? "text-cyan-500 dark:text-cyan-400" : "text-zinc-500"}`} />
          <span>CLIP LONG VIDEO</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("upload");
            setError(null);
          }}
          className={`relative flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-t-2xl text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer z-10 ml-1.5 ${
            activeTab === "upload"
              ? "bg-white dark:bg-[#090b11] text-zinc-900 dark:text-white border-t border-x border-black/10 dark:border-white/10 shadow-sm dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
              : "bg-black/[0.03] dark:bg-white/[0.02] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] border-t border-x border-transparent"
          }`}
        >
          <UploadCloud className={`w-4 h-4 ${activeTab === "upload" ? "text-cyan-500 dark:text-cyan-400" : "text-zinc-500"}`} />
          <span>UPLOAD FOOTAGE</span>
        </button>
      </div>

      {/* ── Connected Main Intake Panel ── */}
      <div className="relative rounded-3xl bg-white dark:bg-[#090b11] border border-black/10 dark:border-white/10 p-6 sm:p-9 shadow-lg dark:shadow-[0_25px_60px_rgba(0,0,0,0.9)] backdrop-blur-xl -mt-px transition-all">
        {/* Ambient Top Light */}
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none rounded-t-3xl"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(56, 189, 248, 0.4) 30%, rgba(139, 92, 246, 0.4) 70%, transparent 100%)",
          }}
        />

        <AnimatePresence mode="wait">
          {activeTab === "url" ? (
            /* ── TAB 1: CLIP LONG VIDEO (URL Workflow) ── */
            <motion.div
              key="tab-url"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <div>
                <h3 className="font-display font-bold text-xl sm:text-2xl text-zinc-950 dark:text-white tracking-tight mb-2">
                  Turn any long video into short clips
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
                  Paste a public YouTube, Zoom, or Google Drive link. RelatiV AI detects key talking hooks, re-frames for 9:16 vertical video, and generates word-level animated subtitles.
                </p>
              </div>

              <form onSubmit={handleYoutubeSubmit} className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-[#F0F2F6] dark:bg-black/60 rounded-2xl border border-black/10 dark:border-white/15 p-2 sm:p-2.5 focus-within:border-cyan-500 shadow-sm transition-all">
                  <div className="pl-3 pr-1 text-zinc-400 hidden sm:block">
                    <Link2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="flex-1 min-w-0 bg-transparent py-2.5 px-3 sm:px-0 text-sm sm:text-base text-zinc-950 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-sans"
                  />
                  <button
                    type="submit"
                    disabled={!youtubeUrl.trim()}
                    className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100 text-sm font-semibold shadow-md transition-all active:scale-[0.98] disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-white/10 dark:disabled:text-white/30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  >
                    <span>Get clips</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <fieldset className="space-y-2.5">
                  <legend className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    Caption type
                  </legend>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Caption font">
                    {CAPTION_FONTS.map((font) => {
                      const selected = captionFont === font.id;
                      return (
                        <button
                          key={font.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setCaptionFont(font.id)}
                          className={`min-h-16 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                            selected
                              ? "border-cyan-500/70 bg-cyan-500/[0.08] text-zinc-950 dark:text-white"
                              : "border-black/10 bg-white/70 text-zinc-600 hover:border-black/20 dark:border-white/10 dark:bg-white/[0.025] dark:text-zinc-300 dark:hover:border-white/20"
                          }`}
                        >
                          <span
                            className="block text-lg leading-none"
                            style={{ fontFamily: `'${font.family}', sans-serif` }}
                          >
                            Aa
                          </span>
                          <span className="mt-2 block text-[10px] text-zinc-500 dark:text-zinc-400">
                            {font.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Secondary Actions & Helpers */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Supports YouTube, Zoom, or Google Drive public links
                  </span>

                  <button
                    type="button"
                    onClick={() => setActiveTab("upload")}
                    className="text-zinc-600 dark:text-zinc-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors text-left sm:text-right cursor-pointer"
                  >
                    Have a raw video file? <span className="underline underline-offset-2">Upload footage →</span>
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            /* ── TAB 2: UPLOAD FOOTAGE (File Dropzone Workflow) ── */
            <motion.div
              key="tab-upload"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.avi,.mkv,.webm"
                className="hidden"
                onChange={onFileInputChange}
              />

              {uploadProgress !== null ? (
                /* ── Uploading State ── */
                <div className="py-12 px-6 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-500 dark:text-cyan-400">
                    <Loader2 className="w-7 h-7 animate-spin" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-zinc-950 dark:text-white">{uploadStatus}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 truncate max-w-sm mx-auto font-sans">
                      {selectedFile?.name}
                    </p>
                  </div>
                  <div className="w-full max-w-md mx-auto bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                /* ── Dropzone State ── */
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? "border-cyan-500 bg-cyan-500/[0.08] scale-[0.99]"
                      : "border-black/15 dark:border-white/15 hover:border-cyan-500/40 bg-[#F7F8FA] dark:bg-white/[0.015] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <UploadCloud className="w-7 h-7" />
                  </div>

                  <h3 className="font-display font-semibold text-lg sm:text-xl text-zinc-950 dark:text-white mb-2 tracking-tight">
                    Drop your footage here
                  </h3>

                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-6 max-w-md mx-auto leading-relaxed">
                    Drag and drop your raw MP4, MOV, or WEBM video here, or browse files on your computer.
                  </p>

                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100 text-sm font-semibold shadow-md transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <FileVideo className="w-4 h-4 text-white dark:text-black" />
                    <span>Select video file</span>
                  </button>

                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>Supported formats: MP4, MOV, MKV, WEBM (up to 2GB)</span>
                    <span className="hidden sm:inline text-zinc-400 dark:text-zinc-600">·</span>
                    <span>Auto 9:16 vertical crop & subtitles</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                <span>Direct file upload processes at maximum speed</span>
                <button
                  type="button"
                  onClick={() => setActiveTab("url")}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors"
                >
                  Have a YouTube link? <span className="underline underline-offset-2">Clip long video →</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── SICK LOADING TRANSITION OVERLAY ── */}
      {isTransitioning && youtubeUrl && (
        <SickLoadingTransition
          url={youtubeUrl}
          captionFont={captionFont}
          autoRedirect={false}
          onComplete={(taskId) => {
            setIsTransitioning(false);
            if (onStartProcess && taskId) {
              onStartProcess(taskId);
            } else {
              router.push(
                getDashDashboardUrl("", {
                  url: youtubeUrl.trim(),
                  taskId: taskId || undefined,
                })
              );
            }
          }}
        />
      )}
    </div>
  );
}
