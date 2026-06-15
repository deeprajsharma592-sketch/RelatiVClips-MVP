"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion, useScroll, useTransform, useInView } from "framer-motion";
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
  ChevronDown,
  Video,
  Users,
  Clock,
  Shield,
  Mic,
} from "lucide-react";
import PremiumGrid from "@/components/PremiumGrid";
import ParticleField from "@/components/ParticleField";
import HookCurve from "@/components/HookCurve";
import TextScramble from "@/components/TextScramble";
import MagneticButton from "@/components/MagneticButton";
import { submitYouTubeUrl, pollUntilComplete } from "@/lib/api";
import type { ProcessState, Clip } from "@/types";

// ════════════════════════════════════════════════════════════════════════════
// DATA
// ════════════════════════════════════════════════════════════════════════════

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

const ENGINE = [
  {
    id: "speech", icon: Brain, badge: "Φ-Speech", title: "Transcribe, serverless",
    metric: "4 min", metricLabel: "for a 2-hour video",
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
    id: "hook", icon: Wand2, badge: "Φ-Hook", title: "Claude picks the 10 winners",
    metric: "97%", metricLabel: "caption accuracy",
    code: `// Claude Haiku 4.5
const scores = await score(moments, {
  rubric: ["emotional_peak", "narrative_complete", "shareability"],
  top_k: 10
});
// → 4 of 4 judges agree`,
    math: "argmax Φ(x) · Φ ∈ ℝ⁺",
  },
  {
    id: "frame", icon: Cpu, badge: "Φ-Frame", title: "YOLO re-frames for 9:16",
    metric: "<2px", metricLabel: "centering error",
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
    id: "story", icon: Sparkles, badge: "Φ-Story", title: "Captions, titles, hashtags",
    metric: "5×", metricLabel: "faster than manual",
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
  { tag: "01", title: "Podcasters", body: "Auto-detect the moment your guest says something quotable. Get clips before the episode ends.", metric: "soon", icon: Mic },
  { tag: "02", title: "Sports Highlights", body: "Match events synced to commentator energy spikes. Highlight package ready when the whistle blows.", metric: "soon", icon: Activity },
  { tag: "03", title: "Coaches & Educators", body: "Long lessons, short attention spans. Find the 60-second insight that drives saves and shares.", metric: "soon", icon: TrendingUp },
  { tag: "04", title: "Live E-commerce", body: "Pin the moment of the product reveal, the demo, the discount drop. Conversion-ready reels on the fly.", metric: "soon", icon: Zap },
  { tag: "05", title: "Music & Artists", body: "Studio sessions, interviews, behind-the-scenes — distilled to the moments that drive catalog streams.", metric: "soon", icon: Hash },
  { tag: "06", title: "Brand & D2C", body: "Turn one brand film into many paid-media variations. Hook analysis built for premium organic reach.", metric: "soon", icon: BarChart3 },
];

const PRICING = [
  {
    tier: "Starter", side: "creator", price: "$0", cadence: "free forever", cta: "Start clipping",
    features: ["60 min / month", "10 clips", "9:16 export", "Community support"],
  },
  {
    tier: "Pro", side: "creator", price: "$19", cadence: "per month", cta: "Try Pro free for 7 days",
    highlight: true,
    features: ["600 min / month", "Unlimited clips", "All aspect ratios", "Claude hook calibration", "Priority queue"],
  },
  {
    tier: "Elite", side: "creator", price: "$99", cadence: "per month", cta: "Go Elite",
    features: ["Everything in Pro", "Brand templates", "API access", "Dedicated support"],
  },
];

const PLATFORMS = [
  "YouTube", "Twitch", "Instagram", "TikTok", "X", "LinkedIn",
  "Spotify", "Apple Podcasts", "Kick", "Rumble", "Substack", "Vimeo",
];

const HOW_STEPS = [
  {
    num: "01", icon: Video, title: "Paste a URL",
    body: "Drop a YouTube link, podcast RSS, or upload a file. No editor, no timeline, no learning curve.",
    artifact: { label: "input", value: "youtube.com/watch?v=…" },
  },
  {
    num: "02", icon: Cpu, title: "Engine runs",
    body: "Four models score every moment: speech, energy, hook, frame. Winners surface in minutes.",
    artifact: { label: "computed", value: "4,820 turns · 47 peaks · 10 picks" },
  },
  {
    num: "03", icon: Sparkles, title: "Ship clips",
    body: "Word-by-word captions, viral title, hashtags, 9:16 render. Download or post directly.",
    artifact: { label: "output", value: "10 × .mp4 + .srt" },
  },
];

const FAQ_ITEMS = [
  { q: "How long does it take to generate clips?", a: "4 minutes for a 2-hour source. The bottleneck is transcription (Whisper large-v3 on RunPod). Once transcribed, scoring and rendering take 30 seconds." },
  { q: "What aspect ratios are supported?", a: "9:16 (TikTok, Reels, Shorts), 1:1 (LinkedIn, X), 16:9 (YouTube). All three render from the same source. Output is H.264 MP4 at 1080×1920 / 1080×1080 / 1920×1080." },
  { q: "Can I edit the auto-generated captions?", a: "Yes. Every clip ships with a .srt file and editable captions baked into the video. Pro and Elite plans also get word-by-word animated captions with custom fonts." },
  { q: "Who owns the clips?", a: "You do. Always. We process your source on our GPU workers, render locally, and the files are yours to download, post, and monetize. We never train models on your content." },
  { q: "Do you support languages other than English?", a: "Whisper auto-detects 99 languages. Claude scoring is currently English-only but works with multilingual transcripts. UI is English. We are adding Hindi, Spanish, and Portuguese in Q3." },
  { q: "What's the difference between Pro and Elite?", a: "Pro is for solo creators (600 min/month, all aspect ratios, priority queue). Elite adds brand templates, API access, and a dedicated account manager — for teams and agencies running 50+ clips/month." },
  { q: "Can I cancel anytime?", a: "Yes. Cancel from the dashboard in one click. Your clips stay yours forever. We do not delete them — you can re-download from the archive at any point." },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 02 — HERO
// ════════════════════════════════════════════════════════════════════════════

function HeroSection({ onCtaClick }: { onCtaClick: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // Subtle parallax: background moves at 0.4x of scroll, particle field at 0.6x
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const particleY = useTransform(scrollYProgress, [0, 1], [0, 120]);

  return (
    <section ref={ref} id="section-0" className="section-aurora relative min-h-[100vh] flex items-center overflow-hidden pt-24 pb-20">
      <motion.div style={{ y: bgY }}>
        <PremiumGrid showDots showColumns showCrosshairs showGlyphs />
      </motion.div>
      {/* Premium aurora layer — iridescent wash that makes the hero feel alive */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "var(--gradient-aurora)",
          filter: "blur(80px)",
          opacity: 0.5,
          mixBlendMode: "multiply",
        }}
      />
      <motion.div style={{ y: particleY }}>
        <ParticleField density={0.35} />
      </motion.div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
        {/* Eyebrow — section marker */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-10"
        >
          <span className="text-[11px] font-mono tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            01
          </span>
          <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
          <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Hero
          </span>
        </motion.div>

        {/* Status pill */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="inline-flex items-center gap-2.5 mb-8 px-3.5 py-1.5 rounded-full text-[11px] font-medium"
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
          <span>Now in public beta</span>
          <span style={{ color: "var(--color-text-faint)" }}>·</span>
          <span className="font-mono">Φ = taste, not length</span>
        </motion.div>

        {/* Hero title — mixing display + serif for the designer moment */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display font-semibold max-w-5xl"
          style={{ fontSize: "clamp(2.75rem, 6.5vw, 5.5rem)", lineHeight: 0.98, letterSpacing: "-0.045em" }}
        >
          <span style={{ color: "var(--color-text-primary)" }}>Turn one video into</span>
          <br />
          <span className="font-fraunces-italic text-gradient-soft-pink" style={{ fontSize: "1.1em", fontWeight: 400 }}>
            <TextScramble text="ten viral clips" />
          </span>
          <br />
          <span style={{ color: "var(--color-text-primary)" }}>in&nbsp;</span>
          <span className="font-mono text-gradient-gold" style={{ fontSize: "0.65em", fontStyle: "normal" }}>
            60.0s
          </span>
          <span style={{ color: "var(--color-text-primary)" }}>.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
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
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <MagneticButton onClick={onCtaClick} className="btn-primary btn-shine inline-flex items-center gap-2" strength={0.18} range={80}>
            <span className="relative z-10 flex items-center gap-2">
              <Play className="h-4 w-4" fill="white" />
              Paste a YouTube URL
              <ArrowRight className="h-4 w-4" />
            </span>
          </MagneticButton>

          <Link href="/services" className="btn-glass inline-flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            See the engine
          </Link>
        </motion.div>

        {/* Live metric strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.45 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl"
        >
          {[
            { v: "60s", l: "average clip" },
            { v: "10×", l: "output per video" },
            { v: "0", l: "manual editing" },
            { v: "auto", l: "captions + titles" },
          ].map((m, i) => (
            <motion.div
              key={m.l}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 + i * 0.08 }}
              className="glass-card px-4 py-3 hover-glow"
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

// ════════════════════════════════════════════════════════════════════════════
// SECTION 02.5 — REAL PRODUCT (clipped dashboard preview)
// ════════════════════════════════════════════════════════════════════════════

function RealProductPreview() {
  return (
    <section
      id="section-product"
      className="section-cream relative py-20 md:py-28 overflow-hidden"
    >
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>02.5</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              The real product
            </span>
          </div>
          <h2
            className="font-display font-semibold leading-[1.05]"
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              letterSpacing: "-0.04em",
            }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>This is </span>
            <span className="font-fraunces-italic" style={{ color: "var(--color-accent)", fontWeight: 400 }}>
              the dashboard
            </span>
            <span style={{ color: "var(--color-text-primary)" }}>.</span>
          </h2>
          <p className="mt-4 text-base md:text-lg" style={{ color: "var(--color-text-secondary)" }}>
            Maya Chen is a real clipper on RelatiV. She earned{" "}
            <span className="font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>$1,323</span>{" "}
            last week cutting one Acme podcast. The dashboard is not a mockup.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative max-w-6xl mx-auto"
        >
          {/* Device frame with chromatic aberration shadow */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              boxShadow: "var(--shadow-premium)",
              border: "1px solid rgba(60, 50, 30, 0.12)",
              background: "var(--color-bg-base)",
            }}
          >
            {/* Browser chrome */}
            <div
              className="flex items-center gap-2 px-4 py-3 border-b"
              style={{
                background: "rgba(255, 252, 242, 0.95)",
                borderColor: "rgba(60, 50, 30, 0.08)",
              }}
            >
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FB7185", opacity: 0.7 }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FBBF24", opacity: 0.7 }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#10B981", opacity: 0.7 }} />
              </div>
              <div
                className="flex-1 mx-4 px-3 py-1 rounded-md text-[11px] font-mono"
                style={{
                  background: "rgba(60, 50, 30, 0.05)",
                  color: "var(--color-text-muted)",
                }}
              >
                relativclips.com/clippers/dashboard
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                live
              </span>
              <span
                className="relative flex h-1.5 w-1.5"
              >
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: "#10B981" }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#10B981" }} />
              </span>
            </div>
            {/* Screenshot */}
            <img
              src="/product-clipper-dashboard.png"
              alt="RelatiV clipper dashboard showing Maya Chen's earnings, active campaigns, and recent clips"
              className="block w-full h-auto"
              style={{ display: "block" }}
            />
          </div>

          {/* Floating annotation pills */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="hidden md:flex absolute -left-6 top-1/4 chip-gold"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-gold-500)" }} />
            <span style={{ color: "var(--color-gold-600)" }}>live CPM data</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="hidden md:flex absolute -right-6 bottom-1/4 chip-verified"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-mint-500)" }} />
            <span style={{ color: "var(--color-mint-600)" }}>view-verified</span>
          </motion.div>
        </motion.div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[12px] font-mono stagger-children" style={{ color: "var(--color-text-muted)" }}>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-mint-500)" }} />
            <span>built in Assam, India</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-accent)" }} />
            <span>deployed globally</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-cool-cyan)" }} />
            <span>public beta — sign up to start</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-gold-500)" }} />
            <span>shipped by a small team</span>
          </span>
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 03 — TRUST STRIP (platform marquee)
// ════════════════════════════════════════════════════════════════════════════

