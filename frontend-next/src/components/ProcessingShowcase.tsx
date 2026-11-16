"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
  Layers,
  Crop,
  Type,
  Share2,
} from "lucide-react";

interface Phase {
  id: string;
  label: string;
  time: number;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  badge: string;
  desc: string;
}

const PHASES: Phase[] = [
  {
    id: "segmentation",
    label: "Segmentation",
    time: 0,
    icon: Layers,
    tag: "0:00",
    badge: "16:9 INTAKE",
    desc: "AI scans the complete timeline, identifying high-signal candidate clips from hours of footage.",
  },
  {
    id: "reframing",
    label: "AI Reframing",
    time: 6,
    icon: Crop,
    tag: "0:06",
    badge: "9:16 TRACKING",
    desc: "Subject & speaker detection dynamically crops wide shots into stacked split-screen or action-centered framing.",
  },
  {
    id: "subtitles",
    label: "Dynamic Captions",
    time: 18,
    icon: Type,
    tag: "0:18",
    badge: "KARAOKE ENGINE",
    desc: "Word-level synchronized subtitles with high-contrast animated highlights hold viewer retention.",
  },
  {
    id: "moments",
    label: "Peak Detection",
    time: 27,
    icon: Sparkles,
    tag: "0:27",
    badge: "VIRAL SCORING",
    desc: "Detects emotional inflection points, humor, and conversational hooks to maximize algorithm lift.",
  },
  {
    id: "publishing",
    label: "Multi-Platform Export",
    time: 43,
    icon: Share2,
    tag: "0:43",
    badge: "1-CLICK PUBLISH",
    desc: "Delivers full 1080p HD vertical outputs sized and ready for YouTube Shorts, Instagram Reels, and TikTok.",
  },
];

export default function ProcessingShowcase() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(48);
  const [isMuted, setIsMuted] = useState(true);
  const [activePhaseIndex, setActivePhaseIndex] = useState(0);

  // Time formatting helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Sync state with video element
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    // Determine current phase
    let idx = 0;
    for (let i = PHASES.length - 1; i >= 0; i--) {
      if (cur >= PHASES[i].time - 0.5) {
        idx = i;
        break;
      }
    }
    setActivePhaseIndex(idx);
  }, []);

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration) {
      setDuration(videoRef.current.duration);
    }
  };

  // Play / Pause toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Seek to specific time or phase
  const seekTo = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    setCurrentTime(seconds);
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Restart from beginning
  const restart = () => {
    seekTo(0);
  };

  // Toggle mute
  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Autoplay when entering viewport (muted)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && videoRef.current) {
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
          } else if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const activePhase = PHASES[activePhaseIndex];

  return (
    <div id="processing-showcase" className="w-full space-y-6">
      {/* ── Main Elevated Widescreen Stage ── */}
      <div
        ref={containerRef}
        className="relative rounded-2xl sm:rounded-3xl border border-white/10 bg-[#07090e] shadow-[0_30px_90px_rgba(0,0,0,0.95)] overflow-hidden group"
      >
        {/* Subtle Ambient Backlight Dispersion */}
        <div
          className="absolute -inset-1 rounded-3xl pointer-events-none opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(56, 189, 248, 0.25) 0%, rgba(139, 92, 246, 0.2) 40%, rgba(245, 158, 11, 0.15) 70%, transparent 100%)",
          }}
        />

        {/* Ambient Top Light Beam */}
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none z-20"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(56, 189, 248, 0.5) 35%, rgba(139, 92, 246, 0.5) 65%, transparent 100%)",
          }}
        />

        {/* Top Status Bar & Phase Navigator Pills */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-black/60 backdrop-blur-md border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-xs font-semibold tracking-wider text-white">
              AI TRANSFORMATION ENGINE
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono text-zinc-400">
              {activePhase.badge}
            </span>
          </div>

          {/* Interactive Phase Navigation Pills */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
            {PHASES.map((phase, idx) => {
              const isActive = activePhaseIndex === idx;
              return (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => seekTo(phase.time)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-white text-black shadow-md shadow-white/20 font-semibold scale-[1.02]"
                      : "bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.06]"
                  }`}
                >
                  <phase.icon className={`w-3.5 h-3.5 ${isActive ? "text-black" : "text-cyan-400"}`} />
                  <span>{phase.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 16:9 Cinematic Video Display ── */}
        <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            src="/progress.mp4"
            playsInline
            muted={isMuted}
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlay}
            className="w-full h-full object-contain cursor-pointer"
          />

          {/* Frosted Play/Pause Overlay Button (visible on hover or when paused) */}
          {(!isPlaying || currentTime === 0) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/30 flex items-center justify-center transition-all shadow-2xl hover:scale-105 active:scale-95 cursor-pointer z-10"
              onClick={togglePlay}
            >
              <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1 fill-white" />
            </motion.div>
          )}

          {/* Current Phase Lower-Third Badge */}
          <div className="absolute bottom-16 sm:bottom-20 left-4 sm:left-6 z-10 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/15 text-xs text-zinc-200 shadow-xl">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="font-semibold text-white">{activePhase.label}:</span>
              <span className="text-zinc-400 max-w-xs sm:max-w-md truncate">{activePhase.desc}</span>
            </div>
          </div>
        </div>

        {/* ── Custom Playback Controls Bar ── */}
        <div className="relative z-20 px-4 sm:px-6 py-3.5 bg-black/75 backdrop-blur-xl border-t border-white/[0.08] flex flex-col gap-2.5">
          {/* Timeline Scrubber */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-zinc-400 w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 48}
              step="0.1"
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
            />
            <span className="font-mono text-xs text-zinc-500 w-10">
              {formatTime(duration)}
            </span>
          </div>

          {/* Bottom Actions Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-black" />
                ) : (
                  <Play className="w-4 h-4 fill-black ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={restart}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/15 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
                title="Restart demonstration"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/15 text-zinc-300 hover:text-white text-xs font-medium transition-all cursor-pointer border border-white/10"
                title={isMuted ? "Unmute audio" : "Mute audio"}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-amber-300" />
                    <span>Unmute</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Mute</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs font-sans text-zinc-500">
                Click any phase to jump directly
              </span>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/15 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
                title="Toggle fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stage Phase Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="rounded-2xl border border-white/10 bg-[#090b11]/80 p-5 space-y-2 backdrop-blur-md">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-semibold">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>01 · SOURCE INGESTION</span>
          </div>
          <h4 className="font-display font-semibold text-white text-sm sm:text-base">
            Long-Form Candidate Detection
          </h4>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            Scans audio waveforms and transcription boundaries to find where compelling hooks and self-contained arguments begin and end.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#090b11]/80 p-5 space-y-2 backdrop-blur-md">
          <div className="flex items-center gap-2 text-violet-400 text-xs font-mono font-semibold">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span>02 · INTELLIGENT REFRAMING</span>
          </div>
          <h4 className="font-display font-semibold text-white text-sm sm:text-base">
            Dynamic Speaker Centering
          </h4>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            Converts 16:9 landscape footage into stacked split-screen podcasts or action-tracked 9:16 vertical video without losing context.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#090b11]/80 p-5 space-y-2 backdrop-blur-md">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-mono font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>03 · MULTI-PLATFORM OUTPUT</span>
          </div>
          <h4 className="font-display font-semibold text-white text-sm sm:text-base">
            Viral Polish & 1-Click Publishing
          </h4>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            Burns word-level animated subtitles, evaluates hook scores, and delivers 1080p clips ready for YouTube Shorts, TikTok, and Reels.
          </p>
        </div>
      </div>
    </div>
  );
}
