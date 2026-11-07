"use client";

/**
 * VideoIntake — Primary Video Input with Local Upload First + YouTube Mockup/Secondary
 */

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  Link2,
  FileVideo,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { uploadVideoFile, submitLocalVideo } from "@/lib/api";

const URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;

interface VideoIntakeProps {
  className?: string;
  onStartProcess?: (taskId: string) => void;
}

export default function VideoIntake({ className = "", onStartProcess }: VideoIntakeProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"upload" | "youtube">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
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
          router.push(`/process?taskId=${encodeURIComponent(init.taskId)}`);
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
    router.push(`/process?url=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      {/* Tab Switcher */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            setActiveTab("upload");
            setError(null);
          }}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
            activeTab === "upload"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white/80 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 border border-slate-200 dark:border-white/10"
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Upload Video (Recommended)</span>
          <span className="px-1.5 py-0.2 text-[9px] rounded-full bg-blue-500 text-white font-mono">Fast</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("youtube");
            setError(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
            activeTab === "youtube"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white/80 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 border border-slate-200 dark:border-white/10"
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>YouTube Link</span>
          <span className="px-1.5 py-0.2 text-[9px] rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">Beta</span>
        </button>
      </div>

      {/* Main Intake Container */}
      <div
        className="rounded-3xl p-3 sm:p-5 transition-all duration-200"
        style={{
          background: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.95)",
          boxShadow: "0 12px 40px rgba(59, 130, 246, 0.12), 0 2px 10px rgba(0, 0, 0, 0.04)",
        }}
      >
        <AnimatePresence mode="wait">
          {activeTab === "upload" ? (
            <motion.div
              key="tab-upload"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.avi,.mkv,.webm"
                className="hidden"
                onChange={onFileInputChange}
              />

              {uploadProgress !== null ? (
                /* Uploading State */
                <div className="py-8 px-6 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto text-blue-600">
                    <Loader2 className="w-7 h-7 animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{uploadStatus}</p>
                    <p className="text-xs text-slate-500 mt-1">{selectedFile?.name}</p>
                  </div>
                  <div className="w-full max-w-md mx-auto bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                /* Ready / Dropzone State */
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? "border-blue-500 bg-blue-50/60 scale-[0.99]"
                      : "border-slate-300 hover:border-blue-400 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-100/70 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-1">
                    Drag & Drop your video file here
                  </h3>
                  <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
                    MP4, MOV, or WEBM up to 2GB. Pristine 9:16 vertical crop with word-level subtitles.
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-semibold shadow-md shadow-blue-500/20 hover:opacity-95 transition-all"
                  >
                    <FileVideo className="w-3.5 h-3.5" />
                    <span>Select Video from Device</span>
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            /* YouTube URL Tab (Mockup / Beta Preview) */
            <motion.div
              key="tab-youtube"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <form onSubmit={handleYoutubeSubmit} className="space-y-3">
                <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-200 p-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <div className="pl-3 pr-2 text-slate-400">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="flex-1 min-w-0 bg-transparent py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!youtubeUrl.trim()}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-semibold shadow-md shadow-blue-500/20 hover:opacity-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Extract</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between px-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-3 h-3" />
                    YouTube imports may experience queueing or anti-bot delays.
                  </span>
                  <span>Direct MP4 upload is instant</span>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        {error && (
          <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
