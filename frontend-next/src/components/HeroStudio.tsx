"use client";

import { useState, useRef, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { uploadVideoFile } from "@/lib/api";
import SickLoadingTransition from "./SickLoadingTransition";
import ShatterPhrase from "./ShatterPhrase";

const HERO_PHRASES = ["personalized short clips", "more views in less time", "ready for every platform", "make every moment count"];

export default function HeroStudio() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [clipUrl, setClipUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isUploading || !url.trim()) return;
    setClipUrl(url.trim());
  };

  const uploadFile = async (file: File) => {
    if (isUploading || clipUrl) return;
    setIsUploading(true);
    setError(null);
    try {
      const { taskId } = await uploadVideoFile(file);
      router.push(`/dashboard?taskId=${taskId}`);
    } catch {
      setError("Upload failed. Try pasting a YouTube link instead.");
      setIsUploading(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (isUploading || clipUrl) return;
    const file = event.dataTransfer.files[0];
    if (file) {
      if (file.type && !file.type.startsWith("video/")) {
        setError("Choose a video file to upload.");
        return;
      }
      void uploadFile(file);
      return;
    }
    const link = event.dataTransfer.getData("text/uri-list").split("\n").find((line) => line.trim() && !line.startsWith("#"));
    const text = (link || event.dataTransfer.getData("text/plain")).trim();
    if (text) {
      setError(null);
      setUrl(text);
    }
  };

  return (
    <>
      {/* HERO MESSAGE — use this name when referring to the homepage headline and supporting copy. */}
      <section
        id="homepage-hero"
        data-section-name="hero-message"
        aria-label="Hero message"
        className="relative flex min-h-[calc(100svh-4rem)] w-full items-center justify-center overflow-hidden bg-[#050507] px-5 py-20 text-white sm:px-8"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(45,38,62,0.22),transparent_58%)]" />
        <div className="relative z-[1] mx-auto flex w-full max-w-[1500px] flex-col items-center text-center">
          <p className="mb-7 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 sm:text-xs">RelatiV <span className="mx-2 text-zinc-700">/</span> Made to move</p>
          <h1 className="max-w-[1200px] text-[clamp(3rem,8vw,8rem)] font-sans font-medium leading-[0.98] tracking-[-0.05em] text-white">
            Turn any footage into
            <span className="mt-3 block w-full text-[0.62em] font-sans font-medium tracking-[-0.035em] text-zinc-300 sm:mt-5">
              <ShatterPhrase phrases={HERO_PHRASES} />
            </span>
          </h1>
          <p className="mt-7 text-[clamp(2rem,4.8vw,4.5rem)] font-sans font-semibold leading-none tracking-[-0.04em] text-white">20× faster</p>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base lg:text-lg">
            Paste a link or drop a raw take. RelatiV finds the moments, edits the clips, and sizes them for every platform.
          </p>
          <div className="mt-10 w-full max-w-[62rem] pointer-events-auto">
            <form
              onSubmit={handleSubmit}
              aria-label="Create clips"
              aria-busy={isUploading}
              className="grid gap-3 rounded-[20px] border-2 border-zinc-900 bg-white p-3 shadow-[5px_5px_0] shadow-zinc-950 sm:gap-4 sm:rounded-[24px] sm:p-5 sm:shadow-[7px_7px_0] dark:border-zinc-600 dark:bg-zinc-900 dark:shadow-black"
            >
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="flex min-h-14 items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 pr-3 focus-within:border-zinc-600 sm:min-h-[66px] sm:gap-3 sm:pr-4 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-zinc-400"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || Boolean(clipUrl)}
                  className="ml-1.5 grid size-10 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-stone-200 hover:text-zinc-950 disabled:cursor-wait sm:ml-2.5 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  title="Upload video file"
                  aria-label="Upload video file"
                >
                  <Link2 className="size-5 sm:size-6" aria-hidden="true" />
                </button>

                <input
                  type="text"
                  inputMode="url"
                  aria-label="Video link"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="Drop a video link or upload a file"
                  className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm text-zinc-900 placeholder:text-zinc-600 focus-visible:outline-none sm:text-lg dark:text-white dark:placeholder:text-zinc-400"
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void uploadFile(file);
                  }}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-[1.25fr_1fr] gap-2.5 sm:gap-4">
                <button
                  type="submit"
                  disabled={isUploading || Boolean(clipUrl)}
                  className="min-h-12 rounded-xl border-2 border-transparent bg-zinc-950 px-2 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-wait sm:min-h-[58px] sm:px-4 sm:text-lg dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  {isUploading ? "Uploading…" : "Get free clips"}
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="min-h-12 rounded-xl border-2 border-zinc-900 px-2 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-stone-100 sm:min-h-[58px] sm:px-4 sm:text-lg dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-800"
                >
                  Auto-edit
                </button>
              </div>
            </form>
            {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
          </div>
          <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Scroll to explore ↓</p>
        </div>
      </section>

      {clipUrl && <SickLoadingTransition url={clipUrl} autoRedirect />}
    </>
  );
}
