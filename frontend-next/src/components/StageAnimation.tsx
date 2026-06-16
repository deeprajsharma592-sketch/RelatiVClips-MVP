"use client";

/**
 * StageAnimation — Per-stage visual effect shown next to the active
 * step in the pipeline. Each "vibe" gets a distinct, on-brand animation
 * (waveform, dots, scanning grid, etc.) so users can tell at a glance
 * which stage is running.
 *
 * Animations are CSS-only (Tailwind) — no JS timers — so they stay in
 * sync with React rendering and don't fight the polling loop.
 */

import { motion } from "framer-motion";
import type { PipelineStep } from "@/types";

interface Props {
  step: PipelineStep;
  state: "active" | "done" | "pending";
  /** Duration the stage ran for, when done */
  durationS?: number;
}

export function StageAnimation({ step, state, durationS }: Props) {
  // Pick a sub-animation based on the step's vibe
  if (state === "active") {
    return <ActiveVibe vibe={step.vibe} />;
  }
  if (state === "done") {
    return (
      <div className="flex items-center gap-1.5">
        <motion.svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <motion.path
            d="M5 12.5L10 17.5L19 7.5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </motion.svg>
        {typeof durationS === "number" && durationS > 0 && (
          <span className="text-[10px] font-mono opacity-70">
            {durationS < 60 ? `${durationS}s` : `${Math.round(durationS / 60)}m`}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="text-[10px] font-mono opacity-30">
      {/* Empty placeholder for pending steps */}
      <span style={{ width: 14, height: 14, display: "inline-block" }} />
    </div>
  );
}

function ActiveVibe({ vibe }: { vibe: PipelineStep["vibe"] }) {
  switch (vibe) {
    case "fetch":
      return <FetchDots />;
    case "audio":
      return <AudioWave />;
    case "transcribe":
      return <TranscribeCaret />;
    case "llm":
      return <LLMThink />;
    case "face":
      return <FaceScan />;
    case "render":
      return <RenderScan />;
  }
}

// ── Fetching source: pulse + dot trail ────────────────────────────────────
function FetchDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-1.5 h-1.5 rounded-full"
          style={{ background: "currentColor" }}
          animate={{ scale: [0.6, 1.2, 0.6], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

// ── Audio analysis: 5 animated waveform bars ─────────────────────────────
function AudioWave() {
  const heights = [0.4, 0.7, 1.0, 0.6, 0.5];
  return (
    <div className="flex items-end gap-[3px] h-3.5">
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className="block w-[3px] rounded-sm"
          style={{ background: "currentColor" }}
          animate={{
            height: [`${h * 100}%`, `${(1.2 - h) * 100}%`, `${h * 100}%`],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.7,
            repeat: Infinity,
            delay: i * 0.09,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ── Transcribing: blinking caret ──────────────────────────────────────────
function TranscribeCaret() {
  return (
    <div className="flex items-center gap-1">
      <motion.span
        className="inline-block w-[2px] h-3 rounded-sm"
        style={{ background: "currentColor" }}
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      <span className="text-[10px] font-mono opacity-80">Aa</span>
    </div>
  );
}

// ── LLM: three "thinking" dots that morph ────────────────────────────────
function LLMThink() {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: "currentColor" }}
          animate={{
            y: [0, -3, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.13,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ── Face detection: scanning crosshair ────────────────────────────────────
function FaceScan() {
  return (
    <div className="relative w-3.5 h-3.5">
      <motion.div
        className="absolute inset-0 border-[1.5px] rounded-sm"
        style={{ borderColor: "currentColor" }}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
      <motion.div
        className="absolute top-1/2 left-0 right-0 h-px"
        style={{ background: "currentColor" }}
        animate={{ y: [-6, 6, -6] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// ── Render: timeline + progress fill ─────────────────────────────────────
function RenderScan() {
  return (
    <div className="relative w-8 h-1.5 rounded-full overflow-hidden bg-white/20">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: "currentColor" }}
        animate={{ width: ["0%", "100%", "0%"], x: ["0%", "0%", "100%"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
