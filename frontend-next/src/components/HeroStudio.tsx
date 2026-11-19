"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  UploadCloud,
  ArrowRight,
  Link2,
  Play,
  Film,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { uploadVideoFile } from "@/lib/api";
import SickLoadingTransition from "./SickLoadingTransition";
import { YoutubeIcon, TiktokIcon, InstagramIcon } from "./dashboard/SocialAccountsView";

export default function HeroStudio() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setIsSubmitting(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { taskId } = await uploadVideoFile(file);
      router.push(`/dashboard?taskId=${taskId}`);
    } catch {
      setError("Upload failed. Try pasting a YouTube link instead.");
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative w-full min-h-[740px] flex flex-col items-center justify-start bg-black text-white pt-24 sm:pt-28 pb-16 font-sans">
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center space-y-6">
        {/* Eyebrow Badge (OpusClip exact match) */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider text-zinc-400 border border-white/[0.08] bg-white/[0.02]"
        >
          <span>#1 AI VIDEO EDITOR AND CLIPPING TOOL</span>
        </motion.div>

        {/* Master Headline (OpusClip exact match) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="space-y-2 select-none"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold tracking-tight text-white leading-[1.1]">
            Turn any footage into
          </h1>
          <div className="flex items-center justify-center flex-wrap gap-2 text-3xl sm:text-4xl md:text-5xl font-display font-extrabold tracking-tight">
            <span className="px-4 py-1 rounded-full bg-white/10 border border-white/15 text-white backdrop-blur-md">
              a week of posts
            </span>
            <span className="text-white">10x faster</span>
          </div>
        </motion.div>

        {/* Subtitle (OpusClip exact match) */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed"
        >
          Paste a link or drop a raw take, and RelatiV clips, edits, sizes and publishes them to all social platforms in one click.
        </motion.p>

        {/* ── Centered Input Bar (OpusClip exact match) ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-xl mx-auto pt-2"
        >
          <form
            onSubmit={handleSubmit}
            className="flex items-center rounded-full border border-white/20 bg-white/[0.04] p-1.5 backdrop-blur-md shadow-2xl focus-within:border-white/40 transition"
          >
            <div
              onClick={() => fileInputRef.current?.click()}
              className="pl-3 pr-2 text-zinc-400 hover:text-white cursor-pointer transition shrink-0"
              title="Upload video file"
            >
              <Link2 className="w-4 h-4" />
            </div>

            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Drop a video link or upload a file"
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none py-1.5"
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="submit"
              className="px-4 py-2 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-bold transition shrink-0 cursor-pointer shadow-sm"
            >
              Get free clips
            </button>

            <span className="text-zinc-500 text-xs px-2 shrink-0">or</span>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-xs text-zinc-300 hover:text-white font-medium pr-3 shrink-0 transition cursor-pointer"
            >
              Auto-edit
            </button>
          </form>

          {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
        </motion.div>

        {/* ── PRODUCT SHOWCASE MOCKUP (OpusClip exact match from Image 3) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-3xl mx-auto pt-6"
        >
          <div className="relative rounded-2xl border border-white/10 bg-[#0E0E12] overflow-hidden shadow-2xl p-4 sm:p-6 text-left space-y-4">
            {/* Top Video Preview Thumbnail */}
            <div className="relative aspect-video max-h-[340px] w-full rounded-xl bg-black overflow-hidden flex items-center justify-center">
              <img
                src="/thumb_r2.webp"
                alt="Product preview demo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

              {/* Timecode badge like reference */}
              <div className="absolute bottom-3 right-3">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-black/80 text-zinc-300 border border-white/10">
                  1:40:35
                </span>
              </div>

              {/* Center play button */}
              <button
                onClick={() => router.push("/dashboard")}
                className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 flex items-center justify-center transition cursor-pointer"
              >
                <Play className="w-5 h-5 text-white ml-0.5 fill-white" />
              </button>
            </div>

            {/* Bottom Bar: Quick 1-click prompt & Social Icons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 w-full sm:w-72">
                  <span className="truncate">Drop a long video and...</span>
                  <span className="ml-auto text-[11px] font-semibold text-white px-2 py-0.5 rounded bg-white/10">
                    Get clips
                  </span>
                </div>
              </div>

              {/* Social destinations */}
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span>Auto-post to:</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-red-600/80 flex items-center justify-center text-white">
                    <YoutubeIcon className="w-3 h-3" />
                  </div>
                  <div className="w-6 h-6 rounded bg-zinc-800 border border-white/20 flex items-center justify-center text-white">
                    <TiktokIcon className="w-3 h-3" />
                  </div>
                  <div className="w-6 h-6 rounded bg-zinc-800 border border-white/20 flex items-center justify-center text-white">
                    <InstagramIcon className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Loading transition */}
      {isSubmitting && url && (
        <SickLoadingTransition url={url} autoRedirect={true} />
      )}
    </section>
  );
}