function TrustStrip() {
  return (
    <section
      className="section-tint relative py-16 overflow-hidden"
      id="section-1"
      style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="shrink-0 flex items-center gap-3">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>02</span>
            <span className="h-px w-8" style={{ background: "var(--color-border-strong)" }} />
            <p
              className="text-[11px] font-mono uppercase tracking-wider whitespace-nowrap"
              style={{ color: "var(--color-text-muted)" }}
            >
              Built for creators on
            </p>
          </div>

          <div className="flex-1 overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)" }}>
            <div className="flex items-center gap-12 animate-marquee whitespace-nowrap" style={{ width: "max-content" }}>
              {[...PLATFORMS, ...PLATFORMS].map((p, i) => (
                <span
                  key={`${p}-${i}`}
                  className="text-[15px] font-display font-medium tracking-tight"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 04 — INTERACTIVE DEMO
// ════════════════════════════════════════════════════════════════════════════

function DemoSection() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<ProcessState>("idle");
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [80, -80]);

  const STEPS = useMemo(
    () => [
      { label: "Transcribe", sub: "Whisper · RunPod", math: "log P(wₜ|w<t)", pod: "pod-transcribe" as const },
      { label: "Energy peak detect", sub: "librosa · 12 Hz", math: "∇² E(t)", pod: "pod-energy" as const },
      { label: "Hook score", sub: "Claude · emotional peak", math: "argmax Φ(x)", pod: "pod-hook" as const },
      { label: "Render", sub: "YOLO · 9:16 frame", math: "x' = σ(Wx+b)", pod: "pod-render" as const },
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
    <section ref={sectionRef} id="section-2" className="section-gold relative py-32 overflow-hidden">
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
        <div className="mb-16 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[11px] font-mono tracking-wider" style={{ color: "var(--color-text-muted)" }}>03</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Try it</span>
          </div>
          <h2
            className="font-display font-semibold leading-[1.05]"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)", letterSpacing: "-0.04em" }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Paste a URL.</span>
            <br />
            <span className="font-fraunces-italic" style={{ color: "var(--color-accent)", fontWeight: 400 }}>Get ten clips.</span>
          </h2>
          <p className="mt-5 text-lg max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>
            No upload, no editor, no waiting for an export queue. Drop a YouTube link, watch the engine work, download ready-to-publish clips.
          </p>
        </div>

        <div className="glass-panel p-6 md:p-10 hover-glow">
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
                    className="btn-primary btn-shine whitespace-nowrap"
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

              <div className="space-y-2.5">
                {STEPS.map((step, i) => {
                  const isActive = state === "processing" && i === activeStep;
                  const isDone = state === "completed";
                  // Per-step accent color (cyan / orange / pink / gold)
                  const podColor = `var(--pod-${step.pod.replace("pod-", "")})`;
                  const podGlow = `var(--pod-${step.pod.replace("pod-", "")}-glow)`;
                  return (
                    <motion.div
                      key={step.label}
                      className={`relative flex items-center gap-3 p-3.5 pl-4 rounded-2xl overflow-hidden ${step.pod}`}
                      style={{
                        background: isActive
                          ? `linear-gradient(135deg, ${podGlow} 0%, transparent 100%), var(--color-surface)`
                          : isDone
                          ? `linear-gradient(135deg, ${podGlow} 0%, transparent 100%), var(--color-surface)`
                          : "var(--color-surface)",
                        border: isActive
                          ? `1px solid var(--pod-${step.pod.replace("pod-", "")}-border)`
                          : isDone
                          ? `1px solid var(--pod-${step.pod.replace("pod-", "")}-border)`
                          : "1px solid var(--color-border)",
                        boxShadow: isActive
                          ? `0 4px 16px ${podGlow}, 0 0 0 1px var(--pod-${step.pod.replace("pod-", "")}-border) inset`
                          : isDone
                          ? `0 4px 16px ${podGlow}`
                          : "0 1px 2px rgba(0, 0, 0, 0.04)",
                        transform: isActive ? "translateX(2px)" : "translateX(0)",
                      }}
                      animate={isActive ? { scale: [1, 1.012, 1] } : { scale: 1 }}
                      transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
                    >
                      {/* Active step — left accent stripe */}
                      {(isActive || isDone) && (
                        <div
                          aria-hidden
                          className="absolute left-0 top-0 bottom-0 w-[3px]"
                          style={{
                            background: isDone
                              ? `linear-gradient(180deg, ${podColor} 0%, transparent 100%)`
                              : `linear-gradient(180deg, ${podColor} 0%, transparent 100%)`,
                          }}
                        />
                      )}
                      <div
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold"
                        style={{
                          background: isDone
                            ? `linear-gradient(135deg, ${podColor} 0%, ${podColor} 100%)`
                            : isActive
                            ? `linear-gradient(135deg, ${podColor} 0%, ${podColor} 100%)`
                            : "var(--color-surface-2)",
                          color: isDone || isActive ? "#FFFFFF" : "var(--color-text-muted)",
                          boxShadow: isActive || isDone
                            ? `0 4px 12px ${podGlow}, 0 1px 0 rgba(255,255,255,0.20) inset`
                            : "none",
                        }}
                      >
                        {isDone ? "✓" : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>{step.label}</p>
                        <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--color-text-muted)" }}>{step.sub}</p>
                      </div>
                      <code
                        className="text-[10px] font-mono hidden md:block"
                        style={{
                          color: isActive ? podColor : "var(--color-text-muted)",
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
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
                      <Wand2 className="h-6 w-6 text-text-primary" />
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
                          className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-mono font-semibold text-text-primary text-sm"
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

// ════════════════════════════════════════════════════════════════════════════
// SECTION 05 — ENGINE BENTO (4 stages)
// ════════════════════════════════════════════════════════════════════════════

function EngineBento() {
  return (
    <section id="section-3" className="section-mist relative py-32 overflow-hidden">
      <PremiumGrid showDots showColumns={false} showCrosshairs showGlyphs />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="mb-16 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>04</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>The engine</span>
          </div>
          <h2
            className="font-display font-semibold leading-[1.05]"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)", letterSpacing: "-0.04em" }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Four models, one</span>{" "}
            <span className="font-fraunces-italic text-gradient-ocean" style={{ fontWeight: 400 }}>decisive</span>{" "}
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
                className="glass-card physics-magnetic physics-press tile-glow tile-glow-gold p-6 md:p-7 group"
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
                      <Icon className="h-5 w-5 text-text-primary" />
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

// ════════════════════════════════════════════════════════════════════════════
// SECTION 06 — HOW IT WORKS (3 steps)
// ════════════════════════════════════════════════════════════════════════════

function HowItWorksSection() {
  return (
    <section id="section-4" className="section-default relative py-32 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="mb-16 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>05</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>How it works</span>
          </div>
          <h2
            className="font-display font-semibold tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)" }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Three steps. </span>
            <span className="hero-text text-gradient-sunset">One URL.</span>
          </h2>
          <p className="mt-5 text-lg max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>
            No editor, no timeline, no learning curve. The product is the URL bar.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {HOW_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="glass-card physics-magnetic physics-press tile-glow tile-glow-pink p-7 relative overflow-hidden group"
              >
                {/* Large number background */}
                <span
                  className="absolute -top-4 -right-2 font-display font-semibold select-none pointer-events-none"
                  style={{
                    fontSize: "8rem",
                    lineHeight: 1,
                    color: "transparent",
                    background: "linear-gradient(180deg, rgba(60, 50, 30, 0.08) 0%, rgba(60, 50, 30, 0.02) 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                  }}
                >
                  {step.num}
                </span>

                <div className="relative">
                  <div className="flex items-center gap-2 mb-5">
                    <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                      Step {step.num}
                    </span>
                  </div>

                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                    style={{
                      background: "var(--gradient-sunset)",
                      boxShadow: "0 4px 12px rgba(217, 70, 239, 0.20)",
                    }}
                  >
                    <Icon className="h-5 w-5 text-text-primary" />
                  </div>

                  <h3
                    className="font-display font-semibold text-xl mb-3"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed mb-5" style={{ color: "var(--color-text-secondary)" }}>
                    {step.body}
                  </p>

                  {/* Mini artifact preview */}
                  <div
                    className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5"
                    style={{
                      background: "rgba(40, 30, 15, 0.04)",
                      border: "1px solid rgba(60, 50, 30, 0.08)",
                    }}
                  >
                    <span className="text-[10px] font-mono uppercase tracking-wider shrink-0" style={{ color: "var(--color-text-muted)" }}>
                      {step.artifact.label}
                    </span>
                    <code className="text-[11px] font-mono truncate" style={{ color: "var(--color-text-primary)" }}>
                      {step.artifact.value}
                    </code>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 07 — LIVE PRODUCT PREVIEW (animated dashboard mockup)
// ════════════════════════════════════════════════════════════════════════════

function LiveProductPreview() {
  const [progress, setProgress] = useState(0);
  const [transcriptWord, setTranscriptWord] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: false, margin: "-100px" });

  const TRANSCRIPT_WORDS = [
    "The", "thing", "about", "AI", "alignment", "is", "that", "we", "keep", "treating", "it",
    "like", "a", "scaling", "problem", "when", "it's", "actually", "an", "interpretability",
    "problem", "—", "and", "that's", "why", "the", "next", "decade", "of", "research",
    "will", "look", "nothing", "like", "the", "last", "one", "."
  ];

  const STAGES = [
    { until: 30, label: "Transcribing", model: "Whisper large-v3" },
    { until: 55, label: "Scoring moments", model: "Claude Haiku 4.5" },
    { until: 80, label: "Detecting peaks", model: "librosa · 12 Hz" },
    { until: 100, label: "Rendering clips", model: "YOLO v8 · ffmpeg" },
  ];
  const currentStage = STAGES.find((s) => progress < s.until) ?? STAGES[STAGES.length - 1];

  useEffect(() => {
    if (!inView) return;
    setProgress(0);
    setTranscriptWord(0);
    setElapsed(0);

    // Eased progress: fast start, gentle plateau, fast finish (cubic ease-in-out)
    const start = performance.now();
    const duration = 14000; // 14s for full pipeline (feels like real work without being boring)
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeInOutCubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setProgress(eased * 100);
      setElapsed((now - start) / 1000);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Variable-speed transcript typing (slower at start, faster mid, taper at end)
    let wordIdx = 0;
    const typeNext = () => {
      wordIdx = (wordIdx + 1) % TRANSCRIPT_WORDS.length;
      setTranscriptWord(wordIdx);
      const t = wordIdx / TRANSCRIPT_WORDS.length;
      // Faster in the middle (90-150ms), slower at edges
      const delay = 60 + Math.sin(t * Math.PI) * 80;
      setTimeout(typeNext, delay);
    };
    const wordTimer = setTimeout(typeNext, 600);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(wordTimer);
    };
  }, [inView]);

  const MOMENTS = [
    { time: "12.3s", text: "AI alignment is fundamentally about interpretability", score: 0.94, picked: true, appearAt: 5 },
    { time: "45.1s", text: "The next decade of research will look nothing like the last", score: 0.91, picked: true, appearAt: 35 },
    { time: "88.7s", text: "We keep treating alignment like a scaling problem", score: 0.88, picked: true, appearAt: 65 },
    { time: "1:34", text: "RLHF is the training wheels, not the bike", score: 0.76, picked: false, appearAt: 82 },
    { time: "2:12", text: "The interpretability cliff is coming for everyone", score: 0.71, picked: false, appearAt: 90 },
  ];

  // Which moment is currently being scored (highlighted with glow)
  const activeMomentIdx = MOMENTS.findIndex((m, i) => {
    const next = MOMENTS[i + 1];
    return progress >= m.appearAt && (!next || progress < next.appearAt);
  });

  return (
    <section id="section-5" className="section-pink relative py-32 overflow-hidden">
      <ParticleField density={0.15} />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>06</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Live preview</span>
            </div>
            <h2
              className="font-display font-semibold tracking-tight leading-[1.05]"
              style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Watch it </span>
              <span className="hero-text text-gradient-sunset">work</span>
              <span style={{ color: "var(--color-text-primary)" }}>.</span>
            </h2>
            <p
              className="mt-5 text-lg max-w-xl"
              style={{ color: "var(--color-text-secondary)" }}
            >
              The engine is not a black box. Every moment scored, every peak detected, every clip picked — visible in the dashboard as it happens.
            </p>
            <ul className="mt-8 space-y-3 max-w-md">
              {[
                "Word-by-word transcription synced to audio energy",
                "Real-time Φ-score on every candidate moment",
                "Side-by-side A/B/C/D title variants before you commit",
                "Download .mp4 + .srt, or post directly to TikTok / Reels",
              ].map((line, i) => (
                <motion.li
                  key={line}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-3 text-[14px]"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--color-success)" }} />
                  <span>{line}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Right: dashboard mockup */}
          <motion.div
            ref={sectionRef}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-panel overflow-hidden hover-glow"
            style={{ borderRadius: "var(--radius-xl)" }}
          >
            {/* Toolbar */}
            <div
              className="px-5 py-3 flex items-center gap-3"
              style={{ borderBottom: "1px solid rgba(60, 50, 30, 0.08)" }}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FB7185" }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FBBF24" }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#10B981" }} />
              </div>
              <div className="flex-1 flex items-center gap-2 px-3 py-1 rounded-md" style={{ background: "rgba(40, 30, 15, 0.05)" }}>
                <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>app.relativ.com</span>
                <span className="text-[10px] font-mono" style={{ color: "var(--color-text-faint)" }}>/jobs/j-8f4a2c</span>
              </div>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1.5"
                style={{ background: "rgba(16, 185, 129, 0.10)", color: "var(--color-success)" }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: "#10B981" }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#10B981" }} />
                </span>
                live
              </span>
            </div>

            {/* Progress bar — with stage transition */}
            <div className="px-6 pt-5">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentStage.label}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className="text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <span style={{ color: "var(--color-accent)" }}>●</span>{" "}
                      {currentStage.label} · {currentStage.model}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(60, 50, 30, 0.08)" }}>
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: "var(--gradient-sunset)",
                    width: `${progress}%`,
                    boxShadow: "0 0 12px rgba(217, 70, 239, 0.4)",
                  }}
                  transition={{ ease: [0.65, 0, 0.35, 1] }}
                />
                {/* Stage tick marks */}
                {STAGES.slice(0, -1).map((s, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px"
                    style={{
                      left: `${s.until}%`,
                      background: "rgba(60, 50, 30, 0.15)",
                    }}
                  />
                ))}
              </div>
              {/* Live counters strip */}
              <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono" style={{ color: "var(--color-text-faint)" }}>
                <span className="tabular-nums">{Math.round(elapsed * 10) / 10}s elapsed</span>
                <span className="tabular-nums">{(transcriptWord * 32).toLocaleString()} words</span>
                <span className="tabular-nums">47.2 fps</span>
              </div>
            </div>

            {/* Live transcript stream */}
            <div className="px-6 pt-5">
              <p className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                Live transcript
              </p>
              <div
                className="rounded-xl p-4 min-h-[68px]"
                style={{ background: "rgba(40, 30, 15, 0.04)", border: "1px solid rgba(60, 50, 30, 0.06)" }}
              >
                <p className="text-[14px] leading-relaxed font-serif italic" style={{ color: "var(--color-text-secondary)" }}>
                  {TRANSCRIPT_WORDS.slice(0, transcriptWord).join(" ")}
                  <motion.span
                    className="inline-block w-1.5 h-4 ml-0.5 align-middle"
                    style={{ background: "var(--color-accent)" }}
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                  />
                </p>
              </div>
            </div>

            {/* Moments list — staggered reveal + active highlight */}
            <div className="px-6 pt-5 pb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  Moments detected · Φ ≥ 0.70
                </p>
                <p className="text-[10px] font-mono tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                  3 / 47 picked
                </p>
              </div>
              <div className="space-y-1.5">
                {MOMENTS.map((m, i) => {
                  const visible = progress >= m.appearAt;
                  const active = activeMomentIdx === i && progress < 100;
                  return (
                    <motion.div
                      key={m.time}
                      initial={false}
                      animate={{
                        opacity: visible ? 1 : 0.25,
                        x: visible ? 0 : -8,
                        scale: active ? 1.005 : 1,
                      }}
                      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg relative overflow-hidden"
                      style={{
                        background: active
                          ? "rgba(217, 70, 239, 0.10)"
                          : m.picked
                          ? "rgba(217, 70, 239, 0.05)"
                          : "rgba(40, 30, 15, 0.02)",
                        border: active
                          ? "1px solid rgba(217, 70, 239, 0.45)"
                          : m.picked
                          ? "1px solid rgba(217, 70, 239, 0.18)"
                          : "1px solid rgba(60, 50, 30, 0.06)",
                        boxShadow: active ? "0 0 16px rgba(217, 70, 239, 0.15)" : "none",
                      }}
                    >
                      {active && (
                        <motion.div
                          className="absolute inset-0"
                          style={{ background: "linear-gradient(90deg, transparent, rgba(217, 70, 239, 0.08), transparent)" }}
                          initial={{ x: "-100%" }}
                          animate={{ x: "100%" }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                        />
                      )}
                      <span className="text-[10px] font-mono shrink-0 tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                        {m.time}
                      </span>
                      <span className="text-[12px] flex-1 truncate" style={{ color: m.picked ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
                        {m.text}
                      </span>
                      <span
                        className="text-[10px] font-mono font-semibold shrink-0 tabular-nums"
                        style={{ color: m.picked ? "var(--color-accent)" : "var(--color-text-faint)" }}
                      >
                        Φ {m.score.toFixed(2)}
                      </span>
                      {m.picked && (
                        <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 08 — HOOK CURVE (the algorithm visualization)
// ════════════════════════════════════════════════════════════════════════════

function HookCurveSection() {
  return (
    <section id="section-6" className="section-dark relative py-32 overflow-hidden">
      <ParticleField density={0.2} />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>07</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Hook detection</span>
            </div>
            <h2
              className="font-display font-semibold tracking-tight leading-[1.05]"
              style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>We don't guess.</span>
              <br />
              <span className="hero-text text-gradient-sunset">We measure.</span>
            </h2>
            <p className="mt-5 text-lg" style={{ color: "var(--color-text-secondary)" }}>
              Every 250 ms, the engine scores the moment against 4 axes: emotional peak, narrative completeness, shareability, attention spike. Only the top 10 cross the <code className="font-mono text-sm" style={{ color: "var(--color-accent)" }}>Φ = 0.70</code> threshold.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { k: "Emotional peak", v: "0.42" },
                { k: "Narrative", v: "0.31" },
                { k: "Shareability", v: "0.18" },
                { k: "Attention Δ", v: "0.09" },
              ].map((d) => (
                <div key={d.k} className="glass-card px-4 py-3 hover-glow">
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
            className="glass-panel p-8 hover-glow"
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
                <p className="text-2xl font-display font-semibold text-gradient-mint">3 / 7200s</p>
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

// ════════════════════════════════════════════════════════════════════════════
// SECTION 09 — VERTICALS / USE CASES
// ════════════════════════════════════════════════════════════════════════════

function VerticalsSection() {
  return (
    <section id="section-7" className="section-default relative py-32 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="mb-16 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>08</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Use cases</span>
          </div>
          <h2
            className="font-display font-semibold tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)" }}
          >
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
                className="glass-card physics-magnetic physics-press tile-glow tile-glow-cyan p-6 group"
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

// ════════════════════════════════════════════════════════════════════════════
// SECTION 10 — FOR BRANDS
// ════════════════════════════════════════════════════════════════════════════

function ForBrandsSection() {
  return (
    <section id="section-8" className="section-gold relative py-32 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-6">
        <div
          className="glass-panel relative overflow-hidden p-10 md:p-16 hover-glow"
          style={{ borderRadius: "var(--radius-2xl)" }}
        >
          <div
            className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.20) 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.18) 0%, transparent 70%)" }}
          />

          <div className="relative grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>09</span>
                <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
                <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>For brands</span>
              </div>
              <h2
                className="font-display font-semibold tracking-tight leading-[1.05]"
                style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
              >
                <span style={{ color: "var(--color-text-primary)" }}>One brand film.</span>{" "}
                <span className="hero-text text-gradient-ocean">Many cuts.</span>
              </h2>
              <p
                className="mt-5 text-lg max-w-xl"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Turn a single 60-second brand film into 200 paid-media variations — each tuned for a different hook, audience, and platform. Run A/B/C/D title tests before you commit budget.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/brands" className="btn-primary btn-shine inline-flex items-center gap-2">
                  Talk to the team
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/campaigns" className="btn-glass inline-flex items-center gap-2">
                  See campaigns
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { k: "Aspect ratios", v: "9:16 · 1:1 · 16:9", l: "all in one render" },
                { k: "Hook variants", v: "A / B / C / D", l: "test before spending" },
                { k: "Captions", v: "auto", l: "your brand fonts + colors" },
                { k: "Export", v: "MP4 / SRT", l: "drop into any tool" },
              ].map((m, i) => (
                <motion.div
                  key={m.k}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="glass-card hover-glow p-5"
                >
                  <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                    {m.k}
                  </p>
                  <p className="font-display font-semibold text-2xl mt-2 text-gradient-ocean">{m.v}</p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
                    {m.l}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 11 — PRICING
// ════════════════════════════════════════════════════════════════════════════

function PricingSection() {
  return (
    <section id="section-9" className="section-cream relative py-32 overflow-hidden">
      <PremiumGrid showDots showColumns showCrosshairs={false} showGlyphs />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="mb-16 text-center max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>10</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Pricing</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
          </div>
          <h2
            className="font-display font-semibold leading-[1.05]"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)", letterSpacing: "-0.04em" }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Pay per clip, not </span>
            <span className="font-fraunces-italic" style={{ color: "var(--color-accent)", fontWeight: 400 }}>
              per seat
            </span>
            <span style={{ color: "var(--color-text-primary)" }}>.</span>
          </h2>
          <p className="mt-4 text-lg" style={{ color: "var(--color-text-secondary)" }}>
            Start free. Upgrade when you ship. Cancel anytime — your clips stay yours.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {PRICING.map((tier, i) => {
            // Per-tier identity
            const tierClass =
              tier.tier === "Starter" ? "tier-starter"
              : tier.tier === "Pro" ? "tier-pro"
              : "tier-elite";
            const tierColor = `var(--tier-${tier.tier.toLowerCase()})`;
            const tierBg = `var(--tier-${tier.tier.toLowerCase()}-bg)`;
            const tierBorder = `var(--tier-${tier.tier.toLowerCase()}-border)`;
            return (
              <motion.div
                key={tier.tier}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`${tierClass} glass-physics hover-physics p-7 relative overflow-hidden`}
                style={{
                  background: tier.highlight
                    ? `linear-gradient(135deg, ${tierBg} 0%, var(--color-surface) 50%, var(--color-surface) 100%)`
                    : `linear-gradient(160deg, var(--color-surface) 0%, var(--color-surface) 100%)`,
                  border: tier.highlight
                    ? `2px solid ${tierBorder}`
                    : `1px solid ${tierBorder}`,
                  boxShadow: tier.highlight
                    ? `0 0 0 1px ${tierBorder} inset, 0 16px 48px var(--tier-${tier.tier.toLowerCase()}-bg), 0 0 80px var(--tier-${tier.tier.toLowerCase()}-bg)`
                    : `0 4px 16px var(--tier-${tier.tier.toLowerCase()}-bg), 0 0 0 1px ${tierBorder} inset`,
                }}
              >
                {/* Tier accent stripe at top */}
                <div
                  className="absolute -top-px left-0 right-0 h-1"
                  style={{
                    background: tier.highlight
                      ? `linear-gradient(90deg, transparent 0%, ${tierColor} 50%, transparent 100%)`
                      : `linear-gradient(90deg, transparent 0%, ${tierColor} 80%, transparent 100%)`,
                  }}
                />
                {/* Tier name + accent dot */}
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: tierColor, boxShadow: `0 0 8px ${tierColor}` }}
                  />
                  <p className="text-[11px] font-mono uppercase tracking-wider" style={{ color: tierColor }}>
                    {tier.tier}
                  </p>
                </div>
                {tier.highlight && (
                  <div className="absolute top-4 right-4">
                    <span
                      className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        background: `linear-gradient(135deg, ${tierColor} 0%, var(--tier-${tier.tier.toLowerCase()}) 100%)`,
                        color: tier.tier === "Starter" ? "#FFFFFF" : "#1A1814",
                        boxShadow: `0 2px 8px var(--tier-${tier.tier.toLowerCase()}-glow, ${tierBg})`,
                      }}
                    >
                      Most popular
                    </span>
                  </div>
                )}

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span
                    className="font-display font-semibold"
                    style={{ fontSize: "2.75rem", lineHeight: 1, color: "var(--color-text-primary)" }}
                  >
                    {tier.price}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                    {tier.cadence}
                  </span>
                </div>

                <Link
                  href="/signup"
                  className={tier.highlight ? "w-full justify-center mt-6 inline-flex" : "btn-glass w-full justify-center mt-6 inline-flex"}
                  style={
                    tier.highlight
                      ? {
                          background: `linear-gradient(135deg, ${tierColor} 0%, var(--tier-${tier.tier.toLowerCase()}) 100%)`,
                          color: tier.tier === "Starter" ? "#FFFFFF" : "#1A1814",
                          padding: "13px 27px",
                          borderRadius: "var(--radius-full)",
                          fontWeight: 600,
                          fontSize: 15,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          boxShadow: `0 4px 16px var(--tier-${tier.tier.toLowerCase()}-glow, ${tierBg})`,
                        }
                      : undefined
                  }
                >
                  {tier.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>

              <ul className="mt-6 space-y-2.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                    <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: tierColor }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[12px]" style={{ color: "var(--color-text-muted)" }}>
          Need 10+ seats, an API, or a custom brand deal?{" "}
          <Link href="/plans" className="font-semibold" style={{ color: "var(--color-accent)" }}>
            See the full plans →
          </Link>
        </p>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 12 — FAQ (accordion)
// ════════════════════════════════════════════════════════════════════════════

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="section-10" className="section-mist relative py-32 overflow-hidden">
      <div className="relative max-w-4xl mx-auto px-6">
        <div className="mb-16 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>11</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>FAQ</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
          </div>
          <h2
            className="font-display font-semibold tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)" }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Questions, </span>
            <span className="hero-text text-gradient-sunset">answered.</span>
          </h2>
        </div>

        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="glass-card overflow-hidden hover-glow"
                style={{ borderRadius: "var(--radius-lg)" }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span
                    className="text-[15px] font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {item.q}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                    className="shrink-0"
                  >
                    <ChevronDown className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div
                        className="px-6 pb-5 text-[14px] leading-relaxed"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-[13px]" style={{ color: "var(--color-text-muted)" }}>
          Still have questions?{" "}
          <Link href="/contact" className="font-semibold" style={{ color: "var(--color-accent)" }}>
            Talk to the team →
          </Link>
        </p>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 13 — FINAL CTA
// ════════════════════════════════════════════════════════════════════════════

function CtaSection() {
  return (
    <section id="section-11" className="section-dark relative py-32 overflow-hidden">
      <div className="relative max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-panel p-12 md:p-20 text-center relative overflow-hidden hover-glow"
          style={{ borderRadius: "var(--radius-2xl)" }}
        >
          <div
            className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.25) 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.20) 0%, transparent 70%)" }}
          />

          <div className="relative">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>12</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Get started</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            </div>

            <h2
              className="font-display font-semibold leading-[1.02]"
              style={{ fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)", letterSpacing: "-0.04em" }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Stop clipping.</span>{" "}
              <span className="text-gradient-iridescent">Start shipping.</span>
            </h2>
            <p className="mt-6 text-lg max-w-xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
              Paste a YouTube link. Get 10 ready-to-post clips in 5 minutes.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup" className="btn-primary btn-shine inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/services" className="btn-ghost inline-flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Read the engine spec
              </Link>
            </div>

            <div
              className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono"
              style={{ color: "var(--color-text-muted)" }}
            >
              <span className="flex items-center gap-1.5">
                <Check className="h-3 w-3" style={{ color: "var(--color-success)" }} />
                7-day Pro trial
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3 w-3" style={{ color: "var(--color-success)" }} />
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3 w-3" style={{ color: "var(--color-success)" }} />
                Cancel anytime
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════

export default function HomePage() {
  const scrollToDemo = useCallback(() => {
    document.getElementById("try-it")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <>
      <HeroSection onCtaClick={scrollToDemo} />
      <RealProductPreview />
      <TrustStrip />
      <DemoSection />
      <EngineBento />
      <HowItWorksSection />
      <LiveProductPreview />
      <HookCurveSection />
      <VerticalsSection />
      <ForBrandsSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
