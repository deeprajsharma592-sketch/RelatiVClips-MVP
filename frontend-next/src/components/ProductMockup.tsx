"use client";

/**
 * ProductMockup — Animated mock of the RelatiV pipeline UI
 *
 * Shows a fake browser window with:
 *   1. URL being typed into the input
 *   2. 4 pipeline stages lighting up one-by-one (Downloading → Transcribing → AI scoring → Rendering)
 *   3. 10 clip cards appearing in a grid
 *
 * Loops every ~9s. Zero extra deps — Framer Motion only.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Mic,
  Brain,
  Sparkles,
  Check,
  Play,
  Link2,
  Clock,
} from "lucide-react";

// ─── Pipeline stages ───────────────────────────────────────────────────────
const STAGES = [
  { id: 1, icon: Download, label: "Downloading video",   color: "#FCD34D", ms: 800  },
  { id: 2, icon: Mic,      label: "Transcribing audio",  color: "#D946EF", ms: 1600 },
  { id: 3, icon: Brain,    label: "AI scoring hooks",    color: "#F59E0B", ms: 2400 },
  { id: 4, icon: Sparkles, label: "Rendering 10 clips",  color: "#10B981", ms: 3200 },
];

// ─── Fake clip cards ───────────────────────────────────────────────────────
const CLIPS = [
  { id: 1,  label: "Hook moment",    duration: "0:47", score: 94, color: "#D946EF" },
  { id: 2,  label: "Story peak",     duration: "1:02", score: 91, color: "#F59E0B" },
  { id: 3,  label: "Viral quote",    duration: "0:38", score: 89, color: "#06B6D4" },
  { id: 4,  label: "Controversy",    duration: "0:55", score: 87, color: "#10B981" },
  { id: 5,  label: "Insight drop",   duration: "1:10", score: 85, color: "#D946EF" },
  { id: 6,  label: "Punchline",      duration: "0:29", score: 83, color: "#F59E0B" },
  { id: 7,  label: "Callback",       duration: "0:44", score: 81, color: "#06B6D4" },
  { id: 8,  label: "CTA moment",     duration: "0:31", score: 79, color: "#10B981" },
  { id: 9,  label: "Reframe",        duration: "0:52", score: 77, color: "#D946EF" },
  { id: 10, label: "Mic drop",       duration: "0:18", score: 75, color: "#F59E0B" },
];

const TYPED_URL = "youtube.com/watch?v=dQw4w9WgXcQ";
const LOOP_MS   = 9500;

// ─── Helpers ───────────────────────────────────────────────────────────────

function WaveformBars({ color }: { color: string }) {
  const heights = [5, 10, 7, 14, 9, 12, 6, 11, 8, 13];
  return (
    <div className="flex items-end gap-[2px]">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full"
          style={{ height: h, background: color, opacity: 0.6 }}
        />
      ))}
    </div>
  );
}

function ClipMiniCard({ clip, delay }: { clip: (typeof CLIPS)[number]; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${clip.color}30`,
      }}
    >
      {/* Thumbnail */}
      <div
        className="h-16 relative flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${clip.color}18 0%, rgba(0,0,0,0.5) 100%)`,
        }}
      >
        <Play className="h-5 w-5 opacity-40" style={{ color: clip.color }} />
        <div className="absolute bottom-1 left-1.5">
          <WaveformBars color={clip.color} />
        </div>
        <div
          className="absolute top-1 right-1 px-1 py-0.5 rounded text-[8px] font-mono"
          style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
        >
          {clip.duration}
        </div>
        {/* Score badge */}
        <div
          className="absolute top-1 left-1 px-1 py-0.5 rounded text-[8px] font-mono font-bold"
          style={{ background: `${clip.color}25`, color: clip.color, border: `1px solid ${clip.color}40` }}
        >
          {clip.score}
        </div>
      </div>
      {/* Label */}
      <div className="px-2 py-1.5">
        <p className="text-[9px] font-medium truncate" style={{ color: "rgba(255,255,255,0.7)" }}>
          {clip.label}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function ProductMockup() {
  const [phase, setPhase]         = useState<"typing" | "processing" | "done">("typing");
  const [typedLen, setTypedLen]   = useState(0);
  const [doneStages, setDoneStages] = useState<number[]>([]);
  const [visibleClips, setVisibleClips] = useState(0);

  // ── master loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];

    function runLoop() {
      // Reset
      setPhase("typing");
      setTypedLen(0);
      setDoneStages([]);
      setVisibleClips(0);

      // Type the URL char by char
      for (let i = 1; i <= TYPED_URL.length; i++) {
        timers.push(setTimeout(() => setTypedLen(i), i * 42));
      }

      // Switch to processing after typing done
      const afterType = TYPED_URL.length * 42 + 300;
      timers.push(setTimeout(() => setPhase("processing"), afterType));

      // Light up each stage
      STAGES.forEach((s, idx) => {
        timers.push(
          setTimeout(
            () => setDoneStages((prev) => [...prev, s.id]),
            afterType + s.ms,
          ),
        );
      });

      // Show clips one-by-one after last stage
      const clipsStart = afterType + STAGES[STAGES.length - 1].ms + 400;
      timers.push(setTimeout(() => setPhase("done"), clipsStart));
      for (let c = 1; c <= CLIPS.length; c++) {
        timers.push(
          setTimeout(() => setVisibleClips(c), clipsStart + c * 150),
        );
      }

      // Schedule next loop
      timers.push(setTimeout(runLoop, LOOP_MS));
    }

    runLoop();
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <section
      className="relative py-20 overflow-hidden"
      style={{ background: "#050506" }}
    >
      {/* Section label */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <span
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono mb-4"
          style={{
            background: "rgba(217,70,239,0.1)",
            border: "1px solid rgba(217,70,239,0.25)",
            color: "#D946EF",
          }}
        >
          <Sparkles className="h-3 w-3" />
          Live product demo
        </span>
        <h2
          className="font-bebas"
          style={{
            fontSize: "clamp(2.5rem, 5vw, 4rem)",
            color: "#FFFFFF",
            letterSpacing: "0.01em",
            lineHeight: 1,
          }}
        >
          Watch it work in real time.
        </h2>
        <p
          className="mt-3 text-sm max-w-sm mx-auto"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Paste a link. The engine runs. Ten clips appear.
        </p>
      </motion.div>

      {/* Browser window */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-4xl mx-auto px-6"
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(12,10,18,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow:
              "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          {/* Browser chrome */}
          <div
            className="flex items-center gap-3 px-4 py-3 border-b"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
          >
            {/* Traffic lights */}
            <div className="flex gap-1.5">
              {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
              ))}
            </div>
            {/* URL bar */}
            <div
              className="flex-1 flex items-center gap-2 rounded-lg px-3 py-1.5"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#10B981" }}
              />
              <span
                className="text-[11px] font-mono"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                relativclips.com
              </span>
            </div>
          </div>

          {/* App body */}
          <div className="p-6">
            {/* Input row */}
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: phase === "typing"
                  ? "1px solid rgba(217,70,239,0.4)"
                  : "1px solid rgba(255,255,255,0.1)",
                transition: "border-color 0.3s",
                boxShadow: phase === "typing"
                  ? "0 0 0 3px rgba(217,70,239,0.08)"
                  : "none",
              }}
            >
              <Link2 className="h-4 w-4 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
              <span
                className="flex-1 text-sm font-mono"
                style={{ color: "rgba(255,255,255,0.75)" }}
              >
                {TYPED_URL.slice(0, typedLen)}
                {phase === "typing" && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    style={{ color: "#D946EF" }}
                  >
                    |
                  </motion.span>
                )}
              </span>
              {phase !== "typing" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold"
                  style={{
                    background: "linear-gradient(135deg, #D946EF, #F59E0B)",
                    color: "#fff",
                  }}
                >
                  <Sparkles className="h-3 w-3" />
                  Processing
                </motion.div>
              )}
            </div>

            {/* Two-column: pipeline stages + clips */}
            <div className="grid grid-cols-[200px_1fr] gap-5">

              {/* Left: pipeline stages */}
              <div className="space-y-2">
                <p
                  className="text-[10px] font-mono uppercase tracking-wider mb-3"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                >
                  Pipeline
                </p>
                {STAGES.map((stage) => {
                  const done    = doneStages.includes(stage.id);
                  const running = !done && phase === "processing" &&
                    doneStages.length === stage.id - 1;
                  return (
                    <motion.div
                      key={stage.id}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                      style={{
                        background: done
                          ? `${stage.color}10`
                          : running
                          ? "rgba(255,255,255,0.04)"
                          : "transparent",
                        border: done
                          ? `1px solid ${stage.color}30`
                          : running
                          ? "1px solid rgba(255,255,255,0.08)"
                          : "1px solid transparent",
                        transition: "all 0.3s",
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                        style={{
                          background: done
                            ? `${stage.color}20`
                            : "rgba(255,255,255,0.05)",
                        }}
                      >
                        {done ? (
                          <Check className="h-3 w-3" style={{ color: stage.color }} />
                        ) : running ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <stage.icon className="h-3 w-3" style={{ color: stage.color }} />
                          </motion.div>
                        ) : (
                          <stage.icon className="h-3 w-3" style={{ color: "rgba(255,255,255,0.2)" }} />
                        )}
                      </div>
                      {/* Label */}
                      <span
                        className="text-[11px] font-medium leading-tight"
                        style={{
                          color: done
                            ? "rgba(255,255,255,0.85)"
                            : running
                            ? "rgba(255,255,255,0.6)"
                            : "rgba(255,255,255,0.2)",
                        }}
                      >
                        {stage.label}
                      </span>
                      {/* Running pulse */}
                      {running && (
                        <motion.div
                          className="ml-auto w-1.5 h-1.5 rounded-full"
                          animate={{ opacity: [1, 0.2, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          style={{ background: stage.color }}
                        />
                      )}
                    </motion.div>
                  );
                })}

                {/* Timer */}
                {phase === "processing" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1.5 px-3 pt-2"
                  >
                    <Clock className="h-3 w-3" style={{ color: "rgba(255,255,255,0.2)" }} />
                    <ElapsedTimer />
                  </motion.div>
                )}

                {phase === "done" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 px-3 pt-2"
                  >
                    <Check className="h-3 w-3" style={{ color: "#10B981" }} />
                    <span className="text-[10px] font-mono" style={{ color: "#10B981" }}>
                      Done in 4:12
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Right: clips grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p
                    className="text-[10px] font-mono uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    Output clips
                  </p>
                  {visibleClips > 0 && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[10px] font-mono"
                      style={{ color: "#10B981" }}
                    >
                      {visibleClips} / 10 ready
                    </motion.span>
                  )}
                </div>

                {/* 5×2 clips grid */}
                <div className="grid grid-cols-5 gap-2">
                  {CLIPS.map((clip, i) =>
                    i < visibleClips ? (
                      <ClipMiniCard key={clip.id} clip={clip} delay={0} />
                    ) : (
                      <div
                        key={clip.id}
                        className="rounded-xl h-[90px]"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.05)",
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ─── Elapsed timer ─────────────────────────────────────────────────────────
function ElapsedTimer() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(secs / 60).toString().padStart(1, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return (
    <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
      {m}:{s} elapsed
    </span>
  );
}
