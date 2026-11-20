"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Check,
  Mic,
  Gamepad2,
  Tv,
  GraduationCap,
  Layers,
  Share2,
  Zap,
  Play,
  Film,
  Video,
} from "lucide-react";
import Link from "next/link";
import { YoutubeIcon, TiktokIcon, InstagramIcon } from "@/components/dashboard/SocialAccountsView";

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Selections
  const [archetype, setArchetype] = useState<string>("podcast");
  const [captionStyle, setCaptionStyle] = useState<string>("kinetic");
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [selectedSocials, setSelectedSocials] = useState<string[]>(["youtube", "tiktok"]);

  const ARCHETYPES = [
    {
      id: "podcast",
      title: "Podcast & Interviews",
      desc: "Turn-taking dialogue, thoughtful insights, complete narrative statements",
      icon: Mic,
      color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400",
      pill: "High Retention",
    },
    {
      id: "streamer",
      title: "Streamer & Reactions",
      desc: "Facecam reactions, high decibel spikes, laughter, chat callouts",
      icon: Tv,
      color: "from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400",
      pill: "Viral TikTok",
    },
    {
      id: "gaming",
      title: "Gaming Clutches",
      desc: "Rapid gameplay highlights, clutch kills, hype team comms",
      icon: Gamepad2,
      color: "from-amber-500/20 to-red-500/20 border-amber-500/30 text-amber-400",
      pill: "Fast Paced",
    },
    {
      id: "educational",
      title: "Educational & Talks",
      desc: "How-to steps, clear explanations, visual analogies, tutorial flow",
      icon: GraduationCap,
      color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400",
      pill: "High Saves",
    },
  ];

  const CAPTION_STYLES = [
    {
      id: "kinetic",
      name: "Kinetic Punch",
      preview: "THIS CHANGED EVERYTHING",
      styleClass: "font-black uppercase text-amber-300 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]",
      desc: "High-contrast bold font with pop animations for maximum hook",
    },
    {
      id: "editorial",
      name: "Editorial Serif",
      preview: "The quiet truth about discipline.",
      styleClass: "font-serif italic text-white drop-shadow-md",
      desc: "Sleek, sophisticated Vogue typography for founders and thinkers",
    },
    {
      id: "neon",
      name: "Cyber Neon",
      preview: "NEXT LEVEL OUTPUT",
      styleClass: "font-sans font-black bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent",
      desc: "Glowing gradient neon for aesthetic reels and tech shorts",
    },
    {
      id: "karaoke",
      name: "Word-by-Word",
      preview: "Watch every single word pop",
      styleClass: "font-sans font-extrabold text-cyan-300",
      desc: "Real-time subtitle highlighting synchronized to speech rhythm",
    },
  ];

  const handleFinish = () => {
    if (youtubeUrl.trim()) {
      router.push(`/dashboard?url=${encodeURIComponent(youtubeUrl.trim())}`);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-[#07080B] text-white flex flex-col justify-between selection:bg-cyan-400 selection:text-black">
      {/* Top Bar */}
      <header className="h-16 border-b border-white/10 px-6 sm:px-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center text-black font-black text-sm">
            R
          </span>
          <span className="font-bold text-white tracking-tight">RelatiV</span>
        </Link>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? "w-8 bg-cyan-400"
                  : s < step
                  ? "w-4 bg-emerald-400"
                  : "w-4 bg-white/10"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Main Form Center */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* ── STEP 1: ARCHETYPE SELECTION ── */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8"
            >
              <div className="space-y-2 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                  Step 1 of 3
                </span>
                <h1 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">
                  What kind of content do you make?
                </h1>
                <p className="text-sm text-zinc-400 max-w-md mx-auto">
                  RelatiV tunes its virality scoring, reframe model, and pacing to your exact niche.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ARCHETYPES.map((arch) => {
                  const Icon = arch.icon;
                  const isSelected = archetype === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => setArchetype(arch.id)}
                      className={`p-5 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden flex flex-col justify-between space-y-3 cursor-pointer ${
                        isSelected
                          ? `bg-gradient-to-br ${arch.color} shadow-lg ring-1 ring-cyan-400/50`
                          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                          {arch.pill}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-base text-white">{arch.title}</h3>
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          {arch.desc}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-xs bg-white text-black hover:bg-zinc-200 transition shadow-sm cursor-pointer"
                >
                  <span>Continue to Styling</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: STYLING & SUBTITLES ── */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8"
            >
              <div className="space-y-2 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
                  Step 2 of 3
                </span>
                <h1 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">
                  Choose your signature caption style
                </h1>
                <p className="text-sm text-zinc-400 max-w-md mx-auto">
                  Every short-form clip will automatically be stamped with high-retention animated subtitles.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CAPTION_STYLES.map((cap) => {
                  const isSelected = captionStyle === cap.id;
                  return (
                    <button
                      key={cap.id}
                      type="button"
                      onClick={() => setCaptionStyle(cap.id)}
                      className={`p-5 rounded-2xl border text-left transition-all duration-200 relative flex flex-col justify-between space-y-4 cursor-pointer ${
                        isSelected
                          ? "border-cyan-400/60 bg-cyan-500/10 shadow-lg ring-1 ring-cyan-400/40"
                          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                      }`}
                    >
                      {/* Subtitle Preview Box */}
                      <div className="h-20 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center p-3 text-center">
                        <span className={cap.styleClass}>{cap.preview}</span>
                      </div>

                      <div>
                        <h3 className="font-bold text-sm text-white">{cap.name}</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">{cap.desc}</p>
                      </div>

                      {isSelected && (
                        <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  ← Back
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-xs bg-white text-black hover:bg-zinc-200 transition shadow-sm cursor-pointer"
                >
                  <span>Continue to Launch</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: INSTANT FIRST VIDEO OR LAUNCH ── */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8"
            >
              <div className="space-y-2 text-center">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                  Step 3 of 3
                </span>
                <h1 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">
                  Ready to generate your first viral clip?
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                  Paste a YouTube video link now to start auto-clipping, or head straight into your Creative Studio.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-6 space-y-5 shadow-xl">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Paste YouTube Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Connect Channels
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] flex items-center gap-2 text-xs text-white">
                      <div className="w-5 h-5 rounded bg-red-600 flex items-center justify-center text-white shrink-0">
                        <YoutubeIcon className="w-3 h-3" />
                      </div>
                      <span className="font-medium text-xs truncate">YouTube</span>
                    </div>

                    <div className="p-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] flex items-center gap-2 text-xs text-white">
                      <div className="w-5 h-5 rounded bg-zinc-900 border border-white/20 flex items-center justify-center text-white shrink-0">
                        <TiktokIcon className="w-3 h-3" />
                      </div>
                      <span className="font-medium text-xs truncate">TikTok</span>
                    </div>

                    <div className="p-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] flex items-center gap-2 text-xs text-white">
                      <div className="w-5 h-5 rounded bg-zinc-800 border border-white/20 flex items-center justify-center text-white shrink-0">
                        <InstagramIcon className="w-3 h-3" />
                      </div>
                      <span className="font-medium text-xs truncate">Instagram</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFinish}
                  className="w-full py-2.5 px-4 rounded-lg font-bold text-xs bg-white text-black hover:bg-zinc-200 transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  <span>
                    {youtubeUrl.trim()
                      ? "Start AI Processing & Open Studio"
                      : "Launch Studio Dashboard"}
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  ← Back
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="text-xs text-zinc-400 hover:text-white underline transition cursor-pointer"
                >
                  Skip to Dashboard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="h-14 border-t border-white/5 px-6 sm:px-12 flex items-center justify-between text-xs text-zinc-500">
        <span>© 2026 RelatiV Clips MVP</span>
        <span>Obsidian Taste Edition</span>
      </footer>
    </div>
  );
}
