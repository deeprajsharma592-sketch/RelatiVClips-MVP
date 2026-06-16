"use client";

/**
 * /process — Handles URL submission from anywhere on the site.
 *
 * NEW 2026-06-16: Rich, on-brand process visualization.
 *   - 6-step horizontal pipeline with per-stage animations
 *   - Live activity feed (scrolling list of recent events)
 *   - Real-time cost counter + cache hit badge
 *   - Per-stage timing breakdown (so users see "Step 4 took 12s")
 *   - Result page with video preview, download, share, cost stats
 *
 * This is the "real workspace" page — the landing page just hands
 * off here once a user pastes a URL.
 */

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Sparkles,
  Check,
  AlertCircle,
  ArrowRight,
  Video,
  Download,
  Share2,
  Clock,
  Zap,
  Coins,
  Copy,
  CheckCircle2,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyInputBar from "@/components/StickyInputBar";
import { StageAnimation } from "@/components/StageAnimation";
import { ActivityFeed, type FeedEvent } from "@/components/ActivityFeed";
import { submitYouTubeUrl, checkProcessingStatus } from "@/lib/api";
import type { ProcessState, Clip, PipelineStep, StatusResponse } from "@/types";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000; // 5 min hard cap

// Mirrors backend PIPELINE_STEPS so the UI shows the same step names the
// orchestrator reports. step_number is 1-indexed. The `vibe` field
// drives per-stage animations in StageAnimation.tsx.
const STEPS: PipelineStep[] = [
  { number: 1, label: "Fetching source",       sub: "YouTube · captions · audio",  icon: "📥", vibe: "fetch" },
  { number: 2, label: "Analyzing",             sub: "librosa · energy peaks",      icon: "🎵", vibe: "audio" },
  { number: 3, label: "Transcribing",          sub: "Captions · Whisper fallback", icon: "💬", vibe: "transcribe" },
  { number: 4, label: "Selecting clips",       sub: "Claude · hook scoring",       icon: "🧠", vibe: "llm" },
  { number: 5, label: "Detecting faces",       sub: "Center-crop · OpenCV",        icon: "👤", vibe: "face" },
  { number: 6, label: "Rendering",             sub: "FFmpeg · 9:16 export",        icon: "🎬", vibe: "render" },
];

