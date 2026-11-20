"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
import HeroCardGallery from "./HeroCardGallery";

const ROTATING_PHRASES = [
  "Tasteful Clips",
  "Get More Views",
  "According to your Niche",
  "Hyperpersonalised Content",
];

export default function HeroStudio() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % ROTATING_PHRASES.length);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

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
    <section className="relative w-full min-h-[480px] flex flex-col items-center justify-start bg-black text-white pt-24 sm:pt-28 pb-20 font-sans">
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
            <motion.span
              layout
              transition={{ layout: { duration: 0.3, ease: "easeOut" } }}
              className="relative inline-flex items-center justify-center overflow-hidden px-4 py-1 rounded-full bg-white/10 border border-white/15 text-white backdrop-blur-md h-[1.35em]"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={ROTATING_PHRASES[phraseIndex]}
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -24, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-block whitespace-nowrap"
                >
                  {ROTATING_PHRASES[phraseIndex]}
                </motion.span>
              </AnimatePresence>
            </motion.span>
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
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 border-0 py-1.5"
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

        {/* ── 3D Rotating Card Gallery Showcase (DiMaac ImageGallery) ── */}
        <HeroCardGallery />
      </div>

      {/* Loading transition */}
      {isSubmitting && url && (
        <SickLoadingTransition url={url} autoRedirect={true} />
      )}
    </section>
  );
}
