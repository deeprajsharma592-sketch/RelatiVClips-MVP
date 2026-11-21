"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Radio,
  ArrowRight,
  Activity,
  Terminal,
} from "lucide-react";
import { submitYouTubeUrl } from "@/lib/api";
import { getDashDashboardUrl } from "@/lib/domain";

interface SickLoadingTransitionProps {
  url: string;
  captionFont?: string;
  clipCount?: number | null;
  onComplete?: (taskId?: string) => void;
  autoRedirect?: boolean;
}

interface TelemetryLog {
  time: string;
  phase: string;
  text: string;
  status: "done" | "active" | "pending";
}

const TELEMETRY_STAGES: {
  pct: number;
  stageName: string;
  subtext: string;
  log: TelemetryLog;
}[] = [
  {
    pct: 12,
    stageName: "ESTABLISHING SOURCE LINK",
    subtext: "Handshaking with stream CDN & validating 1080p container",
    log: {
      time: "00:00.18",
      phase: "STREAM",
      text: "Validated remote manifest. Audio & video streams isolated.",
      status: "done",
    },
  },
  {
    pct: 28,
    stageName: "TRANSCRIPT STORY MAPPING",
    subtext: "Finding self-contained hooks, tension, context, and payoff",
    log: {
      time: "00:00.64",
      phase: "TASTE",
      text: "Mapped complete story arcs and removed low-context fragments.",
      status: "done",
    },
  },
  {
    pct: 48,
    stageName: "WHISPER WORD-LEVEL ALIGNMENT",
    subtext: "Transcribing phoneme boundaries for karaoke captions",
    log: {
      time: "00:01.15",
      phase: "SPEECH",
      text: "Synchronized timestamps generated for animated caption engine.",
      status: "done",
    },
  },
  {
    pct: 68,
    stageName: "RELATIVSAUCE VIRAL SCORING",
    subtext: "Filtering intro filler. Enforcing Hook (0-3s) → Proof → Payoff (20-35s)",
    log: {
      time: "00:01.82",
      phase: "TASTE",
      text: "High-retention story arcs detected. Non-overlapping moments mapped.",
      status: "done",
    },
  },
  {
    pct: 86,
    stageName: "SPEAKER TRACKING & 9:16 CROP",
    subtext: "OpenCV face bounding box centering & jump-cut stitching matrix",
    log: {
      time: "00:02.38",
      phase: "VISION",
      text: "Subject tracked. 1.05x punch-in jump cuts & audio crossfades ready.",
      status: "done",
    },
  },
  {
    pct: 100,
    stageName: "INITIALIZING STUDIO DASHBOARD",
    subtext: "Workspace loaded. Streaming clips to creator vault...",
    log: {
      time: "00:02.90",
      phase: "DASH",
      text: "Workspace initialized. Ready to render.",
      status: "done",
    },
  },
];

