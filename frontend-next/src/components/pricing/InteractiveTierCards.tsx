"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Zap,
  Crown,
  ArrowRight,
  Sparkles,
  X,
  Loader2,
  RotateCcw,
  Shield,
  Layers,
} from "lucide-react";
import FlipCard from "@/components/ui/FlipCard";
import { useAuth } from "@/lib/AuthContext";
import { getPolarCheckoutUrl } from "@/lib/polar";

export interface TierConfig {
  id: "creator_go" | "creator_pro" | "creator_max";
  name: string;
  tagline: string;
  badge?: string;
  highlight?: boolean;
  image: string;
  credits: string;
  creditsNumber: string;
  clipsCount: string;
  monthlyPrice: string;
  originalMonthlyPrice?: string;
  yearlyPrice: string;
  originalYearlyPrice?: string;
  yearlyBilled: string;
  accent: {
    color: string;
    border: string;
    glow: string;
    pillBg: string;
    pillText: string;
    btnBg: string;
    btnHover: string;
    btnText: string;
  };
  features: string[];
}

export const TIERS_CONFIG: TierConfig[] = [
  {
    id: "creator_go",
    name: "RelatiV Go",
    tagline: "Solo creators shipping weekly viral shorts",
    badge: "CREATOR ENTRY",
    image: "/hero-wheel/tinted-glasses-4x5.jpg",
    credits: "20,000 credits",
    creditsNumber: "20,000",
    clipsCount: "100 clips / month",
    monthlyPrice: "$7.99",
    originalMonthlyPrice: "$11.99",
    yearlyPrice: "$5.99",
    originalYearlyPrice: "$9.59",
    yearlyBilled: "Billed $71.88 annually",
    accent: {
      color: "cyan",
      border: "border-cyan-500/30 hover:border-cyan-400/50",
      glow: "shadow-[0_0_35px_rgba(6,182,212,0.18)]",
      pillBg: "bg-cyan-500/15 border-cyan-500/30",
      pillText: "text-cyan-300",
      btnBg: "bg-cyan-400 hover:bg-cyan-300",
      btnHover: "hover:bg-cyan-300",
      btnText: "text-black",
    },
    features: [
      "20,000 credits · up to 100 clips / month",
      "Narrative-complete 30–90 second clips",
      "AI virality scoring & hook detection",
      "9:16 vertical dynamic face framing",
      "Karaoke word-by-word subtitles",
      "No RelatiV watermark & Full HD export",
      "Up to 30 min source video length",
      "1 active processing task at a time",
      "Exports stored for 7 days",
    ],
  },
  {
    id: "creator_pro",
    name: "Pro Studio",
    tagline: "Active creators & streamers posting 3-5x weekly",
    badge: "⚡ MOST POPULAR",
    highlight: true,
    image: "/hero-wheel/gold-visor-4x5.jpg",
    credits: "60,000 credits",
    creditsNumber: "60,000",
    clipsCount: "300 clips / month",
    monthlyPrice: "$14.99",
    originalMonthlyPrice: "$24.99",
    yearlyPrice: "$11.99",
    originalYearlyPrice: "$19.99",
    yearlyBilled: "Billed $143.88 annually",
    accent: {
      color: "amber",
      border: "border-amber-400/60 shadow-[0_0_35px_rgba(245,158,11,0.22)]",
      glow: "shadow-[0_0_45px_rgba(245,158,11,0.28)]",
      pillBg: "bg-amber-400/20 border-amber-400/40",
      pillText: "text-amber-300",
      btnBg: "bg-amber-400 hover:bg-amber-300",
      btnHover: "hover:bg-amber-300",
      btnText: "text-black",
    },
    features: [
      "60,000 credits · up to 300 clips / month",
      "Narrative-complete 30–90 second clips",
      "All 4 Content Archetypes (Streamer, Gaming, Podcast, Edu)",
      "1-Click Multi-Platform Auto Publisher (TikTok, Shorts, Reels)",
      "Auto B-roll insertion & AI Emojis",
      "Fast priority GPU processing queue",
      "Up to 60 min source video length",
      "1 priority processing task at a time",
      "Priority Discord & VIP email support",
    ],
  },
  {
    id: "creator_max",
    name: "RelatiV Max",
    tagline: "Best for studios & agencies",
    badge: "👑 STUDIO SCALE",
    image: "/hero-wheel/purple-hoodie-4x5.jpg",
    credits: "200,000 credits",
    creditsNumber: "200,000",
    clipsCount: "1,000 clips / month",
    monthlyPrice: "$29.99",
    originalMonthlyPrice: "$49.99",
    yearlyPrice: "$23.99",
    originalYearlyPrice: "$39.99",
    yearlyBilled: "Billed $287.88 annually",
    accent: {
      color: "purple",
      border: "border-purple-500/30 hover:border-purple-400/50",
      glow: "shadow-[0_0_35px_rgba(168,85,247,0.18)]",
      pillBg: "bg-purple-500/15 border-purple-500/30",
      pillText: "text-purple-300",
      btnBg: "bg-purple-400 hover:bg-purple-300",
      btnHover: "hover:bg-purple-300",
      btnText: "text-black",
    },
    features: [
      "200,000 credits · up to 1,000 clips / month",
      "Narrative-complete 30–90 second clips",
      "Up to 90 min source video length",
      "2 concurrent active processing tasks",
      "Team seats & shared brand templates",
      "Dedicated priority GPU compute lane",
      "Custom subtitle typography & branding",
      "API & Webhook integrations",
      "Dedicated account manager & SLA",
    ],
  },
];

