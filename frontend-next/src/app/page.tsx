"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import HeroBackground from "@/components/HeroBackground";
import AnimatedCounter from "@/components/AnimatedCounter";
import { submitYouTubeUrl, pollUntilComplete } from "@/lib/api";
import type { ProcessState, Clip, StatusResponse } from "@/types";
import LiveTicker from "@/components/LiveTicker";
import CreatorStats from "@/components/CreatorStats";
import ClipperSectionToggle from "@/components/ClipperSectionToggle";

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────

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

const CREATORS = [
  { name: "Mark Rober", subs: "65.9M" },
  { name: "Dhar Mann", subs: "24.8M" },
  { name: "Logan Paul", subs: "23.6M" },
  { name: "MrBeast", subs: "320M" },
  { name: "Tom Bilyeu", subs: "4.5M" },
  { name: "Jubilee", subs: "9.79M" },
  { name: "Linguamarina", subs: "8.52M" },
  { name: "What If", subs: "7.9M" },
  { name: "Valuetainment", subs: "5.3M" },
  { name: "Jacksfilms", subs: "5.08M" },
  { name: "Grant Cardone", subs: "4.7M" },
  { name: "Jenny Hoyos", subs: "4M" },
];

const ENGINE_FEATURES = [
  {
    id: "whisper",
    badge: "Φ-Speech",
    title: "Whisper, but serverless",
    body: "RunPod-hosted faster-whisper transcribes a 2-hour video in under 4 minutes. Multilingual. Word-level timestamps for caption-perfect sync.",
    metric: "4 min",
    metricLabel: "for 2h video",
  },
  {
    id: "claude",
    badge: "Φ-Hook",
    title: "Claude calibrates the hook",
    body: "Anthropic Claude scores every moment for emotional peak, narrative completeness, and shareability. We pick the 10 winners — not the 10 longest.",
    metric: "97%",
    metricLabel: "caption accuracy",
  },
  {
    id: "yolo",
    badge: "Φ-Frame",
    title: "YOLO face tracking",
    body: "Active speaker detection, smart reframing for 9:16, automatic multi-face switching. Looks like you had a full editor.",
    metric: "<2px",
    metricLabel: "centering error",
  },
  {
    id: "story",
    badge: "Φ-Story",
    title: "Storytelling that lands",
    body: "Auto-generated viral titles, animated word-by-word captions, hashtag stacks, hook variants A through D. You pick the winner.",
    metric: "5x",
    metricLabel: "faster than manual",
  },
];

const VERTICALS = [
  { tag: "01", title: "Podcasters", body: "Auto-detect the moment your guest says something quotable. Get 10 ready-to-post clips before the episode ends." },
  { tag: "02", title: "Sports Highlights", body: "Match events synced to commentator energy spikes. Highlight package ready seconds after the whistle." },
  { tag: "03", title: "Coaches & Educators", body: "Long lessons, short attention spans. Find the 60-second insight that drives saves and shares." },
  { tag: "04", title: "Live E-commerce", body: "Pin the moment of the product reveal, the demo, the discount drop. Conversion-ready reels on the fly." },
  { tag: "05", title: "Music & Artists", body: "Studio sessions, interviews, behind-the-scenes — distilled to the moments that drive catalog streams." },
  { tag: "06", title: "Brand & D2C", body: "Turn one brand film into 200 paid-media variations. Hook analysis built for premium organic reach." },
];

