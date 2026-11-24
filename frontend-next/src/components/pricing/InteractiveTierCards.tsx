"use client";

import Image from "next/image";
import { useState, type MouseEvent } from "react";
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
  features: string[];
}

export const TIERS_CONFIG: TierConfig[] = [
  { id: "creator_go", name: "RelatiV Go", image: "/images/pricing/go-mount-fuji.jpg", imagePosition: "50% 48%", monthlyPrice: "$7.99", originalMonthlyPrice: "$11.99", yearlyPrice: "$5.99", yearlyBilled: "Billed $71.88 annually", clipsCount: "100 clips / month", accent: "#67D8DF", features: ["20,000 credits", "30–90 second clips", "30 minute source videos", "One active processing job"] },
  { id: "creator_pro", name: "Pro Studio", image: "/images/pricing/pro-misty-ridges.jpg", imagePosition: "50% 55%", monthlyPrice: "$14.99", originalMonthlyPrice: "$24.99", yearlyPrice: "$11.99", yearlyBilled: "Billed $143.88 annually", clipsCount: "300 clips / month", accent: "#E6B84A", features: ["60,000 credits", "Everything in Go", "60 minute source videos", "Priority processing"] },
  { id: "creator_max", name: "RelatiV Max", image: "/images/pricing/max-tea-sunrise.jpg", imagePosition: "52% 50%", monthlyPrice: "$29.99", originalMonthlyPrice: "$49.99", yearlyPrice: "$23.99", yearlyBilled: "Billed $287.88 annually", clipsCount: "1,000 clips / month", accent: "#B99AF7", features: ["200,000 credits", "Everything in Pro Studio", "90 minute source videos", "Two active jobs"] },
];

interface InteractiveTierCardsProps { onSelectPlan?: (planId: string) => void; defaultBillingCycle?: "monthly" | "yearly"; className?: string; showBillingToggle?: boolean; }

export default function InteractiveTierCards({ onSelectPlan, defaultBillingCycle = "yearly", className = "", showBillingToggle = true }: InteractiveTierCardsProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(defaultBillingCycle);
  const [loadingPlan, setLoadingPlan] = useState<TierConfig["id"] | null>(null);
  const checkout = (event: MouseEvent<HTMLButtonElement>, tier: TierConfig) => {
    event.stopPropagation();
    if (onSelectPlan) return onSelectPlan(tier.id);
    setLoadingPlan(tier.id);
    if (!user) return router.push("/signup?next=/plans");
    window.location.assign(getPolarCheckoutUrl(tier.id, user));
  };

  return <div className={`w-full ${className}`}>
    {showBillingToggle && <div className="mb-8 flex justify-center"><div className="flex rounded-full border border-white/10 bg-white/[0.04] p-1">{(["monthly", "yearly"] as const).map((cycle) => <button key={cycle} type="button" onClick={() => setBillingCycle(cycle)} className={`rounded-full px-4 py-1.5 text-xs capitalize transition-colors ${billingCycle === cycle ? "bg-[#F4F1E8] text-black" : "text-zinc-400 hover:text-white"}`}>{cycle}</button>)}</div></div>}
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 md:grid-cols-3 lg:gap-7">
      {TIERS_CONFIG.map((tier) => { const isYearly = billingCycle === "yearly"; const price = isYearly ? tier.yearlyPrice : tier.monthlyPrice; return <article key={tier.id} className="group overflow-hidden rounded-[26px] border border-white/10 bg-[#0A0B0E] shadow-[0_18px_60px_rgba(0,0,0,.22)]">
        <div className="relative h-[300px] overflow-hidden"><Image src={tier.image} alt="" fill priority sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]" style={{ objectPosition: tier.imagePosition }} /><div className="absolute inset-0 bg-gradient-to-t from-[#0A0B0E] via-[#0A0B0E]/10 to-transparent" /><h3 className="absolute inset-x-6 bottom-6 font-display text-3xl font-semibold tracking-[-0.04em] text-[#F4F1E8] sm:text-4xl">{tier.name}</h3></div>
        <div className="p-6 sm:p-7"><div className="flex items-end justify-between gap-4 border-b border-white/10 pb-5"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{tier.clipsCount}</p><div className="mt-2 flex items-baseline gap-2">{isYearly && tier.originalMonthlyPrice && <span className="text-sm text-zinc-600 line-through">{tier.originalMonthlyPrice}</span>}<span className="font-mono text-3xl font-semibold text-emerald-400">{price}</span><span className="text-xs text-zinc-500">/mo</span></div></div><span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] text-emerald-400">offer</span></div>
          <ul className="mt-5 grid gap-3">{tier.features.map((feature) => <li key={feature} className="flex items-center gap-2.5 text-sm text-zinc-300"><Check className="h-4 w-4 shrink-0 text-emerald-400" />{feature}</li>)}</ul>
          <button type="button" onClick={(event) => checkout(event, tier)} disabled={loadingPlan !== null} className="mt-6 flex h-11 w-full items-center justify-center rounded-full bg-[#F4F1E8] text-sm font-semibold text-[#07080B] transition-colors hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70">{loadingPlan === tier.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `Get ${tier.name.replace("RelatiV ", "")}`}</button>
          {isYearly && <p className="mt-2 text-center font-mono text-[9px] text-zinc-600">{tier.yearlyBilled}</p>}
        </div>
      </article>; })}
    </div>
  </div>;
}