export default function SickLoadingTransition({
  url,
  captionFont = "studio",
  clipCount = null,
  onComplete,
  autoRedirect = true,
}: SickLoadingTransitionProps) {
  const [progress, setProgress] = useState(4);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [activeLogs, setActiveLogs] = useState<TelemetryLog[]>([]);
  const taskIdRef = useRef<string | null>(null);
  const submissionErrorRef = useRef<string | null>(null);
  const [taskReady, setTaskReady] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isWarping, setIsWarping] = useState(false);
  const hasTriggeredComplete = useRef(false);

  // Clean display of the URL
  const displayUrl = (() => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtu.be")) {
        return `youtu.be${parsed.pathname}`;
      }
      if (parsed.searchParams.get("v")) {
        return `youtube.com/watch?v=${parsed.searchParams.get("v")?.slice(0, 8)}...`;
      }
      return parsed.hostname + parsed.pathname.slice(0, 16) + "...";
    } catch {
      return url.slice(0, 32) + "...";
    }
  })();

  // 1. Kick off backend task initiation in parallel
  useEffect(() => {
    let isMounted = true;
    if (!url) return;

    submitYouTubeUrl(url, captionFont, clipCount)
      .then((res) => {
        if (!isMounted) return;
        if (res.taskId) {
          taskIdRef.current = res.taskId;
          setTaskReady(true);
        } else {
          const message = "The processing service did not return a task ID.";
          submissionErrorRef.current = message;
          setSubmissionError(message);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        const message = err?.message || "Could not start video processing.";
        submissionErrorRef.current = message;
        setSubmissionError(message);
      });

    return () => {
      isMounted = false;
    };
  }, [url, captionFont, clipCount]);

  // 2. High-energy smooth progress and stage sequencer
  useEffect(() => {
    const startTime = performance.now();
    const TARGET_DURATION_MS = 3200; // Snappy, cinematic 3.2 seconds

    let frameId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const rawPct = Math.min(100, (elapsed / TARGET_DURATION_MS) * 100);

      // Ease out cubic for a fast launch and cinematic finish
      const eased = Math.round(
        100 * (1 - Math.pow(1 - rawPct / 100, 2.2))
      );
      setProgress(Math.max(5, taskIdRef.current ? eased : Math.min(eased, 92)));

      // Reveal telemetry logs according to progress
      const matchingStageIndex = TELEMETRY_STAGES.findIndex(
        (s) => eased <= s.pct
      );
      const stageIdx =
        matchingStageIndex === -1
          ? TELEMETRY_STAGES.length - 1
          : matchingStageIndex;

      setCurrentStageIndex(stageIdx);

      const logsToShow = TELEMETRY_STAGES.slice(0, stageIdx + 1).map(
        (s) => s.log
      );
      setActiveLogs(logsToShow);

      if (eased < 100) {
        frameId = requestAnimationFrame(tick);
      } else if (!taskIdRef.current) {
        // The visual animation may finish before the backend returns a task.
        // Hold here instead of redirecting and accidentally submitting twice.
        if (!submissionErrorRef.current) {
          frameId = requestAnimationFrame(tick);
        }
      } else {
        // Warp transition climax!
        setIsWarping(true);
        setTimeout(() => {
          if (!hasTriggeredComplete.current) {
            hasTriggeredComplete.current = true;
            if (onComplete) {
              onComplete(taskIdRef.current || undefined);
            }
            if (autoRedirect) {
              const targetUrl = getDashDashboardUrl("", {
                url,
                taskId: taskIdRef.current || undefined,
              });
              window.location.href = targetUrl;
            }
          }
        }, 400);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [url, onComplete, autoRedirect]);

  const currentStage =
    TELEMETRY_STAGES[currentStageIndex] ||
    TELEMETRY_STAGES[TELEMETRY_STAGES.length - 1];

  return (
    <div className="fixed inset-0 z-[9999] bg-[#030408] text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* ── Background Layer: Scanlines & Cosmic Glow Gradients ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Neon Pulsing Radial Flares */}
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.35, 0.55, 0.35],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[750px] h-[450px] rounded-full bg-gradient-to-b from-cyan-500/30 via-indigo-600/20 to-transparent blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1.1, 0.9, 1.1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[650px] h-[400px] rounded-full bg-gradient-to-t from-violet-600/25 via-fuchsia-600/15 to-transparent blur-[130px]"
        />

        {/* Ambient CRT / Studio Scanline texture */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, #000, #000 2px, transparent 2px, transparent 4px)",
          }}
        />

        {/* Subdued Tech Grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #00f0ff 1px, transparent 1px), linear-gradient(to bottom, #00f0ff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Vertical Holographic Scan Laser sweeping down */}
        <motion.div
          animate={{ y: ["-10%", "110%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-x-0 h-28 bg-gradient-to-b from-transparent via-cyan-400/[0.12] to-transparent pointer-events-none"
        />
      </div>

      {/* ── Top Tactical HUD Header ── */}
      <header className="relative z-20 px-6 sm:px-10 pt-6 sm:pt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.35)]">
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider text-cyan-300">
                RELATIV CLIPS
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-200 border border-cyan-500/30">
                v2.4 RUNTIME
              </span>
            </div>
            <p className="text-[11px] font-mono text-zinc-400">
              PIPELINE ENGAGED • LATENCY 14ms
            </p>
          </div>
        </div>

        {/* Target Stream Badge */}
        <div className="hidden sm:flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono text-zinc-300">
            Target: <span className="text-white font-medium">{displayUrl}</span>
          </span>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Live Stream
          </span>
        </div>
      </header>

      {/* ── Center Stage: Quantum Reactor & Kinetic HUD Telemetry ── */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 max-w-4xl mx-auto w-full">
        {/* Reactor Core Hologram */}
        <div className="relative flex items-center justify-center my-4 sm:my-6">
          {/* Outer Cyber Dashed Orbit (Rotating Clockwise) */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
            className="w-56 h-56 sm:w-72 sm:h-72 rounded-full border border-dashed border-cyan-500/30 flex items-center justify-center relative"
          >
            {/* Cardinal Coordinate Nodes */}
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_#06b6d4]" />
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-500/60" />
            <span className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-400/60" />
            <span className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400/80 shadow-[0_0_8px_#06b6d4]" />
          </motion.div>

          {/* Middle Counter-Rotating HUD Ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute w-44 h-44 sm:w-56 sm:h-56 rounded-full border border-indigo-500/40 border-t-cyan-400 border-b-violet-400 flex items-center justify-center"
          >
            <div className="w-full h-full rounded-full border border-white/5 animate-pulse" />
          </motion.div>

          {/* Rotating Laser Radar Sweep Cone */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute w-40 h-40 sm:w-52 sm:h-52 rounded-full overflow-hidden pointer-events-none"
          >
            <div className="w-1/2 h-1/2 bg-gradient-to-br from-cyan-400/40 via-cyan-500/10 to-transparent origin-bottom-right" />
          </motion.div>

          {/* Inner Glowing Core */}
          <div className="absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-[#070b16]/90 border border-cyan-400/60 backdrop-blur-xl flex flex-col items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.4)]">
            <motion.div
              animate={{
                scale: [0.95, 1.05, 0.95],
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="flex flex-col items-center"
            >
              <Zap className="w-7 h-7 sm:w-9 sm:h-9 text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
              <span className="font-mono text-[11px] font-bold text-cyan-200 mt-1">
                {progress}%
              </span>
            </motion.div>
          </div>
        </div>

        {/* ── Active Stage Headline & Description ── */}
        <div className="text-center space-y-2 max-w-lg mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono tracking-wide">
            <Activity className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span>{currentStage.stageName}</span>
          </div>

          <h2 className={`text-lg sm:text-2xl font-display font-bold tracking-tight ${submissionError ? "text-rose-300" : "text-white"}`}>
            {submissionError || currentStage.subtext}
          </h2>
        </div>

        {/* ── Acoustic Waveform Equalizer ── */}
        <div className="mt-5 flex items-center justify-center gap-1 sm:gap-1.5 h-10 w-full max-w-md">
          {Array.from({ length: 28 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: [
                  "15%",
                  `${Math.max(20, Math.sin((i + progress * 0.15) * 0.8) * 90 + 10)}%`,
                  "25%",
                ],
              }}
              transition={{
                duration: 0.6 + (i % 5) * 0.1,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-1 sm:w-1.5 rounded-full bg-gradient-to-t from-cyan-500 via-indigo-500 to-fuchsia-400 opacity-80"
            />
          ))}
        </div>

        {/* ── Dynamic High-Speed Telemetry Terminal ── */}
        <div className="mt-6 w-full max-w-xl bg-black/60 border border-white/10 rounded-xl p-3.5 backdrop-blur-xl font-mono text-[11px] sm:text-xs shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 text-zinc-400 text-[10px]">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-cyan-400" />
              <span>TELEMETRY FEED</span>
            </div>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE STREAM
            </span>
          </div>

          <div className="space-y-1.5 pt-2 max-h-24 overflow-y-auto">
            {activeLogs.slice(-3).map((log, idx) => (
              <motion.div
                key={log.phase + idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-zinc-300"
              >
                <span className="text-zinc-500 text-[10px]">[{log.time}]</span>
                <span className="px-1 py-0.5 text-[9px] rounded bg-white/10 text-cyan-300 font-bold">
                  {log.phase}
                </span>
                <span className="truncate text-zinc-300">{log.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Bottom Progress HUD & Redirect Action ── */}
      <footer className="relative z-20 px-6 sm:px-10 pb-8 sm:pb-10 max-w-3xl mx-auto w-full space-y-3">
        {/* Luminous Gradient Progress Bar */}
        <div className="relative w-full h-2.5 sm:h-3 rounded-full bg-white/[0.08] overflow-hidden p-0.5 border border-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 via-purple-500 to-emerald-400 relative"
            style={{ width: `${progress}%` }}
            transition={{ ease: "easeOut", duration: 0.15 }}
          >
            {/* Travelling Light Flare */}
            <span className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white blur-[2px] opacity-90" />
          </motion.div>
        </div>

        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">{progress}%</span>
            <span>{submissionError ? "FAILED" : taskReady ? "READY" : "STARTING"}</span>
          </div>
          <div className="flex items-center gap-2 text-cyan-300">
            <span>{submissionError ? "Processing could not be started" : taskReady ? "Launching Studio Workspace" : "Waiting for processing service"}</span>
            <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
          </div>
        </div>
      </footer>

      {/* ── Warp Speed / Light Flash Overlay at 100% ── */}
      <AnimatePresence>
        {isWarping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[10000] bg-white flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              className="text-black font-display font-extrabold text-2xl tracking-tighter"
            >
              LAUNCHING STUDIO DASHBOARD...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
