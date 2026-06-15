"use client";

/**
 * PasteLinkPod — sticky, interactive "paste a YouTube URL" widget.
 *
 * Lives at the top of the creator dashboard, sticks on scroll, expands
 * on focus with a smooth spring animation. Mobile-friendly (full-width
 * on small screens, 2-col layout on desktop).
 *
 * Flow:
 *  1. User pastes URL → input validates shape
 *  2. Submit → POST /process/youtube → gets task_id
 *  3. Poll /status/{task_id} every 1.5s (faster than the 15s CLI poll)
 *  4. When complete → show 3 clip chips with download links inline
 *
 * States: idle | submitting | processing | complete | error
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Video,
} from "lucide-react";

const YOUTUBE_URL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([\w-]{11})/,
  /^https?:\/\/youtu\.be\/([\w-]{11})/,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/([\w-]{11})/,
];

function extractVideoId(url: string): string | null {
  for (const re of YOUTUBE_URL_PATTERNS) {
    const m = url.trim().match(re);
    if (m) return m[2] || m[1];
  }
  return null;
}

type Phase = "idle" | "submitting" | "processing" | "complete" | "error";

type ClipChip = {
  clip_id: string;
  start: number;
  end: number;
  duration_s: number;
  viral_title?: string;
  caption?: string;
  signal_type?: string;
};

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) || "";

export default function PasteLinkPod() {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [clips, setClips] = useState<ClipChip[]>([]);
  const [elapsed, setElapsed] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef<number>(0);

  // Validate URL on change
  useEffect(() => {
    const id = extractVideoId(url);
    setVideoId(id);
  }, [url]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const submit = async () => {
    if (!videoId) {
      setErrorMsg("Doesn't look like a YouTube link. Try a youtube.com/watch or youtu.be/ URL.");
      return;
    }
    setErrorMsg(null);
    setClips([]);
    setProgressMsg("Kicking off pipeline…");
    setPhase("submitting");
    startTime.current = Date.now();
    setElapsed(0);

    try {
      const res = await fetch(`${API_BASE}/process/youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) {
        throw new Error(`Submit failed: ${res.status}`);
      }
      const data = await res.json();
      setTaskId(data.task_id);
      setPhase("processing");
      // Poll every 1.5s
      pollRef.current = setInterval(pollStatus, 1500);
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not start pipeline");
      setPhase("error");
    }
  };

  const pollStatus = async () => {
    if (!taskId) return;
    try {
      const res = await fetch(`${API_BASE}/status/${taskId}`);
      if (!res.ok) return;
      const s = await res.json();
      setElapsed(Math.round((Date.now() - startTime.current) / 1000));
      setProgressMsg(s.current_step || "");
      if (s.status === "complete" || s.status === "failed" || s.status === "error") {
        stopPolling();
        if (s.status === "complete") {
          const cs: ClipChip[] = (s.clips || []).map((c: any) => ({
            clip_id: c.clip_id,
            start: c.start,
            end: c.end,
            duration_s: c.duration_s ?? (c.end - c.start),
            viral_title: c.viral_title,
            caption: c.caption,
            signal_type: c.signal_type,
          }));
          setClips(cs);
          if (cs.length > 0) {
            setPhase("complete");
          } else {
            setPhase("error");
            setErrorMsg("Pipeline ran but produced 0 clips. Try another video?");
          }
        } else {
          setPhase("error");
          setErrorMsg(s.error || "Pipeline failed");
        }
      }
    } catch (e) {
      // transient; keep polling
    }
  };

  const reset = () => {
    setUrl("");
    setVideoId(null);
    setPhase("idle");
    setErrorMsg(null);
    setClips([]);
    setProgressMsg("");
    setTaskId(null);
    setElapsed(0);
    inputRef.current?.focus();
  };

  return (
    <div
      className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-3"
      style={{
        // Glass bar that stays at the top while scrolling
        background:
          "linear-gradient(to bottom, rgba(250, 246, 238, 0.96) 0%, rgba(250, 246, 238, 0.85) 70%, rgba(250, 246, 238, 0) 100%)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className="glass-panel relative overflow-hidden"
        style={{ borderRadius: "var(--radius-2xl)" }}
      >
        {/* Idle / submitting / processing state */}
        {phase !== "complete" && (
          <div className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Icon + heading */}
              <div className="flex items-center gap-3 shrink-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: videoId
                      ? "rgba(34, 197, 94, 0.12)"
                      : "rgba(217, 70, 239, 0.10)",
                    border: videoId
                      ? "1px solid rgba(34, 197, 94, 0.30)"
                      : "1px solid rgba(217, 70, 239, 0.25)",
                  }}
                >
                  {videoId ? (
                    <Check className="h-5 w-5" style={{ color: "rgb(34, 197, 94)" }} />
                  ) : (
                    <Link2 className="h-5 w-5" style={{ color: "var(--color-accent-pink)" }} />
                  )}
                </div>
                <div className="min-w-0">
                  <div
                    className="text-[10px] font-mono uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {videoId ? "✓ Link detected" : "Paste a YouTube link"}
                  </div>
                  <div
                    className="text-[13px] sm:text-[14px] font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {videoId
                      ? "Ready to generate 3 viral clips"
                      : "Get 3 clips in ~2 minutes"}
                  </div>
                </div>
              </div>

              {/* URL input */}
              <div className="flex-1 min-w-0 flex gap-2">
                <motion.input
                  ref={inputRef}
                  type="url"
                  inputMode="url"
                  placeholder="https://youtube.com/watch?v=…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && phase === "idle") submit();
                  }}
                  disabled={phase === "submitting" || phase === "processing"}
                  className="flex-1 min-w-0 px-3 py-2.5 text-[13px] sm:text-sm rounded-xl outline-none"
                  style={{
                    background: "rgba(255, 255, 255, 0.7)",
                    border: "1px solid var(--color-border-strong)",
                    color: "var(--color-text-primary)",
                  }}
                  animate={{ scale: videoId ? 1.01 : 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
                <motion.button
                  onClick={phase === "idle" ? submit : reset}
                  disabled={phase === "submitting" || phase === "processing"}
                  className="btn-primary btn-shine shrink-0 px-4 sm:px-5"
                  whileHover={{ scale: phase === "idle" && videoId ? 1.03 : 1 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {phase === "submitting" || phase === "processing" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : phase === "error" ? (
                    "Retry"
                  ) : videoId ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate
                    </>
                  ) : (
                    "Paste"
                  )}
                </motion.button>
              </div>
            </div>

            {/* Inline error / progress */}
            <AnimatePresence mode="wait">
              {errorMsg && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-start gap-2 mt-3 text-[12px]"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <AlertCircle
                    className="h-3.5 w-3.5 mt-0.5 shrink-0"
                    style={{ color: "rgb(239, 68, 68)" }}
                  />
                  <span>{errorMsg}</span>
                </motion.div>
              )}

              {phase === "processing" && (
                <motion.div
                  key="prog"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-3"
                >
                  <div
                    className="flex items-center justify-between text-[11px] font-mono mb-1.5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    <span>{progressMsg || "Working on it…"}</span>
                    <span className="tabular-nums">{elapsed}s</span>
                  </div>
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: "rgba(60, 50, 30, 0.10)" }}
                  >
                    <motion.div
                      className="h-full"
                      style={{ background: "var(--gradient-sunset)" }}
                      initial={{ width: "5%" }}
                      animate={{ width: ["10%", "85%", "55%", "90%"] }}
                      transition={{ duration: 60, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Complete state — clips inline */}
        {phase === "complete" && clips.length > 0 && (
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: "rgba(34, 197, 94, 0.12)",
                    border: "1px solid rgba(34, 197, 94, 0.30)",
                  }}
                >
                  <Check className="h-4 w-4" style={{ color: "rgb(34, 197, 94)" }} />
                </div>
                <div>
                  <div
                    className="text-[10px] font-mono uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    ✓ Done in {elapsed}s
                  </div>
                  <div
                    className="text-[13px] font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {clips.length} viral clips ready
                  </div>
                </div>
              </div>
              <button
                onClick={reset}
                className="text-[11px] font-mono uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                New link
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {clips.map((c, i) => (
                <motion.a
                  key={c.clip_id}
                  href={`${API_BASE}/download/${c.clip_id}`}
                  target="_blank"
                  rel="noreferrer"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -2 }}
                  className="glass-card p-3 flex items-center gap-2.5"
                  style={{ borderRadius: "var(--radius-lg)" }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: "var(--gradient-sunset)",
                      boxShadow: "0 0 8px rgba(217, 70, 239, 0.25)",
                    }}
                  >
                    <Video className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[12px] font-semibold truncate"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {c.viral_title || `Clip ${i + 1}`}
                    </div>
                    <div
                      className="text-[10px] font-mono tabular-nums"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {c.duration_s.toFixed(1)}s · 9:16 · @{(c.start ?? 0).toFixed(0)}s
                    </div>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                </motion.a>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
