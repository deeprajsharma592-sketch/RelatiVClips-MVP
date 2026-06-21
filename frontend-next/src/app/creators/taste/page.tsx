"use client";

/**
 * /creators/taste — Taste Preferences Onboarding (Phase 1)
 *
 * 5 quick questions that shape every clip RelatiV makes for this creator.
 * Saves to POST /api/v1/taste/preferences.
 * Reads current state from GET /api/v1/taste/preferences.
 *
 * Questions:
 *  1. Target platform   — where will these clips live?
 *  2. Audience age      — who's watching?
 *  3. Audience location — where in the world?
 *  4. Clip style        — hype / educational / raw / storytelling / music_only
 *  5. Hook style       — question / statement / face-forward / music-drop / text
 *
 * Design: matches the RelatiV dark aesthetic (#050506 / #FFD24A / #FF77E9)
 * with step-by-step cards that feel like a conversation, not a form.
 */

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  Users,
  Globe,
  Zap,
  Mic,
  Check,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  Clock,
  Target,
  X,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = 1 | 2 | 3 | 4 | 5 | "done";
type SaveState = "idle" | "saving" | "saved" | "error";

interface TastePrefs {
  target_platform: string;
  audience_age: string;
  audience_location: string;
  clip_style: string;
  hook_style: string;
  preferred_duration_s: number;
  avoid_topics: string;
  niche: string;
  taste_onboarded: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) || "";

