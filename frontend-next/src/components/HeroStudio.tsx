"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { uploadVideoFile } from "@/lib/api";
import SickLoadingTransition from "./SickLoadingTransition";

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
    <>
      <section id="homepage-hero" className="relative flex min-h-[calc(100svh-4rem)] w-full items-center justify-center overflow-hidden bg-[#050507] px-5 py-20 text-white sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(45,38,62,0.22),transparent_58%)]" />
        <div className="relative z-[1] mx-auto flex w-full max-w-[1500px] flex-col items-center text-center">
          <p className="mb-7 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 sm:text-xs">RelatiV <span className="mx-2 text-zinc-700">/</span> Made to move</p>
          <h1 className="max-w-[1200px] text-[clamp(3rem,8vw,8rem)] font-display font-semibold leading-[0.98] tracking-[-0.055em] text-white">
            Turn any footage into
            <span className="mt-3 block text-[0.72em] font-medium tracking-[-0.045em] text-zinc-300 sm:mt-5">personalized short clips</span>
          </h1>
          <p className="mt-7 text-[clamp(2rem,4.8vw,4.5rem)] font-display font-extrabold leading-none tracking-[-0.045em] text-white">20× faster</p>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base lg:text-lg">
            Paste a link or drop a raw take. RelatiV finds the moments, edits the clips, and sizes them for every platform.
          </p>
          <div className="mt-10 w-full max-w-5xl pointer-events-auto">
            <form
              onSubmit={handleSubmit}
              className="flex min-h-[76px] items-center rounded-xl border border-white/20 bg-black/60 p-2 sm:min-h-[88px] sm:p-2.5 backdrop-blur-xl shadow-2xl focus-within:border-white/40 transition"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="pl-3 pr-2 sm:pl-4 text-zinc-400 hover:text-white cursor-pointer transition shrink-0"
                title="Upload video file"
                aria-label="Upload video file"
              >
                <Link2 className="w-5 h-5" />
              </button>

              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Drop a video link or upload a file"
                className="w-full min-w-0 bg-transparent text-sm sm:text-lg text-white placeholder-zinc-500 outline-none ring-0 border-0 py-2.5 sm:py-3"
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <button type="submit" className="px-4 sm:px-6 py-3 sm:py-4 rounded-lg bg-white text-black hover:bg-zinc-200 text-sm sm:text-base font-bold transition shrink-0 cursor-pointer shadow-sm">
                Get free clips
              </button>

              <span className="hidden sm:inline text-zinc-500 text-sm px-2 sm:px-3 shrink-0">or</span>
              <button type="button" onClick={() => router.push("/dashboard")} className="hidden sm:inline text-sm text-zinc-300 hover:text-white font-medium pr-3 sm:pr-4 shrink-0 transition cursor-pointer">
                Auto-edit
              </button>
            </form>
            {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
          </div>
          <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Scroll to explore ↓</p>
        </div>
      </section>

      {isSubmitting && url && <SickLoadingTransition url={url} autoRedirect />}
    </>
  );
}
