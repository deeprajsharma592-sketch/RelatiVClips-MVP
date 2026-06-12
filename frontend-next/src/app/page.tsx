"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Play,
  Code2,
  TrendingUp,
  Zap,
  Brain,
  Wand2,
  Check,
  Cpu,
  Activity,
  Hash,
  GitBranch,
  Layers,
  BarChart3,
} from "lucide-react";
import MathBackground from "@/components/MathBackground";
import ParticleField from "@/components/ParticleField";
import HookCurve from "@/components/HookCurve";
import { submitYouTubeUrl, pollUntilComplete } from "@/lib/api";
import type { ProcessState, Clip, StatusResponse } from "@/types";

const DEMO_CLIPS: Clip[] = [
  {
    clip_id: "demo_1", start: 12.3, end: 27.8, duration_s: 15.5,
    caption: "The key insight that changes everything about how we think about AI safety and alignment.",
    viral_title: "AI Safety: The Paradigm Shift Nobody Saw Coming",
    hashtags: "#AI #Safety #Tech #Future", file_path: "", file_size_mb: 4.2,
    created_at: new Date().toISOString(),
  },
  {
    clip_id: "demo_2", start: 45.1, end: 62.4, duration_s: 17.3,
    caption: "Energy spike detected during the most intense moment of the conversation.",
    viral_title: "Watch This 3-Minute Debate Go Off The Rails",
    hashtags: "#Viral #Debate #Energy #Moment", file_path: "", file_size_mb: 5.1,
    created_at: new Date().toISOString(),
  },
  {
    clip_id: "demo_3", start: 88.7, end: 104.2, duration_s: 15.5,
    caption: "Highest engagement zone — the emotional peak that drives shares and comments.",
    viral_title: "The Hook That 12 Million People Couldn't Scroll Past",
    hashtags: "#Engagement #Hook #Content #Viral", file_path: "", file_size_mb: 4.8,
    created_at: new Date().toISOString(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE — code snippets + math
// ─────────────────────────────────────────────────────────────────────────────

const ENGINE = [
  {
    id: "speech",
    icon: Brain,
    badge: "Φ-Speech",
    title: "Transcribe, serverless",
    metric: "4 min",
    metricLabel: "for a 2-hour video",
    code: `// faster-whisper · RunPod
const transcript = await transcribe(video, {
  model: "large-v3",
  language: "auto",
  word_timestamps: true
});
// → 1.2M words · 4,820 turns`,
    math: "log P(wₜ | w<t) → softmax",
  },
  {
    id: "hook",
    icon: Wand2,
    badge: "Φ-Hook",
    title: "Claude picks the 10 winners",
    metric: "97%",
    metricLabel: "caption accuracy",
    code: `// Claude Haiku 4.5
const scores = await score(moments, {
  rubric: ["emotional_peak", "narrative_complete", "shareability"],
  top_k: 10
});
// → 4 of 4 judges agree`,
    math: "argmax Φ(x) · Φ ∈ ℝ⁺",
  },
  {
    id: "frame",
    icon: Cpu,
    badge: "Φ-Frame",
    title: "YOLO re-frames for 9:16",
    metric: "<2px",
    metricLabel: "centering error",
    code: `// YOLO v8 active-speaker
const face_box = await detect_active(face, {
  smoothing: "kalman",
  aspect: "9:16",
  margin: 0.08
});
// → 47.2 fps · 12 ms latency`,
    math: "x' = σ(Wx + b)",
  },
  {
    id: "story",
    icon: Sparkles,
    badge: "Φ-Story",
    title: "Captions, titles, hashtags",
    metric: "5×",
    metricLabel: "faster than manual",
    code: `// Anthropic + word-by-word
const clip = await render(moment, {
  captions: "word-by-word",
  titles: "viral-A/B/C/D",
  hashtags: "trending + niche",
});
// → 4 hook variants`,
    math: "L = -Σ yᵢ log ŷᵢ",
  },
];

const VERTICALS = [
  { tag: "01", title: "Podcasters", body: "Auto-detect the moment your guest says something quotable. Get 10 ready-to-post clips before the episode ends.", metric: "12 min", icon: Mic },
  { tag: "02", title: "Sports Highlights", body: "Match events synced to commentator energy spikes. Highlight package ready seconds after the whistle.", metric: "8 sec", icon: Activity },
  { tag: "03", title: "Coaches & Educators", body: "Long lessons, short attention spans. Find the 60-second insight that drives saves and shares.", metric: "4.7×", icon: TrendingUp },
  { tag: "04", title: "Live E-commerce", body: "Pin the moment of the product reveal, the demo, the discount drop. Conversion-ready reels on the fly.", metric: "+18% CVR", icon: Zap },
  { tag: "05", title: "Music & Artists", body: "Studio sessions, interviews, behind-the-scenes — distilled to the moments that drive catalog streams.", metric: "320% lift", icon: Hash },
  { tag: "06", title: "Brand & D2C", body: "Turn one brand film into 200 paid-media variations. Hook analysis built for premium organic reach.", metric: "12× ROI", icon: BarChart3 },
];

const PRICING = [
  {
    tier: "Starter",
    side: "creator",
    price: "$0",
    cadence: "free forever",
    cta: "Start clipping",
    features: ["60 min / month", "10 clips", "9:16 export", "Community support"],
  },
  {
    tier: "Pro",
    side: "creator",
    price: "$19",
    cadence: "per month",
    cta: "Try Pro free for 7 days",
    highlight: true,
    features: ["600 min / month", "Unlimited clips", "All aspect ratios", "Claude hook calibration", "Priority queue"],
  },
  {
    tier: "Elite",
    side: "creator",
    price: "$99",
    cadence: "per month",
    cta: "Go Elite",
    features: ["Everything in Pro", "Brand templates", "API access", "Dedicated support"],
  },
];

// Stub icon for verticals (no Mic in lucide-react; use Brain)
function Mic(props: any) {
  return <Brain {...props} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

function HeroSection({ onCtaClick }: { onCtaClick: () => void }) {
  return (
    <section className="relative min-h-[100vh] flex items-center overflow-hidden pt-24 pb-20">
      <MathBackground />
      <ParticleField density={0.4} />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 mb-8 px-3.5 py-1.5 rounded-full text-[11px] font-medium"
          style={{
            background: "rgba(255, 252, 242, 0.7)",
            backdropFilter: "blur(12px) saturate(180%)",
            WebkitBackdropFilter: "blur(12px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.7)",
            color: "var(--color-text-secondary)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: "#10B981" }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#10B981" }} />
          </span>
          <span>v2.0 · live now</span>
          <span className="text-text-faint">·</span>
          <span className="font-mono">Φ = taste, not length</span>
        </motion.div>

        {/* Hero title — mixing display + serif for the designer moment */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="font-display font-semibold tracking-tight max-w-5xl"
          style={{ fontSize: "clamp(2.75rem, 6.5vw, 5.5rem)", lineHeight: 0.98 }}
        >
          <span style={{ color: "var(--color-text-primary)" }}>Turn one video into</span>
          <br />
          <span className="hero-text text-gradient-sunset" style={{ fontSize: "1.1em" }}>
            ten viral clips
          </span>
          <br />
          <span style={{ color: "var(--color-text-primary)" }}>in&nbsp;</span>
          <span className="font-mono text-gradient-ocean" style={{ fontSize: "0.65em", fontStyle: "normal" }}>
            60.0s
          </span>
          <span style={{ color: "var(--color-text-primary)" }}>.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-8 text-lg md:text-xl max-w-2xl leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          RelatiV watches, listens, and finds the moments that{" "}
          <em className="font-serif not-italic" style={{ color: "var(--color-accent)" }}>hook</em>{" "}
          — then writes the caption, the title, the hashtags.
          <br className="hidden md:block" />
          You paste a URL. You publish clips.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <motion.button
            onClick={onCtaClick}
            className="btn-primary inline-flex items-center gap-2"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="relative z-10 flex items-center gap-2">
              <Play className="h-4 w-4" fill="white" />
              Paste a YouTube URL
              <ArrowRight className="h-4 w-4" />
            </span>
          </motion.button>

          <Link href="/services" className="btn-glass inline-flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            See the engine
          </Link>
        </motion.div>

        {/* Live metric strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl"
        >
          {[
            { v: "97.3%", l: "caption accuracy" },
            { v: "4.1 min", l: "for 2h video" },
            { v: "10 clips", l: "per source" },
            { v: "8.4×", l: "faster than manual" },
          ].map((m, i) => (
            <motion.div
              key={m.l}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.08 }}
              className="glass-card px-4 py-3"
            >
              <div className="font-mono text-2xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {m.v}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {m.l}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO
// ─────────────────────────────────────────────────────────────────────────────

function DemoSection() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<ProcessState>("idle");
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [80, -80]);

  const STEPS = useMemo(
    () => [
      { label: "Transcribe", sub: "Whisper · RunPod", math: "log P(wₜ|w<t)" },
      { label: "Energy peak detect", sub: "librosa · 12 Hz", math: "∇² E(t)" },
      { label: "Hook score", sub: "Claude · emotional peak", math: "argmax Φ(x)" },
      { label: "Render", sub: "YOLO · 9:16 frame", math: "x' = σ(Wx+b)" },
    ],
    []
  );

  useEffect(() => {
    if (state !== "processing") return;
    const t = setInterval(() => {
      setActiveStep((s) => (s + 1) % STEPS.length);
    }, 1100);
    return () => clearInterval(t);
  }, [state, STEPS.length]);

  const handleSubmit = useCallback(async () => {
    if (!url.trim()) return;
    setError(null);
    setClips([]);
    setActiveStep(0);
    setState("processing");
    try {
      const response = await submitYouTubeUrl(url.trim());
      setTaskId(response.taskId);
      const completed = await pollUntilComplete(response.taskId);
      setClips(completed.clips ?? []);
      setActiveStep(0);
      setState("completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setActiveStep(0);
      setState("error");
    }
  }, [url]);

  const loadDemo = useCallback(() => {
    setUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    setClips(DEMO_CLIPS);
    setActiveStep(0);
    setState("completed");
    setError(null);
  }, []);

  return (
    <section ref={sectionRef} id="try-it" className="relative py-28 overflow-hidden">
      <motion.div
        style={{
          y,
          background: "radial-gradient(circle, rgba(251,113,133,0.18) 0%, transparent 70%)",
        }}
        className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        style={{
          y: useTransform(scrollYProgress, [0, 1], [-60, 60]),
          background: "radial-gradient(circle, rgba(6,182,212,0.16) 0%, transparent 70%)",
        }}
        className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
      />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="mb-14 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium mb-6"
            style={{ background: "rgba(255, 252, 242, 0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)", color: "var(--color-text-secondary)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--gradient-sunset)" }} />
            <span className="font-mono">STEP 01 · 02 · 03 · 04</span>
          </div>
          <h2 className="font-display font-semibold tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)" }}>
            <span style={{ color: "var(--color-text-primary)" }}>Paste a URL.</span>
            <br />
            <span className="text-gradient-sunset">Get ten clips.</span>
          </h2>
          <p className="mt-5 text-lg max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>
            No upload, no editor, no waiting for an export queue. Drop a YouTube link, watch the engine work, download ready-to-publish clips.
          </p>
        </div>

        <div className="glass-panel p-6 md:p-10">
          <div className="grid lg:grid-cols-12 gap-8">
            {/* Input column */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>
                  [Φ] YouTube URL
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="https://youtube.com/watch?v=…"
                    disabled={state === "processing"}
                    className="input-glass flex-1"
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!url.trim() || state === "processing"}
                    className="btn-primary whitespace-nowrap"
                  >
                    {state === "processing" ? "Working…" : "Generate"}
                  </button>
                </div>
                <button
                  onClick={loadDemo}
                  disabled={state === "processing"}
                  className="mt-3 text-[11px] font-mono transition-colors"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  [→] or load a demo
                </button>
              </div>

              <div className="space-y-2">
                {STEPS.map((step, i) => {
                  const isActive = state === "processing" && i === activeStep;
                  const isDone = state === "completed";
                  return (
                    <motion.div
                      key={step.label}
                      className="flex items-center gap-3 p-3.5 rounded-2xl transition-all"
                      style={{
                        background: isActive
                          ? "rgba(217, 70, 239, 0.06)"
                          : isDone
                          ? "rgba(16, 185, 129, 0.04)"
                          : "rgba(255, 252, 242, 0.5)",
                        border: isActive
                          ? "1px solid rgba(217, 70, 239, 0.25)"
                          : isDone
                          ? "1px solid rgba(16, 185, 129, 0.15)"
                          : "1px solid rgba(60, 50, 30, 0.06)",
                      }}
                      animate={isActive ? { scale: [1, 1.015, 1] } : { scale: 1 }}
                      transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
                    >
                      <div
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold"
                        style={{
                          background: isDone ? "var(--color-success)" : isActive ? "var(--color-accent)" : "rgba(60, 50, 30, 0.08)",
                          color: isDone || isActive ? "white" : "var(--color-text-muted)",
                        }}
                      >
                        {isDone ? "✓" : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>{step.label}</p>
                        <p className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>{step.sub}</p>
                      </div>
                      <code className="text-[10px] font-mono hidden md:block" style={{ color: "var(--color-accent)" }}>
                        {step.math}
                      </code>
                    </motion.div>
                  );
                })}
              </div>

              {error && (
                <div
                  className="px-4 py-3 rounded-2xl text-[13px]"
                  style={{ background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "var(--color-error)" }}
                >
                  {error}
                </div>
              )}
            </div>

            {/* Output column */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(246, 241, 231, 0.5)", border: "1px solid rgba(60, 50, 30, 0.08)" }}>
                {state === "idle" && (
                  <div className="p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: "var(--gradient-sunset)", boxShadow: "0 4px 16px rgba(217,70,239,0.25)" }}>
                      <Wand2 className="h-6 w-6 text-white" />
                    </div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Your clips will appear here</p>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Paste a YouTube URL or load a demo</p>
                  </div>
                )}

                {state === "processing" && (
                  <div className="p-8 min-h-[300px] flex flex-col items-center justify-center">
                    <motion.div
                      className="w-16 h-16 rounded-full border-4 mb-4"
                      style={{ borderColor: "rgba(217, 70, 239, 0.15)", borderTopColor: "#D946EF" }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Processing your video…</p>
                    <p className="text-xs mt-1 font-mono" style={{ color: "var(--color-text-muted)" }}>{STEPS[activeStep]?.math}</p>
                  </div>
                )}

                {state === "completed" && clips.length > 0 && (
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between px-2 pb-1">
                      <p className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                        {clips.length} clips ready · top 3 shown
                      </p>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(16, 185, 129, 0.10)", color: "var(--color-success)" }}>
                        Φ ≥ 0.85
                      </span>
                    </div>
                    {clips.map((clip, i) => (
                      <motion.div
                        key={clip.clip_id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-3.5 rounded-2xl flex items-start gap-3"
                        style={{ background: "rgba(255, 252, 242, 0.75)", border: "1px solid rgba(60, 50, 30, 0.06)" }}
                      >
                        <div
                          className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-mono font-semibold text-white text-sm"
                          style={{ background: `linear-gradient(135deg, #FB7185, #8B5CF6)` }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold leading-snug" style={{ color: "var(--color-text-primary)" }}>
                            {clip.viral_title}
                          </p>
                          <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: "var(--color-text-muted)" }}>
                            {clip.caption}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <code className="text-[10px] font-mono" style={{ color: "var(--color-text-faint)" }}>
                              {clip.start.toFixed(1)}s → {clip.end.toFixed(1)}s
                            </code>
                            <span style={{ color: "var(--color-text-faint)" }}>·</span>
                            <code className="text-[10px] font-mono" style={{ color: "var(--color-text-faint)" }}>
                              {clip.duration_s.toFixed(1)}s
                            </code>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {state === "error" && (
                  <div className="p-8 min-h-[300px] flex flex-col items-center justify-center">
                    <p className="text-sm font-medium" style={{ color: "var(--color-error)" }}>Something went wrong</p>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE BENTO — code snippets + math
// ─────────────────────────────────────────────────────────────────────────────

function EngineBento() {
  return (
    <section className="relative py-28 overflow-hidden">
      <MathBackground />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="mb-14 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium mb-6"
            style={{ background: "rgba(255, 252, 242, 0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)", color: "var(--color-text-secondary)" }}>
            <Cpu className="h-3 w-3" />
            <span>THE ENGINE · 4 STAGES</span>
          </div>
          <h2 className="font-display font-semibold tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)" }}>
            <span style={{ color: "var(--color-text-primary)" }}>Four models, one</span>{" "}
            <span className="hero-text text-gradient-ocean">decisive</span>{" "}
            <span style={{ color: "var(--color-text-primary)" }}>verdict.</span>
          </h2>
          <p className="mt-5 text-lg max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>
            Each stage is replaceable. The pipeline is not. Run any video through it and the same ten moments surface.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {ENGINE.map((e, i) => {
            const Icon = e.icon;
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-6 md:p-7 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center"
                      style={{
                        background: "var(--gradient-sunset)",
                        boxShadow: "0 4px 12px rgba(217, 70, 239, 0.20)",
                      }}
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                        {e.badge}
                      </p>
                      <p className="text-[15px] font-semibold mt-0.5" style={{ color: "var(--color-text-primary)" }}>
                        {e.title}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xl font-semibold text-gradient-sunset">{e.metric}</div>
                    <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{e.metricLabel}</div>
                  </div>
                </div>

                {/* Code snippet */}
                <pre
                  className="rounded-2xl p-4 text-[12px] font-mono overflow-x-auto leading-relaxed"
                  style={{
                    background: "rgba(40, 30, 15, 0.92)",
                    color: "#E8E4D8",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                  }}
                >
                  {e.code}
                </pre>

                {/* Math expression */}
                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  <span className="font-mono" style={{ color: "var(--color-text-faint)" }}>math:</span>
                  <code className="font-serif italic text-gradient-sunset" style={{ fontSize: "13px" }}>
                    {e.math}
                  </code>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK CURVE — the actual algorithm visualization
// ─────────────────────────────────────────────────────────────────────────────

function HookCurveSection() {
  return (
    <section className="relative py-28 overflow-hidden">
      <ParticleField density={0.2} />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium mb-6"
              style={{ background: "rgba(255, 252, 242, 0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)", color: "var(--color-text-secondary)" }}>
              <Activity className="h-3 w-3" />
              <span>HOOK DETECTION · LIVE</span>
            </div>
            <h2 className="font-display font-semibold tracking-tight leading-[1.05]"
              style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}>
              <span style={{ color: "var(--color-text-primary)" }}>We don't guess.</span>
              <br />
              <span className="hero-text text-gradient-sunset">We measure.</span>
            </h2>
            <p className="mt-5 text-lg" style={{ color: "var(--color-text-secondary)" }}>
              Every 250 ms, the engine scores the moment against 4 axes:
              emotional peak, narrative completeness, shareability, attention spike.
              Only the top 10 cross the <code className="font-mono text-sm" style={{ color: "var(--color-accent)" }}>Φ = 0.70</code> threshold.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { k: "Emotional peak", v: "0.42" },
                { k: "Narrative", v: "0.31" },
                { k: "Shareability", v: "0.18" },
                { k: "Attention Δ", v: "0.09" },
              ].map((d) => (
                <div key={d.k} className="glass-card px-4 py-3">
                  <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                    {d.k}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(60, 50, 30, 0.08)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "var(--gradient-sunset)" }}
                        initial={{ width: 0 }}
                        whileInView={{ width: d.v }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, delay: 0.2 }}
                      />
                    </div>
                    <code className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                      {d.v}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="glass-panel p-8"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  energy(t) · 2-hour source
                </p>
                <p className="text-[13px] font-mono mt-1" style={{ color: "var(--color-text-primary)" }}>
                  audio_rms + speech_dynamics
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  detected peaks
                </p>
                <p className="text-2xl font-display font-semibold text-gradient-sunset">3 / 7200s</p>
              </div>
            </div>
            <HookCurve />
            <div className="mt-4 flex items-center gap-2 text-[11px] font-mono" style={{ color: "var(--color-text-faint)" }}>
              <span>signal:</span>
              <code className="text-gradient-ocean">E(t) = ∫ audio_rms · w(τ) dτ</code>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VERTICALS
// ─────────────────────────────────────────────────────────────────────────────

function VerticalsSection() {
  return (
    <section className="relative py-28 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="mb-14 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium mb-6"
            style={{ background: "rgba(255, 252, 242, 0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)", color: "var(--color-text-secondary)" }}>
            <Layers className="h-3 w-3" />
            <span>USE CASES</span>
          </div>
          <h2 className="font-display font-semibold tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)" }}>
            <span style={{ color: "var(--color-text-primary)" }}>Built for people who</span>{" "}
            <span className="hero-text text-gradient-sunset">ship content</span>
            <span style={{ color: "var(--color-text-primary)" }}>.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {VERTICALS.map((v, i) => {
            const Icon = v.icon;
            return (
              <motion.div
                key={v.tag}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="glass-card p-6 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ background: "rgba(217, 70, 239, 0.08)", border: "1px solid rgba(217, 70, 239, 0.15)" }}
                    >
                      <Icon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono" style={{ color: "var(--color-text-faint)" }}>{v.tag}</p>
                      <p className="text-[15px] font-semibold mt-0.5" style={{ color: "var(--color-text-primary)" }}>
                        {v.title}
                      </p>
                    </div>
                  </div>
                  <code className="text-[11px] font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(6, 182, 212, 0.08)", color: "#0891B2" }}>
                    {v.metric}
                  </code>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                  {v.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING
// ─────────────────────────────────────────────────────────────────────────────

function PricingSection() {
  return (
    <section className="relative py-28 overflow-hidden">
      <MathBackground />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="mb-14 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium mb-6"
            style={{ background: "rgba(255, 252, 242, 0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)", color: "var(--color-text-secondary)" }}>
            <span className="font-mono">PRICING</span>
          </div>
          <h2 className="font-display font-semibold tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)" }}>
            <span style={{ color: "var(--color-text-primary)" }}>Pay per clip, not per seat.</span>
          </h2>
          <p className="mt-4 text-lg" style={{ color: "var(--color-text-secondary)" }}>
            Start free. Upgrade when you ship. Cancel anytime — your clips stay yours.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {PRICING.map((tier, i) => (
            <motion.div
              key={tier.tier}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={tier.highlight ? "glass-panel p-7 relative overflow-hidden" : "glass-card p-7"}
              style={tier.highlight ? { border: "2px solid rgba(217, 70, 239, 0.3)" } : undefined}
            >
              {tier.highlight && (
                <div
                  className="absolute -top-px left-0 right-0 h-1 animate-gradient"
                  style={{ background: "var(--gradient-sunset)", backgroundSize: "200% 100%" }}
                />
              )}
              {tier.highlight && (
                <div className="absolute top-4 right-4">
                  <span
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      background: "var(--gradient-sunset)",
                      color: "white",
                      boxShadow: "0 2px 8px rgba(217, 70, 239, 0.30)",
                    }}
                  >
                    Most popular
                  </span>
                </div>
              )}

              <p className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                {tier.tier}
              </p>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-display font-semibold" style={{ fontSize: "2.75rem)", lineHeight: 1, color: "var(--color-text-primary)" } as any}>
                  {tier.price}
                </span>
                <span className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                  {tier.cadence}
                </span>
              </div>

              <Link
                href="/signup"
                className={tier.highlight ? "btn-primary w-full justify-center mt-6 inline-flex" : "btn-glass w-full justify-center mt-6 inline-flex"}
              >
                {tier.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>

              <ul className="mt-6 space-y-2.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                    <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: tier.highlight ? "var(--color-accent)" : "var(--color-success)" }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-[12px]" style={{ color: "var(--color-text-muted)" }}>
          Need 10+ seats, an API, or a custom brand deal? <Link href="/plans" className="font-semibold" style={{ color: "var(--color-accent)" }}>See the full plans →</Link>
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL CTA
// ─────────────────────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <section className="relative py-28 overflow-hidden">
      <div className="relative max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-panel p-10 md:p-14 text-center relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.25) 0%, transparent 70%)" }} />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.20) 0%, transparent 70%)" }} />

          <div className="relative">
            <p className="text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>
              ready when you are
            </p>
            <h2 className="font-display font-semibold tracking-tight leading-[1.05]"
              style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)" }}>
              <span style={{ color: "var(--color-text-primary)" }}>Stop clipping.</span>{" "}
              <span className="hero-text text-gradient-sunset">Start shipping.</span>
            </h2>
            <p className="mt-5 text-lg max-w-xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
              Paste a YouTube link. Get 10 ready-to-post clips in 5 minutes.
              <br />
              <span className="font-mono text-sm" style={{ color: "var(--color-text-muted)" }}>
                No card. 7-day Pro trial. Cancel anytime.
              </span>
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup" className="btn-primary inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/services" className="btn-ghost inline-flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Read the engine spec
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>
              <span className="flex items-center gap-1.5">
                <Check className="h-3 w-3" style={{ color: "var(--color-success)" }} />
                7-day Pro trial
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3 w-3" style={{ color: "var(--color-success)" }} />
                Self-hostable
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3 w-3" style={{ color: "var(--color-success)" }} />
                Open test set
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const demoRef = useRef<HTMLDivElement>(null);
  const scrollToDemo = useCallback(() => {
    document.getElementById("try-it")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <>
      <HeroSection onCtaClick={scrollToDemo} />
      <DemoSection />
      <EngineBento />
      <HookCurveSection />
      <VerticalsSection />
      <PricingSection />
      <CtaSection />
    </>
  );
}
