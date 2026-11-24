"use client";

import { useState, useRef, useEffect, type CSSProperties, type DragEvent, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { submitLocalVideo, submitYouTubeUrl, uploadVideoFile } from "@/lib/api";
import ShatterPhrase from "./ShatterPhrase";
import { animateHeroThumbnails } from "./hero-thumbnail-transfers";
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

  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (heroRef.current) return animateHeroThumbnails(heroRef.current, styles.flyingPhoto);
  }, []);

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
        ref={heroRef}
        id="homepage-hero"
        data-section-name="hero-message"
        aria-label="Hero message"
        className={`relative flex min-h-[calc(100svh-4rem)] w-full items-center justify-center overflow-hidden px-5 py-20 text-white sm:px-8`}
      >
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
              data-orbit-thumbnail
              style={{
                "--start-angle": `${-112 + index * 360 / WHEEL_PHOTOS.length}deg`,
                "--entry-delay": `${index * 62}ms`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className={styles.thumbnailLayer} data-thumbnail-layer aria-hidden="true" />
        <div className="pointer-events-none relative z-[1] mx-auto flex w-full max-w-[1500px] flex-col items-center text-center">
          <div className={`${styles.entryCopy} pointer-events-auto flex w-full flex-col items-center cursor-default`}>
            <p className="mb-7 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 sm:text-xs lg:mb-6 lg:text-[10px]">RelatiV <span className="mx-2 text-zinc-700">/</span> Made to move</p>
            <h1 className="w-full max-w-[1200px] text-[clamp(2.625rem,6.8vw,7rem)] font-sans font-medium leading-[0.98] tracking-[-0.05em] text-white lg:text-[clamp(3.75rem,5.8vw,5.25rem)]">
              Turn{" "}
              <span className={styles.headlineEnd}>
                <span className={styles.featuredSlot} data-thumbnail-slot="opening" aria-hidden="true" />
                any
              </span>{" "}
              footage{" "}
              <span className={styles.headlineEnd}>
                <span className={styles.featuredSlot} data-thumbnail-slot="headline" aria-hidden="true" />
                into
              </span>
              <span className="mt-3 flex w-full items-center text-[clamp(1.9475rem,5.002vw,5.125rem)] font-medium tracking-[-0.035em] text-zinc-300 sm:mt-5 lg:mt-4 lg:text-[clamp(2.75rem,4.25vw,3.875rem)]">
                <ShatterPhrase
                  phrases={HERO_PHRASES}
                  thumbnailSlot={<span className={`${styles.featuredSlot} ${styles.shatterSlot}`} data-thumbnail-slot="shatter" aria-hidden="true" />}
                />
              </span>
            </h1>
            <p className="mt-7 text-[clamp(1.75rem,4vw,3.875rem)] font-sans font-semibold leading-none tracking-[-0.04em] text-white lg:mt-6 lg:text-[clamp(2.25rem,3.2vw,2.875rem)]">20×{" "}
              <span className={styles.headlineEnd}>
                <span className={styles.featuredSlot} data-thumbnail-slot="speed" aria-hidden="true" />
                faster
              </span>
            </p>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base lg:mt-5 lg:max-w-lg lg:text-sm">
              Paste a link or drop a raw take. RelatiV finds the moments, edits the clips, and sizes them for every platform.
            </p>
          </div>
          <div className="mt-12 w-full max-w-[64rem] pointer-events-auto lg:mt-10 lg:max-w-[52rem]">
            <form
              onSubmit={handleSubmit}
              aria-label="Create clips"
              aria-busy={pending !== null}
              className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3 sm:flex-nowrap"
            >
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="flex min-h-14 w-full min-w-0 items-center gap-2.5 rounded-full bg-black py-1.5 pl-4 pr-1.5 text-left text-white ring-1 ring-inset ring-white/20 shadow-[0_8px_30px_#0003] focus-within:ring-2 focus-within:ring-sky-400 sm:w-auto sm:flex-1 sm:gap-3 sm:pl-5"
              >
                <Link2 className="size-5 shrink-0 text-zinc-300" aria-hidden="true" />
                <input
                  type="text"
                  inputMode="url"
                  aria-label="YouTube video link"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="Paste a YouTube link"
                  className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm placeholder:text-zinc-400 focus:outline-none sm:text-base"
                />
                <button
                  type="submit"
                  disabled={pending !== null}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-wait sm:px-7"
                >
                  {pending === "link" ? "Starting…" : "Get clips"}
                </button>
              </div>

              <span className="text-sm text-zinc-400" aria-hidden="true">or</span>
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
                className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-black px-6 text-sm font-semibold text-white ring-1 ring-inset ring-white/20 transition hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-wait sm:min-h-14 sm:px-7"
              >
                {pending === "upload" ? "Uploading…" : "Upload"}
              </button>
            </form>
            {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
          </div>
        </div>
      </section>
    </>
  );
}