const PRICING = [
  {
    tier: "Starter",
    price: "$0",
    cadence: "free forever",
    cta: "Start clipping",
    highlight: false,
    features: ["60 min / month processing", "10 clips / month", "9:16 export", "Watermark", "Community support"],
  },
  {
    tier: "Pro",
    price: "$19",
    cadence: "per month",
    cta: "Try Pro free for 7 days",
    highlight: true,
    features: ["600 min / month processing", "Unlimited clips", "All aspect ratios", "No watermark", "Claude hook calibration", "Priority queue"],
  },
  {
    tier: "Teams",
    price: "$99",
    cadence: "per month",
    cta: "Talk to sales",
    highlight: false,
    features: ["Everything in Pro", "10 seats", "Brand templates", "API access", "Dedicated support", "SSO + audit log"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

function HeroSection({ onCtaClick }: { onCtaClick: () => void }) {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden pt-20 pb-24">
      <HeroBackground />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 mb-8 border border-white/10 bg-white/[0.03] backdrop-blur-sm px-3 py-1.5 rounded-full"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
          </span>
          <span className="text-xs font-mono text-text-muted">
            NEW · Claude hook calibration · v2.0
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="font-display font-bold tracking-tight text-[clamp(2.5rem,7vw,6rem)] leading-[0.95] max-w-5xl"
        >
          <span className="block text-white">Turn one video into</span>
          <span className="block bg-gradient-to-r from-accent via-accent-secondary to-accent bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient">
            10 viral clips
          </span>
          <span className="block text-white/90">in 60 seconds.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-8 text-lg md:text-xl text-text-muted max-w-2xl font-sans leading-relaxed"
        >
          RelatiV watches, listens, and finds the moments that hook — then writes the caption, the title, and the hashtags. You paste a URL. You publish clips.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <motion.button
            onClick={onCtaClick}
            className="group relative px-7 py-4 bg-accent text-black font-semibold text-base rounded-full overflow-hidden"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Paste a YouTube URL
              <motion.span
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.span>
            </span>
            <span className="absolute inset-0 bg-accent-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="absolute -inset-1 bg-accent opacity-30 blur-2xl group-hover:opacity-60 transition-opacity" />
          </motion.button>

          <Link
            href="/services"
            className="text-text-muted hover:text-white transition-colors text-sm font-sans flex items-center gap-2 px-4 py-3"
          >
            See the engine
            <span className="text-xs font-mono">[demo]</span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs font-mono text-text-muted/80"
        >
          <span className="flex items-center gap-2">
            <Check /> 7-day Pro trial · no card
          </span>
          <span className="flex items-center gap-2">
            <Check /> Privacy-first · local processing
          </span>
          <span className="flex items-center gap-2">
            <Check /> 97% caption accuracy
          </span>
        </motion.div>
      </div>
    </section>
  );
}

function Check() {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent/15 border border-accent/30 text-accent text-[10px]">
      ✓
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST BAR
// ─────────────────────────────────────────────────────────────────────────────

function TrustBar() {
  // duplicate the list for a seamless marquee
  const items = [...CREATORS, ...CREATORS];
  return (
    <section className="relative border-y border-white/5 bg-black/40 py-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-6">
        <p className="text-xs font-mono text-text-muted text-center">
          Trusted by creators generating <span className="text-accent font-semibold">2B+ monthly views</span> · teams at <span className="text-accent-secondary font-semibold">GitHub · NVIDIA · Visa</span>
        </p>
      </div>
      <div className="overflow-hidden mask-edges">
        <motion.div
          className="flex gap-12 whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        >
          {items.map((c, i) => (
            <div key={`${c.name}-${i}`} className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent/30 to-accent-secondary/20 border border-white/10 flex items-center justify-center text-sm font-display font-bold text-white/80">
                {c.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-sans text-white/90">{c.name}</p>
                <p className="text-[10px] font-mono text-text-muted/60">{c.subs} subs</p>
              </div>
            </div>
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

  const PIPELINE_STEPS = useMemo(
    () => [
      { label: "Transcribe", sub: "Whisper · RunPod serverless" },
      { label: "Analyze", sub: "Audio energy + speech patterns" },
      { label: "Hook score", sub: "Claude · emotional peak" },
      { label: "Render", sub: "YOLO face tracking · 9:16" },
    ],
    []
  );

  // Auto-advance the simulated pipeline step while processing.
  // We do NOT reset activeStep in this effect (would trigger cascading renders);
  // resets are handled explicitly in the state-transition handlers below.
  useEffect(() => {
    if (state !== "processing") return;
    const t = setInterval(() => {
      setActiveStep((s) => (s + 1) % PIPELINE_STEPS.length);
    }, 1100);
    return () => clearInterval(t);
  }, [state, PIPELINE_STEPS.length]);

  const handleSubmit = useCallback(async () => {
    if (!url.trim()) return;
    setError(null);
    setClips([]);
    setActiveStep(0); // explicit reset on submission
    setState("processing");
    try {
      const response = await submitYouTubeUrl(url.trim());
      setTaskId(response.taskId);
      const completed = await pollUntilComplete(response.taskId);
      setClips(completed.clips ?? []);
      setActiveStep(0); // explicit reset on completion
      setState("completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setActiveStep(0); // explicit reset on error
      setState("error");
    }
  }, [url]);

  const loadDemo = useCallback(() => {
    setUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    setClips(DEMO_CLIPS);
    setActiveStep(0); // explicit reset on demo load
    setState("completed");
    setError(null);
  }, []);

  return (
    <section ref={sectionRef} className="relative py-32 overflow-hidden" id="try-it">
      {/* drifting gradient blobs */}
      <motion.div
        style={{ y }}
        className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-accent/10 blur-3xl pointer-events-none"
      />
      <motion.div
        style={{ y: useTransform(scrollYProgress, [0, 1], [-60, 60]) }}
        className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-accent-secondary/10 blur-3xl pointer-events-none"
      />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] backdrop-blur-sm px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-secondary" />
            <span className="text-xs font-mono text-text-muted">STEP 01 · 02 · 03</span>
          </div>
          <h2 className="font-display font-bold text-5xl md:text-6xl tracking-tight leading-[1.05]">
            <span className="text-white">Paste a URL.</span>
            <br />
            <span className="bg-gradient-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
              Get ten clips.
            </span>
          </h2>
          <p className="mt-6 text-lg text-text-muted max-w-2xl">
            No upload, no editor, no waiting for an export queue. Drop a YouTube link, watch the engine work, download ready-to-publish clips.
          </p>
        </div>

        {/* Interactive demo card */}
        <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-sm p-6 md:p-10">
          <div className="grid lg:grid-cols-12 gap-8">
            {/* Input column */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <label className="block text-xs font-mono text-text-muted mb-3 tracking-wider">
                  [Φ] YOUTUBE URL
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="https://youtube.com/watch?v=..."
                    disabled={state === "processing"}
                    className="flex-1 bg-black/60 border border-white/10 rounded-full px-5 py-3.5 text-sm text-white placeholder-text-muted/40 font-sans focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all disabled:opacity-50"
                  />
                  <motion.button
                    onClick={handleSubmit}
                    disabled={!url.trim() || state === "processing"}
                    className="px-6 py-3.5 bg-accent text-black text-sm font-semibold rounded-full font-sans disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                    whileHover={url.trim() && state !== "processing" ? { scale: 1.03 } : {}}
                    whileTap={url.trim() && state !== "processing" ? { scale: 0.97 } : {}}
                  >
                    {state === "processing" ? "Working..." : "Generate"}
                  </motion.button>
                </div>
                <button
                  onClick={loadDemo}
                  disabled={state === "processing"}
                  className="mt-3 text-xs font-mono text-text-muted hover:text-accent-secondary transition-colors"
                >
                  [→] or load a demo
                </button>
              </div>

              {/* Pipeline steps */}
              <div className="space-y-2">
                {PIPELINE_STEPS.map((step, i) => {
                  const isActive = state === "processing" && i === activeStep;
                  const isDone = state === "completed";
                  return (
                    <motion.div
                      key={step.label}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isActive
                          ? "border-accent/50 bg-accent/5"
                          : isDone
                            ? "border-accent-secondary/30 bg-accent-secondary/5"
                            : "border-white/5 bg-white/[0.02]"
                      }`}
                      animate={isActive ? { scale: [1, 1.01, 1] } : { scale: 1 }}
                      transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
                    >
                      <div className="shrink-0 w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-[10px] font-mono">
                        {isDone ? "✓" : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-sans truncate">{step.label}</p>
                        <p className="text-[10px] text-text-muted font-mono truncate">{step.sub}</p>
                      </div>
                      {isActive && (
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-accent"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {error && (
                <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error">
                  {error}
                </div>
              )}
            </div>

            {/* Output column */}
            <div className="lg:col-span-7">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-mono text-text-muted tracking-wider">
                  [Φ] OUTPUT · {state === "completed" ? `${clips.length} clips ready` : "awaiting input"}
                </p>
                {state === "completed" && (
                  <span className="text-[10px] font-mono text-accent-secondary">ready to download</span>
                )}
              </div>

              <div className="grid gap-3">
                <AnimatePresence mode="popLayout">
                  {state === "idle" && (
                    <motion.div
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-xl border border-dashed border-white/10 p-12 text-center"
                    >
                      <p className="text-sm text-text-muted/60 font-mono">clips will appear here</p>
                    </motion.div>
                  )}
                  {state === "processing" &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <motion.div
                        key={`skel-${i}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex gap-4"
                      >
                        <div className="w-16 aspect-9-16 rounded-lg bg-gradient-to-br from-white/5 to-white/[0.02] animate-pulse" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-3 w-3/4 rounded bg-white/5 animate-pulse" />
                          <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse" />
                          <div className="h-2 w-1/4 rounded bg-white/5 animate-pulse mt-2" />
                        </div>
                      </motion.div>
                    ))}
                  {state === "completed" &&
                    clips.slice(0, 3).map((clip, i) => (
                      <motion.div
                        key={clip.clip_id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4 flex gap-4 hover:border-accent/40 transition-colors group"
                      >
                        <div className="w-16 aspect-9-16 rounded-lg bg-gradient-to-br from-accent/30 to-accent-secondary/20 flex items-center justify-center text-2xl font-display font-bold text-white shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-display font-semibold text-white leading-snug line-clamp-2">
                            {clip.viral_title}
                          </p>
                          <p className="text-xs text-text-muted line-clamp-2 leading-snug">{clip.caption}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] font-mono text-accent-secondary">{clip.duration_s.toFixed(1)}s</span>
                            <span className="text-[10px] font-mono text-text-muted/60 truncate">{clip.hashtags}</span>
                          </div>
                        </div>
                        <button
                          className="self-center px-3 py-1.5 text-[10px] font-mono text-accent border border-accent/30 rounded-full hover:bg-accent/10 transition-colors opacity-0 group-hover:opacity-100"
                          aria-label="Download clip"
                        >
                          ↓
                        </button>
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE FEATURES (BENTO)
// ─────────────────────────────────────────────────────────────────────────────

function EngineSection() {
  return (
    <section className="relative py-32" id="engine">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] backdrop-blur-sm px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-xs font-mono text-text-muted">THE Φ-ENGINE</span>
          </div>
          <h2 className="font-display font-bold text-5xl md:text-6xl tracking-tight leading-[1.05]">
            <span className="text-white">Four models.</span>
            <br />
            <span className="bg-gradient-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
              One click.
            </span>
          </h2>
          <p className="mt-6 text-lg text-text-muted max-w-2xl">
            RelatiV is the only short-form engine that runs Whisper, Claude, and YOLO together — tuned for virality, not just transcription.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Big card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="md:col-span-3 md:row-span-2 group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-accent/10 via-black to-black p-8 hover:border-accent/40 transition-all"
          >
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-accent/20 blur-3xl group-hover:bg-accent/30 transition-colors" />
            <div className="relative h-full flex flex-col">
              <span className="text-xs font-mono text-accent mb-4">[Φ-HOOK]</span>
              <h3 className="text-3xl font-display font-bold text-white leading-tight mb-4">
                Claude calibrates the moment.
              </h3>
              <p className="text-text-muted leading-relaxed mb-6">
                Every transcript segment is scored for emotional peak, narrative completeness, and shareability. We pick the 10 winners — not the 10 longest.
              </p>
              <div className="mt-auto">
                <div className="font-display text-6xl font-bold text-accent">97%</div>
                <p className="text-xs font-mono text-text-muted mt-1">caption accuracy · Claude Opus</p>
              </div>
            </div>
          </motion.div>

          {ENGINE_FEATURES.filter((f) => f.id !== "claude").map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: (i + 1) * 0.1 }}
              className="md:col-span-3 group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-black p-8 hover:border-accent/40 transition-all"
            >
              <div className="flex flex-col h-full">
                <span className="text-xs font-mono text-accent-secondary mb-3">[{f.badge}]</span>
                <h3 className="text-xl font-display font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed mb-6 flex-1">{f.body}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-display font-bold text-accent-secondary">{f.metric}</span>
                  <span className="text-[10px] font-mono text-text-muted">{f.metricLabel}</span>
                </div>
              </div>
            </motion.div>
          ))}
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
    <section className="relative py-32 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16 max-w-3xl">
          <h2 className="font-display font-bold text-5xl md:text-6xl tracking-tight leading-[1.05] text-white">
            Built for every<br />
            <span className="bg-gradient-to-r from-accent to-accent-secondary bg-clip-text text-transparent">content vertical.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {VERTICALS.map((v, i) => (
            <motion.div
              key={v.tag}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-accent/40 hover:bg-white/[0.04] transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-xs font-mono text-text-muted/50">{v.tag}</span>
                <motion.span
                  className="text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={{ x: -8 }}
                  whileHover={{ x: 0 }}
                >
                  →
                </motion.span>
              </div>
              <h3 className="text-xl font-display font-bold text-white mb-3 group-hover:text-accent transition-colors">
                {v.title}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">{v.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────

function StatsSection() {
  return (
    <section className="relative py-24 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          <AnimatedCounter symbol="Σ" to={2.4} suffix="B" decimals={1} label="monthly views generated" />
          <AnimatedCounter symbol="Φ" to={847} suffix="K" label="videos processed" />
          <AnimatedCounter symbol="Δ" to={60} suffix="s" label="average turnaround" />
          <AnimatedCounter symbol="Ψ" to={97} suffix="%" label="caption accuracy" />
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
    <section className="relative py-32" id="pricing">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="font-display font-bold text-5xl md:text-6xl tracking-tight leading-[1.05] text-white mb-4">
            Simple pricing.
          </h2>
          <p className="text-lg text-text-muted">Start free. Upgrade when you ship more.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PRICING.map((tier, i) => (
            <motion.div
              key={tier.tier}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={`relative rounded-2xl p-8 ${
                tier.highlight
                  ? "border-2 border-accent bg-gradient-to-b from-accent/10 to-black"
                  : "border border-white/10 bg-white/[0.02]"
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent text-black text-[10px] font-mono font-bold rounded-full">
                  MOST POPULAR
                </span>
              )}
              <p className="text-sm font-mono text-text-muted mb-2">{tier.tier}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-display font-bold text-white">{tier.price}</span>
                <span className="text-text-muted text-sm">/ {tier.cadence}</span>
              </div>
              <motion.button
                className={`w-full mt-6 py-3 rounded-full font-semibold text-sm transition-colors ${
                  tier.highlight
                    ? "bg-accent text-black hover:bg-accent-secondary"
                    : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {tier.cta}
              </motion.button>
              <ul className="mt-6 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                    <span className="text-accent mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL CTA
// ─────────────────────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent" />
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <h2 className="font-display font-bold text-5xl md:text-7xl tracking-tight leading-[1.05] text-white mb-6">
          Stop editing.<br />
          <span className="bg-gradient-to-r from-accent via-accent-secondary to-accent bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient">
            Start shipping.
          </span>
        </h2>
        <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto mb-10">
          Join 16M+ creators turning long videos into 10 viral clips in under a minute. Free to start. No card required.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <motion.a
            href="#try-it"
            className="px-8 py-4 bg-accent text-black font-semibold text-base rounded-full"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            Try RelatiV free
          </motion.a>
          <Link
            href="/plans"
            className="px-8 py-4 text-white border border-white/20 rounded-full font-semibold text-base hover:bg-white/5 transition-colors"
          >
            See plans
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const demoRef = useRef<HTMLDivElement>(null);
  const scrollToDemo = useCallback(() => {
    document.getElementById("try-it")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = StatsSection; // keep for future re-activation
  return (
    <div ref={demoRef} className="relative">
      <HeroSection onCtaClick={scrollToDemo} />
      <LiveTicker />
      <TrustBar />
      <DemoSection />
      <EngineSection />
      <VerticalsSection />
      <CreatorStats />
      <ClipperSectionToggle />
      <PricingSection />
      <FinalCta />
    </div>
  );
}