const STEPS = [
  {
    id: 1,
    field: "target_platform",
    icon: Smartphone,
    label: "Where do clips go?",
    sublabel: "Choose your primary platform",
    color: "#FFD24A",
    options: [
      { value: "tiktok", label: "TikTok" },
      { value: "instagram", label: "Instagram Reels" },
      { value: "youtube_shorts", label: "YouTube Shorts" },
      { value: "twitter", label: "Twitter / X" },
      { value: "all", label: "All platforms" },
    ],
  },
  {
    id: 2,
    field: "audience_age",
    icon: Users,
    label: "Who's watching?",
    sublabel: "Select your primary audience age",
    color: "#FF77E9",
    options: [
      { value: "13-17", label: "13–17" },
      { value: "18-24", label: "18–24" },
      { value: "25-34", label: "25–34" },
      { value: "35-44", label: "35–44" },
      { value: "45+", label: "45+" },
      { value: "all", label: "All ages" },
    ],
  },
  {
    id: 3,
    field: "audience_location",
    icon: Globe,
    label: "Where are they?",
    sublabel: "Type countries or regions, comma-separated",
    color: "#FFD24A",
    options: null, // text input
    placeholder: "India, US, UK, Bangladesh…",
  },
  {
    id: 4,
    field: "clip_style",
    icon: Zap,
    label: "How should clips feel?",
    sublabel: "Pick the vibe that matches your content",
    color: "#FF77E9",
    options: [
      { value: "hype", label: "🔥 Hype", desc: "Fast cuts, loud energy, reactions" },
      { value: "educational", label: "📚 Educational", desc: "Explains, breaks down, informs" },
      { value: "storytelling", label: "🎭 Storytelling", desc: "Narrative arc, build-up, payoff" },
      { value: "raw", label: "🎤 Raw", desc: "Unfiltered, authentic, confessional" },
      { value: "music_only", label: "🎵 Music Focus", desc: "Beat drops, vocals, instrumentals" },
      { value: "all", label: "✨ All styles", desc: "Let the AI decide per clip" },
    ],
  },
  {
    id: 5,
    field: "hook_style",
    icon: Mic,
    label: "How does it start?",
    sublabel: "How should each clip open?",
    color: "#FFD24A",
    options: [
      { value: "question", label: "❓ Open with a question", desc: "Ask the viewer something immediately" },
      { value: "statement", label: "⚡ Bold statement", desc: "Drop a provocative claim first" },
      { value: "face_forward", label: "👤 Face-forward", desc: "Talk directly to camera from the start" },
      { value: "music_drop", label: "🎵 Music drop", desc: "Start on a beat or vocal hit" },
      { value: "text_overlay", label: "📝 Text overlay", desc: "Begin with bold on-screen text" },
      { value: "all", label: "🎯 Let AI choose", desc: "Match the hook to the moment" },
    ],
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function TastePage() {
  const [phase, setPhase] = useState<Phase>(1);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [textInputs, setTextInputs] = useState<Record<string, string>>({
    audience_location: "",
    avoid_topics: "",
    niche: "",
  });
  const [selected, setSelected] = useState<Record<string, string>>({
    target_platform: "all",
    audience_age: "all",
    clip_style: "all",
    hook_style: "all",
  });
  const [preferredDuration, setPreferredDuration] = useState(30);

  // Load existing preferences on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/taste/preferences`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TastePrefs | null) => {
        if (!data) return;
        if (data.target_platform) setSelected((s) => ({ ...s, target_platform: data.target_platform }));
        if (data.audience_age) setSelected((s) => ({ ...s, audience_age: data.audience_age }));
        if (data.clip_style) setSelected((s) => ({ ...s, clip_style: data.clip_style }));
        if (data.hook_style) setSelected((s) => ({ ...s, hook_style: data.hook_style }));
        if (data.audience_location) setTextInputs((t) => ({ ...t, audience_location: data.audience_location }));
        if (data.avoid_topics) setTextInputs((t) => ({ ...t, avoid_topics: data.avoid_topics }));
        if (data.niche) setTextInputs((t) => ({ ...t, niche: data.niche }));
        if (data.preferred_duration_s) setPreferredDuration(data.preferred_duration_s);
        if (data.taste_onboarded) setPhase("done");
      })
      .catch(() => {
        // Non-fatal — user can still fill in fresh
      });
  }, []);

  const currentStep = STEPS.find((s) => s.id === phase);

  const handleSelect = useCallback((field: string, value: string) => {
    setSelected((s) => ({ ...s, [field]: value }));
  }, []);

  const handleNext = () => {
    if (phase === 5) {
      saveAll();
    } else {
      setPhase(((p: Phase) => {
        if (p === 5) { saveAll(); return p; }
        return ((p as number) + 1) as Phase;
      }) as (p: Phase) => Phase);
    }
  };

  const handleBack = () => {
    if (phase === 1) return;
    setPhase((p) => ((p as number) - 1) as Phase);
  };

  const saveAll = async () => {
    setSaveState("saving");
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/taste/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          target_platform: selected.target_platform,
          audience_age: selected.audience_age,
          audience_location: textInputs.audience_location,
          clip_style: selected.clip_style,
          hook_style: selected.hook_style,
          preferred_duration_s: preferredDuration,
          avoid_topics: textInputs.avoid_topics,
          niche: textInputs.niche,
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setSaveState("saved");
      setPhase("done");
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not save preferences");
      setSaveState("error");
    }
  };

  const canProceed = currentStep
    ? currentStep.options
      ? true // always selectable
      : textInputs[currentStep.field] !== undefined // text inputs need content
    : true;

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "done") {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="mb-6 inline-flex"
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #FFD24A 0%, #FF77E9 100%)",
              boxShadow: "0 0 40px rgba(255, 210, 74, 0.35)",
            }}
          >
            <Sparkles className="h-9 w-9 text-black" />
          </div>
        </motion.div>
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          Your taste is locked in.
        </h1>
        <p
          className="text-sm mb-8"
          style={{ color: "var(--color-text-muted)" }}
        >
          Every clip RelatiV makes for you from now on will match this profile.
          Paste a YouTube link and watch the difference.
        </p>

        {/* Summary */}
        <div
          className="grid grid-cols-2 gap-3 text-left mb-8"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "var(--radius-xl)",
            padding: "1.25rem",
          }}
        >
          {[
            { icon: Smartphone, label: "Platform", value: selected.target_platform },
            { icon: Users, label: "Audience age", value: selected.audience_age },
            { icon: Globe, label: "Location", value: textInputs.audience_location || "Global" },
            { icon: Zap, label: "Clip style", value: selected.clip_style },
            { icon: Mic, label: "Hook style", value: selected.hook_style },
            { icon: Clock, label: "Duration", value: `~${preferredDuration}s` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <Icon
                className="h-3.5 w-3.5 mt-0.5 shrink-0"
                style={{ color: "#FFD24A" }}
              />
              <div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  {label}
                </div>
                <div className="text-[12px] font-semibold capitalize" style={{ color: "var(--color-text-primary)" }}>
                  {value?.replace(/_/g, " ") || "—"}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-center">
          <a
            href="/creators/dashboard"
            className="px-5 py-2.5 text-[13px] font-semibold rounded-xl"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "var(--color-text-primary)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            Back to dashboard
          </a>
          <button
            onClick={() => {
              setPhase(1);
              setSaveState("idle");
            }}
            className="px-5 py-2.5 text-[13px] font-semibold rounded-xl text-black"
            style={{ background: "#FFD24A" }}
          >
            Edit preferences
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest mb-3"
          style={{
            background: "rgba(255, 210, 74, 0.12)",
            border: "1px solid rgba(255, 210, 74, 0.25)",
            color: "#FFD24A",
          }}
        >
          <Target className="h-3 w-3" />
          Taste Profile
        </div>
        <h1
          className="text-xl font-bold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          5 questions. Better clips forever.
        </h1>
        <p className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
          These answers shape every clip RelatiV makes for you.
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5 mb-6">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{
              background:
                phase >= s.id
                  ? s.color
                  : "rgba(255,255,255,0.08)",
              opacity: phase >= s.id ? 1 : 0.4,
            }}
          />
        ))}
      </div>

      {/* Step card */}
      <AnimatePresence mode="wait">
        {currentStep && (
          <motion.div
            key={phase}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "var(--radius-2xl)",
              padding: "1.5rem",
            }}
          >
            {/* Step header */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: `${currentStep.color}22`,
                  border: `1px solid ${currentStep.color}44`,
                }}
              >
                <currentStep.icon
                  className="h-5 w-5"
                  style={{ color: currentStep.color }}
                />
              </div>
              <div>
                <div
                  className="text-[10px] font-mono uppercase tracking-wider"
                  style={{ color: currentStep.color }}
                >
                  Step {currentStep.id} of 5
                </div>
                <div
                  className="text-[15px] font-bold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {currentStep.label}
                </div>
              </div>
            </div>

            {/* Options or text input */}
            {currentStep.options ? (
              <div className="grid grid-cols-1 gap-2">
                {currentStep.options.map((opt: { value: string; label: string; desc?: string }) => {
                  const isSelected =
                    selected[currentStep.field as keyof typeof selected] ===
                    opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() =>
                        handleSelect(currentStep.field, opt.value)
                      }
                      className="flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-150"
                      style={{
                        background: isSelected
                          ? `${currentStep.color}18`
                          : "rgba(255,255,255,0.03)",
                        border: isSelected
                          ? `1px solid ${currentStep.color}60`
                          : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all"
                        style={{
                          background: isSelected
                            ? currentStep.color
                            : "rgba(255,255,255,0.08)",
                          border: isSelected
                            ? "none"
                            : "1px solid rgba(255,255,255,0.15)",
                        }}
                      >
                        {isSelected && (
                          <Check className="h-3 w-3 text-black" />
                        )}
                      </div>
                      <div>
                        <div
                          className="text-[13px] font-semibold"
                          style={{
                            color: isSelected
                              ? currentStep.color
                              : "var(--color-text-primary)",
                          }}
                        >
                          {opt.label}
                        </div>
                        {opt.desc && (
                          <div
                            className="text-[11px] mt-0.5"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            {opt.desc}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder={currentStep.placeholder}
                  value={textInputs[currentStep.field] || ""}
                  onChange={(e) =>
                    setTextInputs((t) => ({
                      ...t,
                      [currentStep.field]: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 rounded-xl text-[13px] outline-none"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "var(--color-text-primary)",
                  }}
                  autoFocus
                />
                <div
                  className="text-[11px] mt-2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Separate multiple values with commas. e.g. India, US, UK
                </div>
              </div>
            )}

            {/* Duration slider (step 5) */}
            {phase === 5 && (
              <div className="mt-5 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div
                  className="flex items-center justify-between text-[11px] mb-2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <span>Preferred clip length</span>
                  <span
                    className="font-mono font-bold"
                    style={{ color: "#FF77E9" }}
                  >
                    ~{preferredDuration}s
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={90}
                  step={5}
                  value={preferredDuration}
                  onChange={(e) =>
                    setPreferredDuration(Number(e.target.value))
                  }
                  className="w-full accent-[#FF77E9]"
                />
                <div
                  className="flex justify-between text-[10px] mt-1"
                  style={{ color: "rgba(255,255,255,0.2)" }}
                >
                  <span>10s</span>
                  <span>30s</span>
                  <span>60s</span>
                  <span>90s</span>
                </div>
              </div>
            )}

            {/* Niche field (last step) */}
            {phase === 5 && (
              <div className="mt-5 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div
                  className="text-[11px] font-mono uppercase tracking-wider mb-2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Content niche (optional)
                </div>
                <input
                  type="text"
                  placeholder="rap, tech, gaming, finance…"
                  value={textInputs.niche || ""}
                  onChange={(e) =>
                    setTextInputs((t) => ({ ...t, niche: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-xl text-[13px] outline-none"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "var(--color-text-primary)",
                  }}
                />
                <div
                  className="mt-2 flex flex-wrap gap-1.5"
                >
                  {["rap", "tech", "gaming", "finance", "fitness", "comedy", "news"].map(
                    (n) => (
                      <button
                        key={n}
                        onClick={() =>
                          setTextInputs((t) => ({ ...t, niche: n }))
                        }
                        className="px-2.5 py-1 rounded-full text-[11px] capitalize transition-all"
                        style={{
                          background:
                            textInputs.niche === n
                              ? "rgba(255, 210, 74, 0.15)"
                              : "rgba(255,255,255,0.04)",
                          border: `1px solid ${
                            textInputs.niche === n
                              ? "rgba(255, 210, 74, 0.4)"
                              : "rgba(255,255,255,0.08)"
                          }`,
                          color:
                            textInputs.niche === n
                              ? "#FFD24A"
                              : "var(--color-text-muted)",
                        }}
                      >
                        {n}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <div
                className="flex items-center gap-2 mt-4 text-[12px]"
                style={{ color: "rgb(239, 68, 68)" }}
              >
                <AlertCircle className="h-4 w-4" />
                {errorMsg}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-5">
        <button
          onClick={handleBack}
          disabled={phase === 1}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px]"
          style={{
            color: "var(--color-text-muted)",
            opacity: phase === 1 ? 0 : 1,
          }}
        >
          ← Back
        </button>

        <button
          onClick={handleNext}
          disabled={saveState === "saving"}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-black transition-all"
          style={{
            background: "#FFD24A",
            opacity: saveState === "saving" ? 0.7 : 1,
          }}
        >
          {saveState === "saving" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : phase === 5 ? (
            <>
              <Sparkles className="h-4 w-4" />
              Save preferences
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* Skip link */}
      <div className="text-center mt-4">
        <a
          href="/creators/dashboard"
          className="text-[11px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          Skip for now — use defaults
        </a>
      </div>
    </div>
  );
}
