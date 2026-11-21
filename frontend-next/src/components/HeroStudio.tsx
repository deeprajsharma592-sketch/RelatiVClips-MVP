"use client";

import { useState, useRef, type CSSProperties, type DragEvent, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2, Upload } from "lucide-react";
import { submitLocalVideo, submitYouTubeUrl, uploadVideoFile } from "@/lib/api";
import ShatterPhrase from "./ShatterPhrase";
import styles from "./HeroStudio.module.css";

const WHEEL_PHOTOS = [
  "tinted-glasses", "neon-profile", "gold-visor", "red-coat", "lime-blazer",
  "orange-visor", "chunky-knit", "purple-hoodie", "platinum-blonde", "orange-ring",
];

const HERO_PHRASES = ["personalized short clips", "more views in less time", "ready for every platform", "make every moment count"];

export default function HeroStudio() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState<"upload" | "link" | null>(null);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startJob = async (source: string | File) => {
    if (submitting.current) return;
    submitting.current = true;
    setPending(typeof source === "string" ? "link" : "upload");
    setError(null);
    try {
      const job = typeof source === "string"
        ? await submitYouTubeUrl(source)
        : await submitLocalVideo((await uploadVideoFile(source)).filePath);
      if (!job.taskId) throw new Error("The processing service did not return a clip job.");
      router.push(`/process?${new URLSearchParams({ taskId: job.taskId })}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start processing. Try again.");
      submitting.current = false;
      setPending(null);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const source = url.trim();
    if (!source) {
      setError("Paste a YouTube link or upload a video to get started.");
      return;
    }
    void startJob(source);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (pending !== null) return;
    const file = event.dataTransfer.files[0];
    if (file) {
      if (file.type && !file.type.startsWith("video/")) {
        setError("Choose a video file to upload.");
        return;
      }
      void startJob(file);
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
        className={`${styles.entry} relative flex min-h-[calc(100svh-4rem)] w-full items-center justify-center overflow-hidden bg-[#050507] px-5 py-20 text-white sm:px-8`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(45,38,62,0.22),transparent_58%)]" />
        <div className={styles.wheel} aria-hidden="true">
          {WHEEL_PHOTOS.map((photo, index) => (
            <Image
              key={photo}
              src={`/hero-wheel/${photo}-4x5.jpg`}
              alt=""
              width={160}
              height={200}
              loading="eager"
              unoptimized
              className={styles.photo}
              style={{
                "--start-angle": `${-112 + index * 360 / WHEEL_PHOTOS.length}deg`,
                "--entry-delay": `${index * 62}ms`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className="pointer-events-none relative z-[1] mx-auto flex w-full max-w-[1500px] flex-col items-center text-center">
          <div className={`${styles.entryCopy} pointer-events-auto flex max-w-full flex-col items-center`}>
            <p className="mb-7 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 sm:text-xs">RelatiV <span className="mx-2 text-zinc-700">/</span> Made to move</p>
            <h1 className="max-w-[1200px] text-[clamp(2.625rem,6.8vw,7rem)] font-sans font-medium leading-[0.98] tracking-[-0.05em] text-white">
              Turn any footage into
              <span className="mt-3 block w-full text-[0.62em] font-sans font-medium tracking-[-0.035em] text-zinc-300 sm:mt-5">
                <ShatterPhrase phrases={HERO_PHRASES} />
              </span>
            </h1>
            <p className="mt-7 text-[clamp(1.75rem,4vw,3.875rem)] font-sans font-semibold leading-none tracking-[-0.04em] text-white">20× faster</p>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base lg:text-lg">
              Paste a link or drop a raw take. RelatiV finds the moments, edits the clips, and sizes them for every platform.
            </p>
          </div>
          <div className="mt-10 w-full max-w-[56rem] pointer-events-auto">
            <form
              onSubmit={handleSubmit}
              aria-label="Create clips"
              aria-busy={pending !== null}
              className="flex items-center gap-1.5 rounded-[28px] border border-zinc-300 bg-white p-1.5 shadow-[0_8px_30px_#0002] sm:gap-2 dark:border-[#373044] dark:bg-[#191621] dark:shadow-black/30"
            >
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[20px] border border-zinc-200 bg-zinc-50 px-2 focus-within:border-violet-500 sm:min-h-12 sm:px-3 dark:border-[#373044] dark:bg-[#100e17] dark:focus-within:border-violet-400"
              >
                <Link2 className="hidden size-4 shrink-0 text-zinc-500 sm:block dark:text-zinc-400" aria-hidden="true" />
                <input
                  type="text"
                  inputMode="url"
                  aria-label="Video link"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="Paste a link"
                  className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm text-zinc-900 placeholder:text-zinc-600 focus-visible:outline-none sm:text-base dark:text-white dark:placeholder:text-zinc-400"
                />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void startJob(file);
                }}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={pending !== null}
                aria-label="Upload file"
                title="Upload file"
                className="inline-flex min-h-11 min-w-10 shrink-0 items-center justify-center gap-2 rounded-[20px] border border-zinc-200 px-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-wait sm:min-h-12 sm:px-3 dark:border-[#373044] dark:text-zinc-200 dark:hover:bg-white/10"
              >
                <Upload className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Upload file</span>
              </button>

              <button
                type="submit"
                disabled={pending !== null}
                aria-label={pending ? "Starting clip generation" : "Get free clips"}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[20px] bg-violet-700 px-2.5 text-sm font-bold text-white transition hover:bg-violet-800 disabled:cursor-wait sm:min-h-12 sm:px-4 dark:bg-violet-200 dark:text-violet-950 dark:hover:bg-violet-100"
              >
                {pending ? (pending === "upload" ? "Uploading…" : "Starting…") : (
                  <>
                    <span className="sm:hidden">Get clips</span>
                    <span className="hidden sm:inline">Get free clips</span>
                    <ArrowRight className="hidden size-4 sm:block" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
            {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
          </div>
        </div>
      </section>
    </>
  );
}
