"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { getPolarCheckoutUrl } from "@/lib/polar";

export interface TierConfig {
  id: "creator_go" | "creator_pro" | "creator_max";
  name: string;
  image: string;
  imagePosition: string;
  monthlyPrice: string;
  originalMonthlyPrice?: string;
  yearlyPrice: string;
  yearlyBilled: string;
  clipsCount: string;
  accent: string;
  flipDirection: 1 | -1;
  features: string[];
}

export const TIERS_CONFIG: TierConfig[] = [
  {
    id: "creator_go", name: "RelatiV Go", image: "/images/pricing/go-mount-fuji.jpg", imagePosition: "50% 48%",
    monthlyPrice: "$7.99", originalMonthlyPrice: "$11.99", yearlyPrice: "$5.99", yearlyBilled: "Billed $71.88 annually",
    clipsCount: "100 clips / month", accent: "#67D8DF", flipDirection: 1,
    features: ["20,000 credits · up to 100 clips", "30–90 second narrative clips", "AI hook detection and virality scoring", "Dynamic 9:16 face framing", "Word-by-word captions", "Full HD, watermark-free exports", "30 minute source videos", "One active processing job", "Exports stored for 7 days"],
  },
  {
    id: "creator_pro", name: "Pro Studio", image: "/images/pricing/pro-misty-ridges.jpg", imagePosition: "50% 55%",
    monthlyPrice: "$14.99", originalMonthlyPrice: "$24.99", yearlyPrice: "$11.99", yearlyBilled: "Billed $143.88 annually",
    clipsCount: "300 clips / month", accent: "#E6B84A", flipDirection: -1,
    features: ["60,000 credits · up to 300 clips", "Everything in Go", "Four content archetypes", "Multi-platform auto publishing", "Auto B-roll and AI emojis", "Priority GPU processing", "60 minute source videos", "One priority processing job", "Priority creator support"],
  },
  {
    id: "creator_max", name: "RelatiV Max", image: "/images/pricing/max-tea-sunrise.jpg", imagePosition: "52% 50%",
    monthlyPrice: "$29.99", originalMonthlyPrice: "$49.99", yearlyPrice: "$23.99", yearlyBilled: "Billed $287.88 annually",
    clipsCount: "1,000 clips / month", accent: "#B99AF7", flipDirection: 1,
    features: ["200,000 credits · up to 1,000 clips", "Everything in Pro Studio", "90 minute source videos", "Two concurrent processing jobs", "Team seats and shared brand kits", "Dedicated GPU compute lane", "Custom caption typography", "API and webhook access", "Dedicated account support"],
  },
];

interface InteractiveTierCardsProps {
  onSelectPlan?: (planId: string) => void;
  defaultBillingCycle?: "monthly" | "yearly";
  className?: string;
  showBillingToggle?: boolean;
}

export default function InteractiveTierCards({ onSelectPlan, defaultBillingCycle = "yearly", className = "", showBillingToggle = true }: InteractiveTierCardsProps) {
  const { user } = useAuth();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(defaultBillingCycle);
  const [activeTier, setActiveTier] = useState<TierConfig["id"] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<TierConfig["id"] | null>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (stageRef.current && !stageRef.current.contains(event.target as Node)) setActiveTier(null);
    };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setActiveTier(null); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  const checkout = (event: MouseEvent<HTMLButtonElement>, tier: TierConfig) => {
    event.stopPropagation();
    if (onSelectPlan) return onSelectPlan(tier.id);
    setLoadingPlan(tier.id);
    if (!user) return router.push("/signup?next=/plans");
    window.location.assign(getPolarCheckoutUrl(tier.id, user));
  };

  return (
    <div ref={stageRef} className={`relative w-full ${className}`}>
      {showBillingToggle && (
        <div className="mb-8 flex justify-center">
          <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-1">
            {(["monthly", "yearly"] as const).map((cycle) => (
              <button key={cycle} type="button" onClick={() => setBillingCycle(cycle)} className={`rounded-full px-4 py-1.5 text-xs capitalize transition-colors ${billingCycle === cycle ? "bg-[#F4F1E8] text-black" : "text-zinc-400 hover:text-white"}`}>
                {cycle}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 md:grid-cols-3 lg:gap-7">
        {TIERS_CONFIG.map((tier) => {
          const flipped = activeTier === tier.id;
          const displayPrice = billingCycle === "yearly" ? tier.yearlyPrice : tier.monthlyPrice;
          return (
            <div key={tier.id} className="h-[520px] w-full [perspective:1400px]">
              <motion.div
                role="button" tabIndex={0} aria-label={`${flipped ? "Hide" : "Show"} ${tier.name} pricing and benefits`} aria-pressed={flipped}
                onClick={() => setActiveTier(flipped ? null : tier.id)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveTier(flipped ? null : tier.id); } }}
                animate={{ rotateY: reduceMotion ? 0 : flipped ? tier.flipDirection * 180 : 0 }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 155, damping: 23, mass: 0.86 }}
                className="relative h-full w-full cursor-pointer rounded-[26px] outline-none [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <div className={`absolute inset-0 overflow-hidden rounded-[26px] border border-white/12 bg-[#0A0B0E] [backface-visibility:hidden] ${reduceMotion && flipped ? "invisible" : ""}`}>
                  <Image src={tier.image} alt="" fill priority sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" style={{ objectPosition: tier.imagePosition }} />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,8,.18),rgba(3,5,8,.48))]" />
                  <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 text-center">
                    <h3 className="font-display text-4xl font-semibold tracking-[-0.04em] text-[#F4F1E8] drop-shadow-[0_2px_18px_rgba(0,0,0,.75)] sm:text-[42px]">{tier.name}</h3>
                  </div>
                </div>

                <div
                  className={`absolute inset-0 flex flex-col overflow-hidden rounded-[26px] border bg-[#0A0B0E] p-6 text-left [backface-visibility:hidden] sm:p-7 ${reduceMotion && !flipped ? "invisible" : ""}`}
                  style={{ transform: reduceMotion ? "none" : `rotateY(${tier.flipDirection * 180}deg)`, borderColor: `${tier.accent}55` }}
                >
                  <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full opacity-15 blur-3xl" style={{ background: tier.accent }} />
                  <div className="relative flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">{tier.clipsCount}</p>
                      <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#F4F1E8]">{tier.name}</h3>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline justify-end gap-1.5">
                        {billingCycle === "monthly" && tier.originalMonthlyPrice && <span className="text-xs text-zinc-600 line-through">{tier.originalMonthlyPrice}</span>}
                        <span className="font-mono text-2xl font-semibold text-white">{displayPrice}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500">per month</span>
                    </div>
                  </div>

                  <ul className="relative mt-5 grid flex-1 content-start gap-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-[12px] leading-4 text-zinc-300">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: tier.accent }} /><span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button type="button" onClick={(event) => checkout(event, tier)} disabled={loadingPlan !== null} className="relative mt-5 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold text-[#07080B] transition-[filter,transform] hover:brightness-110 active:scale-[0.985] disabled:cursor-wait disabled:opacity-70" style={{ background: tier.accent }}>
                    {loadingPlan === tier.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `Get ${tier.name.replace("RelatiV ", "")}`}
                  </button>
                  {billingCycle === "yearly" && <p className="mt-2 text-center font-mono text-[9px] text-zinc-600">{tier.yearlyBilled}</p>}
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">Tap a card to turn it over</p>
    </div>
  );
}
