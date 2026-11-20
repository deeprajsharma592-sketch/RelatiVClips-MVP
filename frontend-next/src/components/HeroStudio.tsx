"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  UploadCloud,
  ArrowRight,
  Link2,
  Film,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { uploadVideoFile } from "@/lib/api";
import SickLoadingTransition from "./SickLoadingTransition";
import GravityPhrase from "./GravityPhrase";

const ROTATING_PHRASES = [
  "Tasteful Clips",
  "Get More Views",
  "According to your Niche",
  "Hyperpersonalised Clips",
];

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
    <section className="relative w-full min-h-[calc(100svh-72px)] flex items-center justify-center bg-black text-white px-4 sm:px-6 py-16 sm:py-20 overflow-hidden font-sans">
      {/* Main text, subtitle, and input bar sit on a clean background. */}
      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-2 sm:px-6 text-center flex flex-col items-center space-y-8 pointer-events-none">
        {/* Master Headline (OpusClip exact match) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="w-full flex flex-col items-center justify-center space-y-4 select-none"
        >
          <h1 className="text-[clamp(2.5rem,6.4vw,6.5rem)] font-display font-extrabold tracking-tight text-white leading-[1.06] drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)]">
            Turn any footage into
          </h1>

          {/* Gravity Letters transition replaces the continuously rotating phrase. */}
          <div className="relative z-20 flex w-full items-center justify-center text-[clamp(1.55rem,4.8vw,4.75rem)] font-display font-extrabold tracking-tight text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)]">
            <GravityPhrase phrases={ROTATING_PHRASES} />
          </div>

          {/* 20x faster on the layer below */}
          <div className="relative z-10 text-[clamp(2rem,4.8vw,4.75rem)] font-display font-extrabold tracking-tight text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)]">
            20x faster
          </div>
        </motion.div>

        {/* Subtitle (OpusClip exact match) */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-sm sm:text-base lg:text-lg text-zinc-300 max-w-3xl mx-auto leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]"
        >
          Paste a link or drop a raw take, and RelatiV clips, edits, sizes and publishes them to all social platforms in one click.
        </motion.p>

        {/* ── Centered Input Bar (OpusClip exact match) ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-5xl mx-auto pt-2 pointer-events-auto"
        >
          <form
            onSubmit={handleSubmit}
            className="flex items-center rounded-xl border border-white/20 bg-black/60 p-2 sm:p-2.5 backdrop-blur-xl shadow-2xl focus-within:border-white/40 transition"
          >
            <div
              onClick={() => fileInputRef.current?.click()}
              className="pl-3 pr-2 sm:pl-4 text-zinc-400 hover:text-white cursor-pointer transition shrink-0"
              title="Upload video file"
            >
              <Link2 className="w-5 h-5" />
            </div>

            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Drop a video link or upload a file"
              className="w-full bg-transparent text-sm sm:text-base text-white placeholder-zinc-500 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 border-0 py-2.5 sm:py-3"
              style={{ outline: "none", boxShadow: "none" }}
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
              className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-lg bg-white text-black hover:bg-zinc-200 text-sm sm:text-base font-bold transition shrink-0 cursor-pointer shadow-sm"
            >
              Get free clips
            </button>

            <span className="text-zinc-500 text-sm sm:text-base px-2 sm:px-3 shrink-0">or</span>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-sm sm:text-base text-zinc-300 hover:text-white font-medium pr-3 sm:pr-4 shrink-0 transition cursor-pointer"
            >
              Auto-edit
            </button>
          </form>

          {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
        </motion.div>
      </div>

      {/* Loading transition */}
      {isSubmitting && url && (
        <SickLoadingTransition url={url} autoRedirect={true} />
      )}
    </section>
  );
}