interface InteractiveTierCardsProps {
  onSelectPlan?: (planId: string) => void;
  defaultBillingCycle?: "monthly" | "yearly";
  className?: string;
  showBillingToggle?: boolean;
}

export default function InteractiveTierCards({
  onSelectPlan,
  defaultBillingCycle = "yearly",
  className = "",
  showBillingToggle = true,
}: InteractiveTierCardsProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(defaultBillingCycle);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Expanded Zoom Spotlight state
  const [zoomedTier, setZoomedTier] = useState<TierConfig | null>(null);
  const [isZoomFlipped, setIsZoomFlipped] = useState(true);

  // Close zoom on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setZoomedTier(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCheckout = (e: React.MouseEvent, tier: TierConfig) => {
    e.stopPropagation();
    if (onSelectPlan) {
      onSelectPlan(tier.id);
      return;
    }
    setLoadingPlan(tier.id);
    if (!user) {
      router.push(`/signup?next=/plans`);
      return;
    }
    const checkoutUrl = getPolarCheckoutUrl(tier.id, user);
    window.location.href = checkoutUrl;
  };

  const handleOpenZoom = (tier: TierConfig) => {
    setZoomedTier(tier);
    setIsZoomFlipped(true); // Open directly on the flipped Pricing & Benefits face
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* ── Optional Top Billing Cycle Toggle ── */}
      {showBillingToggle && (
        <div className="flex flex-col items-center justify-center mb-8 sm:mb-10 text-center">
          <div className="inline-flex items-center p-1 bg-white/5 border border-white/10 rounded-full shadow-inner">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
                billingCycle === "monthly"
                  ? "bg-white text-black shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                billingCycle === "yearly"
                  ? "bg-white text-black shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Yearly
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                Save 20%
              </span>
            </button>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2 font-mono">
            Tap or drag any card to flip · Click to zoom in
          </p>
        </div>
      )}

      {/* ── 3 Responsive Tier Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch w-full max-w-6xl mx-auto">
        {TIERS_CONFIG.map((tier) => (
          <div
            key={tier.id}
            onClick={() => handleOpenZoom(tier)}
            className="w-full flex justify-center cursor-pointer transition-transform duration-200"
          >
            <FlipCard
              width="100%"
              height={500}
              radius={22}
              tiltMax={10}
              perspective={1200}
              hoverScale={1.02}
              glareOpacity={0.2}
              className={`w-full ${tier.highlight ? "ring-2 ring-amber-400/60 shadow-xl" : ""}`}
              front={
                <FrontFace
                  tier={tier}
                  onExpand={() => handleOpenZoom(tier)}
                />
              }
              back={
                <BackFace
                  tier={tier}
                  billingCycle={billingCycle}
                  loadingPlan={loadingPlan}
                  onCheckout={(e) => handleCheckout(e, tier)}
                  onToggleFlip={(e) => {
                    e.stopPropagation();
                  }}
                  onExpand={() => handleOpenZoom(tier)}
                  isZoomed={false}
                />
              }
            />
          </div>
        ))}
      </div>

      {/* ── Zoom In / Elevated Modal Stage with Dimmed Backdrop ── */}
      <AnimatePresence>
        {zoomedTier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Tap anywhere outside to dismiss & return to normal */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={() => setZoomedTier(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
              aria-label="Close zoom view"
            />

            {/* Zoomed Card Container */}
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="relative z-10 w-full max-w-lg my-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button ("✕") */}
              <button
                type="button"
                onClick={() => setZoomedTier(null)}
                className="absolute -top-3.5 -right-3.5 sm:-top-4 sm:-right-4 w-9 h-9 rounded-full bg-zinc-900 border border-white/20 hover:border-white/40 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 cursor-pointer z-20"
                aria-label="Close zoomed view"
              >
                <X size={16} />
              </button>

              <FlipCard
                width="100%"
                height={560}
                radius={24}
                flipped={isZoomFlipped}
                onFlipChange={(flipped) => setIsZoomFlipped(flipped)}
                tiltMax={6}
                hoverScale={1.01}
                perspective={1400}
                front={
                  <FrontFace
                    tier={zoomedTier}
                    onFlip={() => setIsZoomFlipped(true)}
                    isZoomed={true}
                  />
                }
                back={
                  <BackFace
                    tier={zoomedTier}
                    billingCycle={billingCycle}
                    onBillingCycleChange={(cycle) => setBillingCycle(cycle)}
                    loadingPlan={loadingPlan}
                    onCheckout={(e) => handleCheckout(e, zoomedTier)}
                    onToggleFlip={() => setIsZoomFlipped(false)}
                    isZoomed={true}
                  />
                }
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FRONT FACE OF TIER CARD (Visual Image + Crisp Typography + Highlighted Credits)
// ─────────────────────────────────────────────────────────────────────────────
function FrontFace({
  tier,
  onExpand,
  onFlip,
  isZoomed = false,
}: {
  tier: TierConfig;
  onExpand?: () => void;
  onFlip?: () => void;
  isZoomed?: boolean;
}) {
  return (
    <div className="relative w-full h-full flex flex-col justify-between p-6 sm:p-7 overflow-hidden select-none">
      {/* 1. Portrait Background Image */}
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src={tier.image}
          alt={tier.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover object-center transform scale-105 transition-transform duration-700 ease-out group-hover:scale-110"
          priority
        />
        {/* Multi-stop dark cinematic gradient for 100% text legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,11,15,0.72) 0%, rgba(10,11,15,0.35) 30%, rgba(10,11,15,0.86) 70%, rgba(10,11,15,0.98) 100%)",
          }}
        />
      </div>

      {/* 2. Top Header & Micro-Badge */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider backdrop-blur-md border ${
            tier.highlight
              ? "bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/25"
              : "bg-white/10 text-white/90 border-white/20"
          }`}
        >
          {tier.badge || "CREATOR PLAN"}
        </span>

        <span className="text-[11px] font-mono text-zinc-400 bg-black/40 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10">
          {tier.clipsCount}
        </span>
      </div>

      {/* 3. Middle / Bottom Information Block */}
      <div className="relative z-10 space-y-3.5 mt-auto">
        {/* Tier Name & Launch Offer Price */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight drop-shadow-md">
              {tier.name}
            </h3>
            {/* Price badge on front face */}
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 shrink-0">
              <span className="text-xs text-zinc-400 line-through decoration-red-400 font-mono">
                {tier.originalMonthlyPrice}
              </span>
              <span className="text-sm font-extrabold text-white font-mono">
                {tier.monthlyPrice}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">/mo</span>
            </div>
          </div>
          <p className="text-xs text-zinc-300/90 font-sans mt-0.5 line-clamp-1">
            {tier.tagline}
          </p>
        </div>

        {/* ── HIGHLIGHTED CREDITS SECTION (Requested by User) ── */}
        <div
          className={`p-3 rounded-xl border backdrop-blur-xl ${tier.accent.pillBg} flex items-center justify-between shadow-lg`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Sparkles size={14} className={tier.accent.pillText} />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-300 font-semibold">
                Monthly Capacity
              </div>
              <div className={`text-base font-extrabold tracking-tight ${tier.accent.pillText}`}>
                {tier.credits}
              </div>
            </div>
          </div>
          <span className="text-xs font-medium text-white/80 font-mono bg-black/30 px-2 py-0.5 rounded">
            {tier.clipsCount.split(" ")[0]} clips
          </span>
        </div>

        {/* Interactive Prompt CTA at bottom */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isZoomed && onFlip) onFlip();
            else if (onExpand) onExpand();
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer group"
        >
          <span>Tap to reveal pricing &amp; benefits</span>
          <RotateCcw size={13} className="text-zinc-400 group-hover:rotate-180 transition-transform duration-300" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BACK FACE OF TIER CARD (Pricing + Full Benefits + "Get Go/Pro/Max" CTA)
// ─────────────────────────────────────────────────────────────────────────────
function BackFace({
  tier,
  billingCycle,
  onBillingCycleChange,
  loadingPlan,
  onCheckout,
  onToggleFlip,
  onExpand,
  isZoomed = false,
}: {
  tier: TierConfig;
  billingCycle: "monthly" | "yearly";
  onBillingCycleChange?: (cycle: "monthly" | "yearly") => void;
  loadingPlan: string | null;
  onCheckout: (e: React.MouseEvent) => void;
  onToggleFlip: (e: React.MouseEvent) => void;
  onExpand?: () => void;
  isZoomed?: boolean;
}) {
  const isYearly = billingCycle === "yearly";
  const displayPrice = isYearly ? tier.yearlyPrice : tier.monthlyPrice;

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-6 sm:p-7 bg-[#0E0F14] border border-white/10 rounded-[22px] overflow-y-auto text-left select-none">
      {/* Subtle Ambient Radial Highlight */}
      <div
        className="absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{
          background:
            tier.accent.color === "cyan"
              ? "#06B6D4"
              : tier.accent.color === "amber"
              ? "#F59E0B"
              : "#A855F7",
        }}
      />

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
            Plan Details
          </span>
          <h4 className="text-xl font-bold font-display text-white tracking-tight">
            {tier.name}
          </h4>
        </div>

        {/* Flip Back Button */}
        <button
          type="button"
          onClick={onToggleFlip}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
          title="Flip back to front"
          aria-label="Flip back"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Pricing Header & Billing Toggle */}
      <div className="relative z-10 py-3">
        {/* In-Card Mini Billing Switch if Zoomed */}
        {isZoomed && onBillingCycleChange && (
          <div className="flex items-center gap-1 p-0.5 bg-white/5 border border-white/10 rounded-lg w-fit mb-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBillingCycleChange("monthly");
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                !isYearly ? "bg-white text-black font-semibold" : "text-zinc-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBillingCycleChange("yearly");
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                isYearly ? "bg-white text-black font-semibold" : "text-zinc-400 hover:text-white"
              }`}
            >
              Yearly (-20%)
            </button>
          </div>
        )}

        {/* Price Display */}
        <div className="flex items-baseline gap-2 flex-wrap">
          {(!isYearly ? tier.originalMonthlyPrice : tier.originalYearlyPrice) && (
            <span className="text-lg sm:text-xl text-zinc-500 line-through decoration-red-500/70 font-semibold font-mono">
              {!isYearly ? tier.originalMonthlyPrice : tier.originalYearlyPrice}
            </span>
          )}
          <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-mono">
            {displayPrice}
          </span>
          <span className="text-xs text-zinc-400 font-sans">/ month</span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            40% OFF
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
          {isYearly
            ? tier.yearlyBilled
            : "Special 40% launch offer · Billed monthly · Cancel anytime"}
        </p>
      </div>

      {/* ── PRIMARY CTA BUTTON: "Get Go", "Get Pro", "Get Max" ── */}
      <div className="relative z-10 my-2">
        <button
          type="button"
          disabled={Boolean(loadingPlan)}
          onClick={onCheckout}
          className={`w-full py-3 px-5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] cursor-pointer ${
            tier.highlight
              ? "bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/20"
              : tier.accent.color === "cyan"
              ? "bg-cyan-400 hover:bg-cyan-300 text-black shadow-cyan-400/20"
              : "bg-purple-400 hover:bg-purple-300 text-black shadow-purple-400/20"
          } disabled:opacity-50`}
        >
          {loadingPlan === tier.id ? (
            <>
              <Loader2 size={15} className="animate-spin text-black" />
              <span>Redirecting to Checkout…</span>
            </>
          ) : (
            <>
              <span>
                Get {tier.name.replace("RelatiV ", "")}
              </span>
              {tier.highlight ? <Zap size={15} className="fill-black" /> : <ArrowRight size={15} />}
            </>
          )}
        </button>
      </div>

      {/* Detailed Benefits List */}
      <div className="relative z-10 pt-2 space-y-2 text-xs">
        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mb-2">
          Included with {tier.name}:
        </div>
        {tier.features.map((feature) => (
          <div key={feature} className="flex items-start gap-2 text-zinc-300 leading-snug">
            <Check
              size={14}
              className={`shrink-0 mt-0.5 ${
                tier.accent.color === "cyan"
                  ? "text-cyan-400"
                  : tier.accent.color === "amber"
                  ? "text-amber-400"
                  : "text-purple-400"
              }`}
            />
            <span className="text-[11px] sm:text-xs">{feature}</span>
          </div>
        ))}
      </div>

      {/* Footer Guarantee */}
      <div className="relative z-10 mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center gap-1.5">
          <Shield size={12} className="text-emerald-400" />
          <span>1-click instant activation</span>
        </div>
        <span>Global Card &amp; UPI</span>
      </div>
    </div>
  );
}
