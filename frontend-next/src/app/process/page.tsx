"use client";

/**
 * /process — Handles URL submission from anywhere on the site.
 *
 * Used by the landing page's PasteLinkInput hero+sticky variants.
 * Takes ?url=... from the query string, submits to the backend,
 * polls for completion, and renders the results.
 *
 * This is the "real workspace" page — the landing page just hands
 * off here once a user pastes a URL.
 */

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Check, AlertCircle, ArrowRight, Video } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyInputBar from "@/components/StickyInputBar";
import { submitYouTubeUrl, checkProcessingStatus } from "@/lib/api";
import type { ProcessState, Clip } from "@/types";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000; // 5 min hard cap

const STEPS = [
  { key: "fetch", label: "Fetching source", sub: "YouTube · proxy rotation" },
  { key: "transcribe", label: "Transcribing", sub: "Whisper · local CPU" },
  { key: "detect", label: "Detecting moments", sub: "librosa · energy peaks" },
  { key: "calibrate", label: "Tasting clips", sub: "Claude · hook scoring" },
  { key: "render", label: "Rendering", sub: "FFmpeg · 9:16 export" },
];

export default function ProcessPage() {
  return (
    <Suspense fallback={<ProcessFallback />}>
      <ProcessInner />
    </Suspense>
  );
}

function ProcessFallback() {
  return (
    <>
      <Header />
      <StickyInputBar />
      <main className="relative min-h-[calc(100vh-68px)] flex items-center justify-center">
        <Loader2
          className="h-6 w-6 animate-spin"
          style={{ color: "var(--color-text-muted)" }}
        />
      </main>
    </>
  );
}

function ProcessInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialUrl = params.get("url") || "";

  const [url, setUrl] = useState(initialUrl);
  const [state, setState] = useState<ProcessState>(initialUrl ? "processing" : "idle");
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const taskIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);

  // Auto-start if URL was provided
  useEffect(() => {
    if (initialUrl && state === "processing" && !taskIdRef.current) {
      startProcessing(initialUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step rotation while processing
  useEffect(() => {
    if (state !== "processing") return;
    const t = setInterval(() => {
      setActiveStep((s) => (s + 1) % STEPS.length);
    }, 1400);
    return () => clearInterval(t);
  }, [state]);

  // Elapsed timer
  useEffect(() => {
    if (state !== "processing") return;
    const t = setInterval(() => {
      if (startedAtRef.current > 0) {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  const startProcessing = useCallback(
    async (targetUrl: string) => {
      setError(null);
      setClips([]);
      setActiveStep(0);
      setState("processing");
      startedAtRef.current = Date.now();
      try {
        const init = await submitYouTubeUrl(targetUrl);
        taskIdRef.current = init.taskId;
        const deadline = Date.now() + MAX_POLL_DURATION_MS;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          const status = await checkProcessingStatus(init.taskId);
          if (status.status === "complete") {
            setClips(status.clips ?? []);
            setActiveStep(STEPS.length - 1);
            setState("completed");
            return;
          }
          if (status.status === "failed") {
            setError(status.error || "Processing failed. Try a different video.");
            setState("error");
            return;
          }
        }
        setError("Timed out. Try a shorter video or come back later.");
        setState("error");
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
        setState("error");
      }
    },
    []
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = url.trim();
      if (!trimmed) return;
      // Update URL so the state is shareable
      router.replace(`/process?url=${encodeURIComponent(trimmed)}`);
      startProcessing(trimmed);
    },
    [url, router, startProcessing]
  );

  return (
    <>
      <Header />
      <StickyInputBar />

      <main className="relative min-h-[calc(100vh-68px)] pt-32 pb-24">
        <div className="relative max-w-5xl mx-auto px-6">
          {/* Hero header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-5">
              <span
                className="text-[11px] font-mono"
                style={{ color: "var(--color-text-muted)" }}
              >
                01
              </span>
              <span
                className="h-px w-12"
                style={{ background: "var(--color-border-strong)" }}
              />
              <span
                className="text-[11px] font-mono uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                Workspace
              </span>
            </div>
            <h1
              className="font-display font-semibold max-w-3xl mx-auto"
              style={{
                fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.04em",
                color: "var(--color-text-primary)",
              }}
            >
              {state === "completed" ? (
                <>
                  <span
                    className="font-fraunces-italic"
                    style={{ color: "var(--color-accent)", fontWeight: 400 }}
                  >
                    {clips.length} clips
                  </span>{" "}
                  ready to ship
                </>
              ) : state === "error" ? (
                <>
                  <span style={{ color: "var(--color-accent)" }}>Hmm,</span>{" "}
                  something broke
                </>
              ) : state === "processing" ? (
                <>
                  The engine is{" "}
                  <span
                    className="font-fraunces-italic"
                    style={{ color: "var(--color-accent)", fontWeight: 400 }}
                  >
                    working
                  </span>
                </>
              ) : (
                <>
                  Paste a URL.{" "}
                  <span
                    className="font-fraunces-italic"
                    style={{ color: "var(--color-accent)", fontWeight: 400 }}
                  >
                    Get ten clips.
                  </span>
                </>
              )}
            </h1>
          </div>

          {/* Input (visible in idle/error states) */}
          {(state === "idle" || state === "error") && (
            <form
              onSubmit={handleSubmit}
              className="max-w-2xl mx-auto mb-8"
            >
              <div
                className="flex items-stretch gap-0 rounded-full overflow-hidden"
                style={{
                  background: "var(--glass-light-strong)",
                  backdropFilter: "blur(20px) saturate(180%)",
                  WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  border: "1px solid var(--color-border)",
                  boxShadow:
                    "0 8px 24px rgba(40, 30, 20, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
                }}
              >
                <input
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                  className="flex-1 min-w-0 bg-transparent px-6 py-4 text-[15px] outline-none placeholder:text-[var(--color-text-muted)]/70"
                  style={{ color: "var(--color-text-primary)" }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!url.trim()}
                  className="m-1.5 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[13px] font-semibold transition-all disabled:opacity-40"
                  style={{
                    background:
                      "linear-gradient(135deg, #D946EF 0%, #F59E0B 100%)",
                    color: "#FFFFFF",
                    boxShadow:
                      "0 4px 14px rgba(217, 70, 239, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
                  }}
                >
                  Get clips
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              {error && (
                <p
                  className="mt-4 ml-6 flex items-center gap-1.5 text-[13px]"
                  style={{ color: "var(--color-accent)" }}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {error}
                </p>
              )}
            </form>
          )}

          {/* Processing steps */}
          <AnimatePresence>
            {state === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto"
              >
                <div
                  className="rounded-3xl p-6 md:p-8 space-y-3"
                  style={{
                    background: "var(--glass-light-strong)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    border: "1px solid var(--color-border)",
                    boxShadow:
                      "0 8px 24px rgba(40, 30, 20, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      style={{ color: "var(--color-accent)" }}
                    />
                    <span
                      className="text-[12px] font-mono uppercase tracking-wider"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Processing · {elapsedSec}s
                    </span>
                  </div>
                  {STEPS.map((step, i) => {
                    const isActive = i === activeStep;
                    const isPast = i < activeStep;
                    return (
                      <div
                        key={step.key}
                        className="flex items-center gap-3 p-3 rounded-2xl"
                        style={{
                          background: isActive
                            ? "linear-gradient(135deg, rgba(217, 70, 239, 0.08) 0%, transparent 100%)"
                            : "transparent",
                          transition: "background 0.3s ease",
                        }}
                      >
                        <div
                          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-semibold"
                          style={{
                            background: isPast
                              ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                              : isActive
                              ? "linear-gradient(135deg, #D946EF 0%, #F59E0B 100%)"
                              : "var(--color-surface-2)",
                            color: isPast || isActive ? "#FFFFFF" : "var(--color-text-muted)",
                          }}
                        >
                          {isPast ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </div>
                        <div className="flex-1">
                          <p
                            className="text-[14px] font-medium"
                            style={{ color: "var(--color-text-primary)" }}
                          >
                            {step.label}
                          </p>
                          <p
                            className="text-[10px] font-mono"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            {step.sub}
                          </p>
                        </div>
                        {isActive && (
                          <Sparkles
                            className="h-3.5 w-3.5 animate-pulse"
                            style={{ color: "var(--color-accent)" }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {state === "completed" && clips.length > 0 && (
              <motion.div
                key="completed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-5xl mx-auto"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {clips.map((clip, i) => (
                    <motion.div
                      key={clip.clip_id || i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: "var(--glass-light-strong)",
                        backdropFilter: "blur(20px) saturate(180%)",
                        WebkitBackdropFilter: "blur(20px) saturate(180%)",
                        border: "1px solid var(--color-border)",
                        boxShadow:
                          "0 8px 24px rgba(40, 30, 20, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
                      }}
                    >
                      <div
                        className="relative aspect-video flex items-center justify-center"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(217, 70, 239, 0.15) 0%, rgba(252, 211, 77, 0.15) 100%)",
                        }}
                      >
                        <Video
                          className="h-8 w-8"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                      </div>
                      <div className="p-4">
                        <p
                          className="text-[14px] font-semibold leading-snug mb-1"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {clip.viral_title || `Clip ${i + 1}`}
                        </p>
                        <p
                          className="text-[12px] leading-relaxed line-clamp-2"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          {clip.caption}
                        </p>
                        <div
                          className="mt-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          <span>{clip.duration_s?.toFixed(1)}s</span>
                          <span style={{ color: "var(--color-text-faint)" }}>
                            ·
                          </span>
                          <span>9:16 ready</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-8 text-center">
                  <button
                    onClick={() => {
                      setState("idle");
                      setClips([]);
                      setUrl("");
                      router.replace("/process");
                    }}
                    className="text-[12px] font-mono transition-colors hover:underline"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    ← Process another video
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <Footer />
    </>
  );
}
