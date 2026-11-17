"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  UploadCloud,
  ArrowUpRight,
  Link2,
  CheckCircle2,
} from "lucide-react";
import { uploadVideoFile } from "@/lib/api";
import AnimatedHeadlinePill from "./AnimatedHeadlinePill";
import HeroDataNetwork from "./HeroDataNetwork";
import SickLoadingTransition from "./SickLoadingTransition";

// ── 5 Visually Rich Long-Form Video Cards (Left Zone — Staggered In-Out Hierarchy) ──
const SOURCE_CARDS = [
  {
    id: "src-1",
    img: "/thumb_l1.webp",
    title: "How I Spent 24 Hours in the World's Most Expensive Jet",
    creator: "MrBeast",
    top: "8%",
    left: "45px",
    width: "215px",
    delay: 0,
    sampleUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    id: "src-2",
    img: "/thumb_l2.webp",
    title: "How to Become Mentally Dangerous & Win Any Debate",
    creator: "Modern Wisdom",
    top: "24%",
    left: "115px",
    width: "210px",
    delay: 0.2,
    sampleUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    id: "src-3",
    img: "/thumb_l3.webp",
    title: "Raw & Real Talk with Aarush & Laila (Episode 42)",
    creator: "Creator Studio",
    top: "42%",
    left: "45px",
    width: "215px",
    delay: 0.4,
    sampleUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    id: "src-4",
    img: "/thumb_l4.webp",
    title: "SPEED ESCAPES THE SCARIEST LABYRINTH IN HISTORY",
    creator: "IShowSpeed",
    top: "59%",
    left: "120px",
    width: "210px",
    delay: 0.6,
    sampleUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    id: "src-5",
    img: "/thumb_l5.webp",
    title: "Building a $10M Tech Company from an In-N-Out Parking Lot",
    creator: "Founder Daily",
    top: "75%",
    left: "50px",
    width: "215px",
    delay: 0.8,
    sampleUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
];

// ── 5 Portrait 9:16 Short-Form Clips (Right Zone — Explicit Floating Cascade) ──
const OUTPUT_CLIPS = [
  {
    id: "out-1",
    img: "/thumb_r1.webp",
    caption: "HOW I'M WINNING THE TITLE",
    x: 190,
    y: 0,
    zIndex: 10,
    isActive: false,
    delay: 0.1,
  },
  {
    id: "out-2",
    img: "/thumb_r2.webp",
    caption: "I GENUINELY BELIEVE",
    x: 20,
    y: 105,
    zIndex: 25,
    isActive: true, // Subtle active card highlight (no giant capsule)
    delay: 0.3,
  },
  {
    id: "out-3",
    img: "/thumb_r3.webp",
    caption: "RAW IS A TRUE FEMINIST",
    x: 190,
    y: 210,
    zIndex: 15,
    isActive: false,
    delay: 0.5,
  },
  {
    id: "out-4",
    img: "/thumb_r4.webp",
    caption: "IShowSpeed PROVES HE'S STRONG",
    x: 35,
    y: 315,
    zIndex: 12,
    isActive: false,
    delay: 0.7,
  },
  {
    id: "out-5",
    img: "/thumb_r5.webp",
    caption: "WARDROBE SHOWS OFF HIS STUNT ACTING SKILLS",
    x: 180,
    y: 420,
    zIndex: 10,
    isActive: false,
    delay: 0.9,
  },
];

export default function HeroStudio() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Coordinated Transformation Timeline ──
  const [activeSourceIndex, setActiveSourceIndex] = useState<number>(0);
  const [pulsePhase, setPulsePhase] = useState<"idle" | "extracting" | "processing" | "distributing">("extracting");

  useEffect(() => {
    let isMounted = true;
    let sourceIdx = 0;
    let timeouts: NodeJS.Timeout[] = [];

    const runCycle = () => {
      if (!isMounted) return;

      // Step 1: Active Source Activation
      setActiveSourceIndex(sourceIdx);
      setPulsePhase("idle");

      // Step 2: Extracting data stream from source
      timeouts.push(
        setTimeout(() => {
          if (!isMounted) return;
          setPulsePhase("extracting");
        }, 1000)
      );

      // Step 3: Central AI Processing Core
      timeouts.push(
        setTimeout(() => {
          if (!isMounted) return;
          setPulsePhase("processing");
        }, 3200)
      );

      // Step 4: Distribute to generated short-form clips
      timeouts.push(
        setTimeout(() => {
          if (!isMounted) return;
          setPulsePhase("distributing");
        }, 5000)
      );

      // Step 5: Loop to next source video (7.8s cycle)
      timeouts.push(
        setTimeout(() => {
          if (!isMounted) return;
          sourceIdx = (sourceIdx + 1) % SOURCE_CARDS.length;
          runCycle();
        }, 7800)
      );
    };

    runCycle();

    return () => {
      isMounted = false;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setIsSubmitting(true);
  };

  const handleSampleClick = (sampleUrl: string) => {
    setUrl(sampleUrl);
    setIsSubmitting(true);
  };

  const processFile = async (file: File) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { taskId } = await uploadVideoFile(file);
      router.push(`/process?taskId=${taskId}`);
    } catch {
      setError("Upload failed. Try pasting a YouTube link instead.");
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <section className="relative w-full min-h-[740px] lg:min-h-[770px] flex flex-col items-center justify-start overflow-hidden bg-black text-white pt-20 sm:pt-24 pb-12 lg:pb-16">
      {/* ── Background Pure Deep Black Grid ── */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* ── CINEMATIC AI DATA NETWORK (Electric Blue/Violet Streams & Glyphs) ── */}
      <HeroDataNetwork
        activeSourceIndex={activeSourceIndex}
        pulsePhase={pulsePhase}
      />

      {/* ── LEFT ZONE: 5 Large Landscape Video Thumbnails (Floating Creator Frames) ── */}
      <div className="hidden xl:block absolute inset-y-0 left-0 w-[38%] pointer-events-none z-10">
        {SOURCE_CARDS.map((card, idx) => {
          const isActive = idx === activeSourceIndex;

          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, x: -50 }}
              animate={{
                opacity: 1,
                x: isActive ? [0, 18, 8] : [0, 10, 0],
                y: [0, -5, 0],
                scale: isActive ? 1.03 : 1,
              }}
              whileHover={{ scale: 1.04, y: -4 }}
              transition={{
                x: { duration: 6 + idx * 0.4, repeat: Infinity, ease: "easeInOut", delay: card.delay },
                y: { duration: 4.5 + idx * 0.5, repeat: Infinity, ease: "easeInOut", delay: card.delay },
                scale: { type: "spring", stiffness: 350, damping: 25 },
                opacity: { duration: 0.7, delay: card.delay },
              }}
              className="absolute pointer-events-auto cursor-pointer group"
              style={{ top: card.top, left: card.left, width: card.width }}
              onClick={() => handleSampleClick(card.sampleUrl)}
            >
              {/* Clean Floating Video Frame with subtle rounded corners & deep shadow */}
              <div
                className={`relative rounded-xl overflow-hidden shadow-[0_18px_40px_rgba(0,0,0,0.9)] transition-all duration-500 border ${
                  isActive
                    ? "border-cyan-400 shadow-[0_0_28px_rgba(0,200,255,0.45)] ring-1 ring-cyan-400/60"
                    : "border-white/10 group-hover:border-cyan-400/50 group-hover:shadow-[0_0_20px_rgba(0,200,255,0.22)]"
                }`}
              >
                <img
                  src={card.img}
                  alt={card.title}
                  className="w-full aspect-video object-cover block select-none transition-transform duration-300 group-hover:scale-105"
                />

                {/* Active scan-line sweep */}
                {isActive && (
                  <motion.div
                    initial={{ left: "-20%" }}
                    animate={{ left: "120%" }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none z-20"
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── RIGHT ZONE: 5 Independent Floating 9:16 Short-Form Clips (Explicit Positions) ── */}
      <div className="hidden xl:block absolute right-8 2xl:right-16 top-1/2 -translate-y-1/2 w-[310px] h-[630px] pointer-events-none z-10">
        {OUTPUT_CLIPS.map((clip, idx) => {
          const isActive = clip.isActive;

          return (
            <motion.div
              key={clip.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{
                opacity: 1,
                y: [0, -4, 0],
              }}
              whileHover={{ scale: 1.05, y: -4 }}
              transition={{
                y: {
                  duration: 5 + idx * 0.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: clip.delay,
                },
                scale: { type: "spring", stiffness: 350, damping: 25 },
                opacity: { duration: 0.6, delay: clip.delay },
              }}
              className="absolute pointer-events-auto cursor-pointer group"
              style={{
                top: `${clip.y}px`,
                left: `${clip.x}px`,
                width: "104px",
                zIndex: clip.zIndex,
              }}
            >
              {/* True 9:16 Independent Vertical Card */}
              <div
                className={`relative w-full aspect-[9/16] rounded-xl overflow-hidden transition-all duration-300 ${
                  isActive
                    ? "border border-amber-400/60 shadow-[0_10px_25px_rgba(0,0,0,0.85),0_0_12px_rgba(251,191,36,0.16)]"
                    : "border border-white/10 shadow-[0_10px_20px_rgba(0,0,0,0.8)] group-hover:border-white/25"
                }`}
              >
                <img
                  src={clip.img}
                  alt={clip.caption}
                  className="w-full h-full object-cover block select-none transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── CENTER ZONE: Focused, Clean, Highly Legible Product Core ── */}
      <div className="relative z-20 w-full max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center">
        {/* Eyebrow Badge (Clean & Subtle as in Reference) */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider border border-white/10 bg-white/[0.03] backdrop-blur-md text-zinc-400 mb-4"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>#1 AI VIDEO EDITOR AND CLIPPING TOOL</span>
        </motion.div>

        {/* Master Headline: Large, Bold, Stationary */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="font-display font-bold tracking-tight text-white text-center w-full select-none"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] leading-tight">
            Turn any footage into
          </h1>

          {/* Locked-height non-wrapping Line 2 */}
          <div className="h-[46px] sm:h-[60px] lg:h-[70px] flex items-center justify-center flex-nowrap gap-2 sm:gap-3 text-2xl sm:text-3xl md:text-4xl lg:text-[50px] leading-none mt-1 sm:mt-2">
            <AnimatedHeadlinePill />
            <span className="shrink-0 whitespace-nowrap text-white font-extrabold tracking-tight">
              10x faster
            </span>
          </div>
        </motion.div>

        {/* Supporting Description */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 text-sm sm:text-[15px] text-zinc-400 max-w-lg mx-auto leading-relaxed"
        >
          Paste a link or drop a raw take, and RelatiV clips, edits, sizes and
          publishes them to all social platforms in one click.
        </motion.p>

        {/* ── CINEMATIC DUAL-GLOW SEARCH/UPLOAD PANEL (Two-Level Glass Workspace) ── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="mt-7 w-full max-w-[680px] lg:max-w-[720px] mx-auto relative"
        >
          {/* ── AMBIENT OPTICAL GLOWS (Slow 8-9s subtle drift matching Reference Image 2) ── */}
          {/* Left Warm Orange/Red Glow */}
          <motion.div
            animate={{
              x: [0, 5, 0],
              y: [0, -3, 0],
              opacity: [0.55, 0.72, 0.55],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -left-12 -top-10 w-[340px] h-[220px] rounded-full pointer-events-none blur-[48px] select-none"
            style={{
              background:
                "radial-gradient(ellipse at 30% 35%, rgba(255, 99, 63, 0.65) 0%, rgba(255, 140, 90, 0.35) 45%, transparent 75%)",
            }}
          />

          {/* Right Electric-Blue Glow */}
          <motion.div
            animate={{
              x: [0, -5, 0],
              y: [0, 3, 0],
              opacity: [0.55, 0.74, 0.55],
            }}
            transition={{
              duration: 9,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -right-12 -top-10 w-[340px] h-[220px] rounded-full pointer-events-none blur-[48px] select-none"
            style={{
              background:
                "radial-gradient(ellipse at 70% 35%, rgba(52, 120, 255, 0.65) 0%, rgba(71, 125, 255, 0.35) 45%, transparent 75%)",
            }}
          />

          {/* Faint Digital Micro-Detail Characters Behind Glass */}
          <div className="absolute -inset-x-4 -top-3 h-12 flex justify-between items-center px-6 overflow-hidden pointer-events-none select-none opacity-[0.16] font-mono text-[9.5px] tracking-[0.25em]">
            <span className="text-[#FF8655]">01101 + o O 01 HON</span>
            <span className="text-[#477DFF] hidden sm:inline">10010 x + o 10 NH</span>
          </div>

          {/* ── THE TWO-LEVEL GLASS CONTAINER (Subtle Graphite-Blue Smoked Physical Glass) ── */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`group/panel relative rounded-[28px] p-[1px] transition-all duration-300 ${
              isDragging ? "ring-2 ring-cyan-400" : ""
            }`}
            style={{
              background:
                "linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.08) 32%, rgba(255, 255, 255, 0.03) 100%)",
              boxShadow:
                "0 24px 60px -12px rgba(0, 0, 0, 0.85), 0 10px 24px -6px rgba(0, 0, 0, 0.6)",
            }}
          >
            {/* Inner Glass Surface: Genuine Translucent Smoked Glass */}
            <div
              className="relative rounded-[27px] overflow-hidden transition-colors"
              style={{
                background:
                  "linear-gradient(180deg, rgba(30, 39, 54, 0.46) 0%, rgba(18, 24, 34, 0.50) 50%, rgba(11, 15, 22, 0.56) 100%)",
                backdropFilter: "blur(14px) saturate(120%)",
                WebkitBackdropFilter: "blur(14px) saturate(120%)",
                boxShadow:
                  "inset 0 1px 1px 0 rgba(255, 255, 255, 0.24), inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.05)",
              }}
            >
              {/* Drag & Drop Visual Overlay */}
              {isDragging && (
                <div className="absolute inset-0 z-30 flex items-center justify-center rounded-[27px] bg-[#0c1018]/90 backdrop-blur-md border border-cyan-400/60 text-cyan-200 font-semibold text-sm shadow-[inset_0_0_20px_rgba(6,182,212,0.15)]">
                  <UploadCloud className="w-5 h-5 mr-2 animate-bounce text-cyan-400" />
                  Drop video file here to extract clips
                </div>
              )}

              {/* Main Two-Level Form */}
              <form onSubmit={handleSubmit} className="flex flex-col text-left">
                {/* AREA A — PRIMARY URL INPUT (Upper Level) */}
                <div className="flex items-center gap-3 px-5 sm:px-6 pt-4 pb-2.5">
                  <Link2 className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste a YouTube, Zoom, or Drive link..."
                    style={{ outline: "none", boxShadow: "none" }}
                    className="w-full bg-transparent text-sm sm:text-[15px] font-normal text-white placeholder:text-zinc-500 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 border-none"
                  />
                  {url && (
                    <button
                      type="button"
                      onClick={() => setUrl("")}
                      className="text-zinc-400 hover:text-white p-1 text-xs shrink-0 transition-colors cursor-pointer"
                      title="Clear input"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* AREA B — SECONDARY ACTION ROW (Bottom Level) */}
                <div className="flex items-center justify-between px-5 sm:px-6 pb-3.5 pt-2 border-t border-white/[0.06] shadow-[0_1px_0_0_rgba(0,0,0,0.35)]">
                  {/* Left: Compact Upload video control (Raised Glass Bevel) */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs text-zinc-200 hover:text-white transition-all duration-200 font-medium group/upload cursor-pointer active:scale-95 hover:border-white/30"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.04) 100%)",
                      backgroundColor: "rgba(32, 42, 60, 0.45)",
                      backdropFilter: "blur(8px) saturate(115%)",
                      WebkitBackdropFilter: "blur(8px) saturate(115%)",
                      border: "1px solid rgba(255, 255, 255, 0.20)",
                      boxShadow:
                        "inset 0 1px 1px 0 rgba(255, 255, 255, 0.35), inset 0 -1px 1.5px 0 rgba(0, 0, 0, 0.4), 0 3px 8px -1px rgba(0, 0, 0, 0.45)",
                    }}
                    title="Upload video file from computer"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-zinc-300 group-hover/upload:text-white transition-colors" />
                    <span>Upload video</span>
                  </button>

                  {/* Right: Primary CTA "Get clips" (Polished Reflective Glass Finish) */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 group/cta cursor-pointer text-white hover:border-white/70"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255, 255, 255, 0.38) 0%, rgba(255, 255, 255, 0.16) 50%, rgba(255, 255, 255, 0.08) 100%)",
                      backgroundColor: "rgba(42, 54, 76, 0.58)",
                      backdropFilter: "blur(12px) saturate(120%)",
                      WebkitBackdropFilter: "blur(12px) saturate(120%)",
                      border: "1px solid rgba(255, 255, 255, 0.52)",
                      boxShadow:
                        "inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.92), inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.45), 0 4px 18px -2px rgba(0, 0, 0, 0.5), 0 1px 3px 0 rgba(0, 0, 0, 0.3)",
                      textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
                    }}
                    title="Get clips"
                  >
                    <span>{isSubmitting ? "Processing..." : "Get clips"}</span>
                    <ArrowUpRight className="w-4 h-4 text-white group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 transition-transform duration-200" />
                  </button>
                </div>
              </form>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {error && (
            <p className="mt-2 text-xs text-rose-400 font-mono text-center">
              {error}
            </p>
          )}

          {/* ── SAMPLE PROJECT LINKS (Clean Horizontally Centered Row) ── */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 text-xs text-zinc-400">
            <span className="text-[11px] text-zinc-500 font-mono">Try sample:</span>
            <button
              type="button"
              onClick={() => handleSampleClick("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}
              className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 hover:border-white/25 hover:text-white text-zinc-300 text-[11px] transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            >
              🎙️ Huberman Lab
            </button>
            <button
              type="button"
              onClick={() => handleSampleClick("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}
              className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 hover:border-white/25 hover:text-white text-zinc-300 text-[11px] transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            >
              🥊 Joe Rogan
            </button>
            <button
              type="button"
              onClick={() => handleSampleClick("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}
              className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 hover:border-white/25 hover:text-white text-zinc-300 text-[11px] transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            >
              💻 Tech Review
            </button>
          </div>

          {/* ── TRUST INDICATORS (Single Horizontal Centered Row on Desktop) ── */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5 sm:gap-8 text-[11px] text-zinc-400 font-mono">
            <div className="flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>60 mins free / month</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Auto 9:16 + subtitles</span>
            </div>
          </div>
        </motion.div>

        {/* ── MOBILE ADAPTIVE PREVIEW ── */}
        <div className="block xl:hidden mt-10 w-full max-w-sm mx-auto">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-3 text-left">
            <div className="w-[45%]">
              <img
                src="/thumb_l1.jpg"
                alt="16:9 Long-Form"
                className="w-full aspect-video rounded object-cover"
              />
              <p className="mt-1 text-[10px] font-mono text-zinc-400 truncate">16:9 Long-Form</p>
            </div>
            <span className="text-cyan-400 font-bold text-xs">→ AI →</span>
            <div className="w-[45%]">
              <img
                src="/thumb_r1.jpg"
                alt="9:16 Viral Clip"
                className="w-full aspect-video rounded object-cover"
              />
              <p className="mt-1 text-[10px] font-mono text-amber-300 truncate">9:16 Viral Clip</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SICK LOADING TRANSITION OVERLAY ── */}
      {isSubmitting && url && (
        <SickLoadingTransition
          url={url}
          autoRedirect={true}
        />
      )}
    </section>
  );
}