function formatTime(secs: number): string {
  if (secs <= 0) return "0s";
  if (secs < 60) return `${Math.round(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

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
  // Backend-driven progress fields (replaces the old 1.4s rotation timer)
  const [progress, setProgress] = useState(0);
  const [stepNumber, setStepNumber] = useState(0);
  const [currentStepMsg, setCurrentStepMsg] = useState("Starting…");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [etaSec, setEtaSec] = useState<number | null>(null);
  // NEW 2026-06-16: rich status fields
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const [costPerClip, setCostPerClip] = useState<number | null>(null);
  const [llmProvider, setLlmProvider] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [cacheSavings, setCacheSavings] = useState<number | null>(null);
  const [cacheAgeH, setCacheAgeH] = useState<number | null>(null);
  const [stepTimes, setStepTimes] = useState<StatusResponse["step_times"]>([]);
  // Activity feed: keyed by event id, rendered in arrival order
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const lastStepMsgRef = useRef<string | null>(null);
  const eventCounterRef = useRef(0);
  const taskIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);

  // Auto-start if URL was provided
  useEffect(() => {
    if (initialUrl && state === "processing" && !taskIdRef.current) {
      startProcessing(initialUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Elapsed timer (independent of progress — always ticks)
  useEffect(() => {
    if (state !== "processing") return;
    const t = setInterval(() => {
      if (startedAtRef.current > 0) {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(t);
  }, [state]);

  const pushEvent = useCallback((msg: string, step?: number, kind: FeedEvent["kind"] = "sub") => {
    if (msg === lastStepMsgRef.current) return; // dedupe rapid dupes
    lastStepMsgRef.current = msg;
    const id = ++eventCounterRef.current;
    setFeed((prev) => [...prev, { id, ts: performance.now(), message: msg, step, kind }]);
  }, []);

  const startProcessing = useCallback(
    async (targetUrl: string) => {
      setError(null);
      setClips([]);
      setProgress(0);
      setStepNumber(0);
      setCurrentStepMsg("Starting…");
      setEtaSec(null);
      setCostUsd(null);
      setCacheHit(false);
      setCacheSavings(null);
      setCacheAgeH(null);
      setStepTimes([]);
      setFeed([]);
      lastStepMsgRef.current = null;
      eventCounterRef.current = 0;
      setState("processing");
      startedAtRef.current = Date.now();
      try {
        pushEvent("Submitting URL to pipeline…", undefined, "info");
        const init = await submitYouTubeUrl(targetUrl);
        taskIdRef.current = init.taskId;
        pushEvent(`Pipeline started · task ${init.taskId.slice(0, 8)}`, undefined, "info");
        const deadline = Date.now() + MAX_POLL_DURATION_MS;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          const status = await checkProcessingStatus(init.taskId);

          // Backend is the source of truth — drive the bar from real data
          if (typeof status.progress === "number") {
            setProgress((prev) => Math.max(prev, Math.min(100, status.progress ?? 0)));
          }
          if (typeof status.step_number === "number" && status.step_number > 0) {
            const newStep = status.step_number;
            setStepNumber((prev) => {
              if (newStep > prev) pushEvent(`Entered stage ${newStep}: ${STEPS[newStep - 1]?.label ?? ""}`, newStep, "step");
              return Math.max(prev, newStep);
            });
          }
          if (status.current_step) {
            setCurrentStepMsg(status.current_step);
            pushEvent(status.current_step, status.step_number ?? undefined, "sub");
          }
          if (typeof status.time_estimate_seconds === "number") {
            setEtaSec(status.time_estimate_seconds);
          }
          // Cost + cache + per-step timing
          if (typeof status.llm_cost_usd === "number" && status.llm_cost_usd > 0) {
            setCostUsd(status.llm_cost_usd);
          }
          if (typeof status.cost_per_clip_usd === "number") {
            setCostPerClip(status.cost_per_clip_usd);
          }
          if (status.llm_provider) setLlmProvider(status.llm_provider);
          if (status.cache_hit) {
            setCacheHit(true);
            if (typeof status.cache_savings_usd === "number") setCacheSavings(status.cache_savings_usd);
            if (typeof status.cache_age_hours === "number") setCacheAgeH(status.cache_age_hours);
          }
          if (status.step_times) setStepTimes(status.step_times);

          if (status.status === "complete") {
            setProgress(100);
            setStepNumber(STEPS.length);
            setClips(status.clips ?? []);
            setState("completed");
            if (cacheHit) {
              pushEvent(`Cache hit · ${(status.clips ?? []).length} clips served instantly`, undefined, "cache");
            } else {
              pushEvent(`Done · ${(status.clips ?? []).length} clips ready`, undefined, "step");
            }
            return;
          }
          if (status.status === "failed") {
            setError(status.error || "Processing failed. Try a different video.");
            setState("error");
            pushEvent(status.error || "Processing failed", undefined, "error");
            return;
          }
        }
        setError("Timed out. Try a shorter video or come back later.");
        setState("error");
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
        setState("error");
        pushEvent(err instanceof Error ? err.message : "Unexpected error", undefined, "error");
      }
    },
    [pushEvent, cacheHit]
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
                <div className="mt-4 ml-6 flex items-start gap-2 text-[13px]" style={{ color: "var(--color-accent)" }}>
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div>{error}</div>
                    <button
                      onClick={handleSubmit}
                      className="mt-2 text-[12px] underline opacity-80 hover:opacity-100"
                    >
                      Try a different URL
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* Processing dashboard */}
          <AnimatePresence>
            {state === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-5xl mx-auto"
              >
                <div
                  className="rounded-3xl p-6 md:p-8"
                  style={{
                    background: "var(--glass-light-strong)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    border: "1px solid var(--color-border)",
                    boxShadow:
                      "0 8px 24px rgba(40, 30, 20, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
                  }}
                >
                  {/* Stats bar */}
                  <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        style={{ color: "var(--color-accent)" }}
                      />
                      <span
                        className="text-[12px] font-mono uppercase tracking-wider"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Processing · {elapsedSec}s
                        {etaSec !== null && etaSec > 0
                          ? ` · ~${formatTime(etaSec)} left`
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      {cacheHit && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(16, 185, 129, 0.12)",
                            color: "#10B981",
                          }}
                          title={`Cache hit · saved $${(cacheSavings ?? 0).toFixed(4)} · age ${(cacheAgeH ?? 0).toFixed(1)}h`}
                        >
                          <Zap className="h-3 w-3" />
                          CACHE HIT
                        </span>
                      )}
                      {costUsd !== null && costUsd > 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(245, 158, 11, 0.12)",
                            color: "#F59E0B",
                          }}
                          title={`LLM cost: $${costUsd.toFixed(4)} (${llmProvider ?? "—"})`}
                        >
                          <Coins className="h-3 w-3" />
                          ${costUsd.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="relative h-1.5 w-full overflow-hidden rounded-full mb-2"
                    style={{ background: "var(--color-surface-2)" }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${progress}%`,
                        background: "linear-gradient(90deg, #D946EF 0%, #F59E0B 100%)",
                        boxShadow: "0 0 12px rgba(217, 70, 239, 0.45)",
                      }}
                      initial={false}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-6">
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {currentStepMsg}
                    </span>
                    <span
                      style={{
                        color: "var(--color-text-primary)",
                        fontWeight: 600,
                      }}
                    >
                      {Math.round(progress)}%
                    </span>
                  </div>

                  {/* 6-step pipeline with per-stage animations */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                    {STEPS.map((step) => {
                      const isActive = step.number === stepNumber;
                      const isPast = step.number < stepNumber;
                      const durationS = stepTimes?.find((t) => t.step === step.number)?.duration_s;
                      return (
                        <motion.div
                          key={step.number}
                          layout
                          initial={false}
                          animate={{
                            scale: isActive ? 1.02 : 1,
                          }}
                          className="rounded-2xl p-3 text-left relative overflow-hidden"
                          style={{
                            background: isActive
                              ? "linear-gradient(135deg, rgba(217, 70, 239, 0.12) 0%, rgba(245, 158, 11, 0.06) 100%)"
                              : "var(--color-surface-1)",
                            border: isActive
                              ? "1px solid rgba(217, 70, 239, 0.4)"
                              : "1px solid var(--color-border)",
                            opacity: isActive || isPast ? 1 : 0.55,
                            transition: "background 0.3s, border-color 0.3s",
                          }}
                        >
                          {isActive && (
                            <motion.div
                              className="absolute inset-0 rounded-2xl pointer-events-none"
                              style={{
                                background: "linear-gradient(135deg, rgba(217, 70, 239, 0.1) 0%, transparent 100%)",
                              }}
                              animate={{ opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 1.6, repeat: Infinity }}
                            />
                          )}
                          <div className="flex items-center justify-between mb-2 relative">
                            <span className="text-lg">{step.icon}</span>
                            <div style={{ color: isPast ? "#10B981" : isActive ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                              <StageAnimation
                                step={step}
                                state={isPast ? "done" : isActive ? "active" : "pending"}
                                durationS={durationS}
                              />
                            </div>
                          </div>
                          <p
                            className="text-[12px] font-semibold leading-tight mb-0.5 relative"
                            style={{ color: "var(--color-text-primary)" }}
                          >
                            {step.label}
                          </p>
                          <p
                            className="text-[10px] font-mono leading-snug relative"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            {step.sub}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Live activity feed + per-step timing breakdown */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div
                      className="rounded-2xl p-4"
                      style={{
                        background: "var(--color-surface-1)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-[10px] font-mono uppercase tracking-wider"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          Activity
                        </span>
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {feed.length} events
                        </span>
                      </div>
                      <ActivityFeed events={feed} />
                    </div>
                    <div
                      className="rounded-2xl p-4"
                      style={{
                        background: "var(--color-surface-1)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-[10px] font-mono uppercase tracking-wider"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          Stage timing
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {STEPS.map((step) => {
                          const dur = stepTimes?.find((t) => t.step === step.number)?.duration_s;
                          const isCurrent = step.number === stepNumber;
                          return (
                            <div
                              key={step.number}
                              className="flex items-center justify-between text-[11px] font-mono"
                            >
                              <div className="flex items-center gap-2">
                                <span style={{ width: 14, color: "var(--color-text-muted)" }}>
                                  {step.number}
                                </span>
                                <span
                                  style={{
                                    color: isCurrent
                                      ? "var(--color-accent)"
                                      : dur
                                      ? "var(--color-text-primary)"
                                      : "var(--color-text-muted)",
                                  }}
                                >
                                  {step.label}
                                </span>
                              </div>
                              <span
                                className="tabular-nums"
                                style={{
                                  color: dur ? "var(--color-text-primary)" : "var(--color-text-muted)",
                                }}
                              >
                                {dur !== undefined
                                  ? dur < 60
                                    ? `${dur}s`
                                    : `${Math.round(dur / 60)}m ${dur % 60}s`
                                  : isCurrent
                                  ? "running…"
                                  : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
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
                {/* Summary stats */}
                <div className="flex items-center justify-center gap-6 mb-8 text-[12px] font-mono flex-wrap">
                  {cacheHit && (
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
                      style={{
                        background: "rgba(16, 185, 129, 0.12)",
                        color: "#10B981",
                      }}
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Cache hit · saved ${(cacheSavings ?? 0).toFixed(4)} · {(cacheAgeH ?? 0).toFixed(1)}h old
                    </span>
                  )}
                  {costUsd !== null && costUsd > 0 && (
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
                      style={{
                        background: "rgba(245, 158, 11, 0.12)",
                        color: "#F59E0B",
                      }}
                    >
                      <Coins className="h-3.5 w-3.5" />
                      ${costUsd.toFixed(4)} total · ${(costPerClip ?? 0).toFixed(4)}/clip
                    </span>
                  )}
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
                    style={{
                      background: "var(--color-surface-1)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(elapsedSec)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {clips.map((clip, i) => (
                    <ClipCard key={clip.clip_id || i} clip={clip} index={i} />
                  ))}
                </div>
                <div className="mt-8 text-center">
                  <button
                    onClick={() => {
                      setState("idle");
                      setUrl("");
                      setClips([]);
                    }}
                    className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[13px] font-semibold transition-all"
                    style={{
                      background: "var(--glass-light-strong)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    Process another video
                    <ArrowRight className="h-3.5 w-3.5" />
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

/**
 * ClipCard — one final rendered clip. Video preview + download + share.
 */
function ClipCard({ clip, index }: { clip: Clip; index: number }) {
  const [copied, setCopied] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);

  // Build the clip download URL from the file path.
  // Backend exposes /download/{clip_id} OR a direct file. We try the
  // standard API path first; fall back to direct file path on error.
  useEffect(() => {
    if (!clip.file_path && !clip.clip_id) return;
    // Prefer the API download endpoint if clip_id is present
    if (clip.clip_id) {
      setVideoUrl(`/api/v1/download/${clip.clip_id}`);
    } else if (clip.file_path) {
      // Extract the filename from the path
      const parts = clip.file_path.split("/");
      setVideoUrl(`/api/v1/download/${parts[parts.length - 1]}`);
    }
  }, [clip.clip_id, clip.file_path]);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `${clip.clip_id || "clip"}.mp4`;
    a.click();
  }, [videoUrl, clip.clip_id]);

  const handleCopyCaption = useCallback(() => {
    const text = `${clip.viral_title || ""}\n\n${clip.caption || ""}\n\n${clip.hashtags || ""}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [clip]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-2xl overflow-hidden group"
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
        className="relative aspect-video flex items-center justify-center overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(217, 70, 239, 0.15) 0%, rgba(252, 211, 77, 0.15) 100%)",
        }}
      >
        {videoUrl && !videoError ? (
          <video
            src={videoUrl}
            className="w-full h-full object-cover"
            controls
            preload="metadata"
            playsInline
            onError={() => setVideoError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Video
              className="h-8 w-8"
              style={{ color: "var(--color-text-muted)" }}
            />
            <span className="text-[10px] font-mono opacity-50">preview unavailable</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <p
          className="text-[14px] font-semibold leading-snug mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          {clip.viral_title || `Clip ${index + 1}`}
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
          <span style={{ color: "var(--color-text-faint)" }}>·</span>
          <span>9:16 ready</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[11px] font-semibold transition-all hover:opacity-80"
            style={{
              background: "linear-gradient(135deg, #D946EF 0%, #F59E0B 100%)",
              color: "#FFFFFF",
            }}
          >
            <Download className="h-3 w-3" />
            Download
          </button>
          <button
            onClick={handleCopyCaption}
            className="inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 px-3 text-[11px] font-semibold transition-all hover:opacity-80"
            style={{
              background: "var(--color-surface-1)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
            title="Copy caption + hashtags"
          >
            {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Caption"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
