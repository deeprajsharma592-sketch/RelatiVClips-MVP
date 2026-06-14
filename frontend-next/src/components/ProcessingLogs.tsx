"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ProcessStep } from "@/types";

interface ProcessingLogsProps {
  steps: ProcessStep[];
  currentLog?: string;
}

const stepIcons: Record<string, string> = {
  DOWNLOADING_VIDEO: "↓",
  ANALYZING_AUDIO: "ε",
  TRANSCRIBING: "τ",
  SELECTING_CLIPS: "φ",
  DETECTING_FACES: "Δv",
  RENDERING: "Σ",
};

export default function ProcessingLogs({
  steps,
  currentLog,
}: ProcessingLogsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm font-mono text-accent-secondary">[Σ]</span>
        <span className="text-sm font-display text-white font-semibold">
          Pipeline Execution Logs
        </span>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center gap-3 p-3 rounded-[4px] ${
                step.status === "done"
                  ? "bg-accent-secondary/5 border border-accent-secondary/20"
                  : step.status === "active"
                    ? "bg-accent/5 border border-accent/30"
                    : step.status === "error"
                      ? "bg-error/5 border border-error/20"
                      : "bg-surface border border-border"
              }`}
            >
              {/* Status indicator */}
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {step.status === "done" ? (
                  <span className="text-accent-secondary text-xs">✓</span>
                ) : step.status === "active" ? (
                  <motion.span
                    className="w-2 h-2 rounded-full bg-accent"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                ) : step.status === "error" ? (
                  <span className="text-error text-xs">✗</span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-border" />
                )}
              </div>

              {/* Physics symbol */}
              <span
                className={`font-mono text-xs w-12 ${
                  step.status === "active"
                    ? "text-accent"
                    : step.status === "done"
                      ? "text-accent-secondary"
                      : "text-text-muted"
                }`}
              >
                [{stepIcons[step.label] || "η"}]
              </span>

              {/* Label */}
              <span
                className={`font-sans text-sm ${
                  step.status === "done"
                    ? "text-accent-secondary"
                    : step.status === "active"
                      ? "text-white"
                      : "text-text-muted"
                }`}
              >
                {step.label}
              </span>

              {/* Active indicator */}
              {step.status === "active" && (
                <motion.span
                  className="ml-auto text-xs font-mono text-accent"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  processing...
                </motion.span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {currentLog && (
        <motion.div
          key={currentLog}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-3 bg-bg-base border border-border rounded-[4px]"
        >
          <span className="font-mono text-xs text-accent-secondary/70">{">"}</span>{" "}
          <span className="font-mono text-xs text-text-muted">{currentLog}</span>
        </motion.div>
      )}
    </div>
  );
}
