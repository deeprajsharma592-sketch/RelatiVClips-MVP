"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProcessingLogs from "./ProcessingLogs";
import BentoCard from "./BentoCard";
import type { ProcessStep, StatusResponse } from "@/types";
import { pollUntilComplete } from "@/lib/api";

interface ProcessingPipelineProps {
  taskId: string;
  onComplete: (response: StatusResponse) => void;
  onError: (error: string) => void;
}

const PIPELINE_STEPS: ProcessStep[] = [
  { label: "DOWNLOADING_VIDEO", status: "pending" },
  { label: "ANALYZING_AUDIO", status: "pending" },
  { label: "TRANSCRIBING", status: "pending" },
  { label: "SELECTING_CLIPS", status: "pending" },
  { label: "DETECTING_FACES", status: "pending" },
  { label: "RENDERING", status: "pending" },
];

const STEP_KEYS = [
  "DOWNLOADING_VIDEO",
  "ANALYZING_AUDIO",
  "TRANSCRIBING",
  "SELECTING_CLIPS",
  "DETECTING_FACES",
  "RENDERING",
];

export default function ProcessingPipeline({
  taskId,
  onComplete,
  onError,
}: ProcessingPipelineProps) {
  const [steps, setSteps] = useState<ProcessStep[]>(PIPELINE_STEPS);
  const [progress, setProgress] = useState(0);
  const [currentLog, setCurrentLog] = useState("Queued for processing...");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [estimateSeconds, setEstimateSeconds] = useState(60);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const response = await pollUntilComplete(
          taskId,
          (pct, _status, stepName, response) => {
            if (cancelled) return;
            setProgress(pct);
            setCurrentLog(stepName || `Processing... ${pct}%`);
            if (response?.time_elapsed_seconds != null) {
              setElapsedSeconds(response.time_elapsed_seconds);
            }
            if (response?.time_estimate_seconds != null) {
              setEstimateSeconds(response.time_estimate_seconds);
            }

            const stepIndex = stepName
              ? STEP_KEYS.findIndex((k) =>
                  stepName.toLowerCase().includes(k.toLowerCase().replace(/_/g, " "))
                )
              : Math.min(Math.floor(pct / 17), STEP_KEYS.length - 1);

            const effectiveIdx = stepIndex >= 0 ? stepIndex : Math.min(Math.floor(pct / 17), STEP_KEYS.length - 1);

            setSteps((prev) =>
              prev.map((step, i) => ({
                ...step,
                status:
                  i < effectiveIdx
                    ? "done"
                    : i === effectiveIdx
                      ? "active"
                      : "pending",
              }))
            );
          }
        );

        if (cancelled) return;

        setSteps((prev) =>
          prev.map((s) => ({ ...s, status: "done" as const }))
        );
        setProgress(100);
        setCurrentLog("100% - Pipeline complete");

        onComplete(response);
      } catch (err) {
        if (!cancelled) {
          setCurrentLog(err instanceof Error ? err.message : "Pipeline error");
          onError(err instanceof Error ? err.message : "Unknown processing error");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [taskId, onComplete, onError]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={taskId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="space-y-6"
      >
        <BentoCard colSpan={8} glow="accent">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-accent">[Σ]</span>
                <h2 className="text-lg font-display font-bold text-white">Quantum Processing Pipeline</h2>
              </div>
              <span className="font-mono text-sm text-accent-secondary">{progress}%</span>
            </div>
            <div className="w-full h-1 bg-border rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-accent to-accent-secondary"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
          <ProcessingLogs steps={steps} currentLog={currentLog} />
        </BentoCard>

        <BentoCard colSpan={4} glow="secondary">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-accent-secondary">[η]</span>
              <span className="text-sm font-display text-white font-semibold">Processing Metrics</span>
            </div>
            {[
              { label: "Progress", symbol: "η", value: `${progress}%` },
              { label: "Elapsed", symbol: "Δt", value: `${elapsedSeconds}s` },
              { label: "Est. Remaining", symbol: "ε", value: `${estimateSeconds}s` },
              { label: "Active Step", symbol: "φ", value: steps.find(s => s.status === "active")?.label || "—" },
            ].map((metric) => (
              <div key={metric.symbol} className="flex items-center justify-between p-3 bg-black border border-border rounded-[4px]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-accent-secondary">[{metric.symbol}]</span>
                  <span className="text-xs text-text-muted">{metric.label}</span>
                </div>
                <span className="font-mono text-xs text-white">{metric.value}</span>
              </div>
            ))}
          </div>
        </BentoCard>
      </motion.div>
    </AnimatePresence>
  );
}
