"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, ArrowLeft, Asterisk } from "lucide-react";
import Link from "next/link";

type SellingType =
  | "Software / SaaS"
  | "Digital downloads"
  | "E-books or courses"
  | "Physical products"
  | "Services"
  | "Financial Trading"
  | "Advertising"
  | "Marketplace"
  | "Other";

type PricingModel =
  | "Subscription"
  | "Seat-based subscription"
  | "One-time purchase"
  | "Usage-based";

type SellingPlatform =
  | "Paddle"
  | "Lemon Squeezy"
  | "Gumroad"
  | "Stripe"
  | "Other";

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStepParam = searchParams.get("step");
  const initialStep =
    initialStepParam === "1" ? 1 : initialStepParam === "2" ? 2 : 3;

  const [step, setStep] = useState<1 | 2 | 3>(initialStep);

  // Step 1: Personal Details State
  const [personalRole, setPersonalRole] = useState<string>("Founder / Solo Builder");
  const [fullName, setFullName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [location, setLocation] = useState<string>("");

  // Step 2: Business Details State
  const [orgName, setOrgName] = useState<string>("");
  const [teamSize, setTeamSize] = useState<string>("Just me");
  const [businessStage, setBusinessStage] = useState<string>("Active growth");
  const [primaryChannel, setPrimaryChannel] = useState<string>("Direct Website / SaaS");

  // Step 3: Product Details State (Matches Polar Reference Image Exactly)
  const [sellingTypes, setSellingTypes] = useState<SellingType[]>([
    "Software / SaaS",
  ]);
  const [productDescription, setProductDescription] = useState<string>("");
  const [pricingModel, setPricingModel] = useState<PricingModel>("Subscription");
  const [sellingPlatforms, setSellingPlatforms] = useState<SellingPlatform[]>([]);
  const [supportEmail, setSupportEmail] = useState<string>("");
  const [productUrl, setProductUrl] = useState<string>("");

  const toggleSellingType = (item: SellingType) => {
    setSellingTypes((prev) =>
      prev.includes(item)
        ? prev.length > 1
          ? prev.filter((t) => t !== item)
          : prev
        : [...prev, item]
    );
  };

  const togglePlatform = (item: SellingPlatform) => {
    setSellingPlatforms((prev) =>
      prev.includes(item) ? prev.filter((p) => p !== item) : [...prev, item]
    );
  };

  const handleLaunchDashboard = () => {
    // Save onboarding preferences into localStorage
    try {
      localStorage.setItem(
        "relativ_onboarding_profile",
        JSON.stringify({
          personalRole,
          fullName,
          username,
          location,
          orgName,
          teamSize,
          businessStage,
          primaryChannel,
          sellingTypes,
          productDescription,
          pricingModel,
          sellingPlatforms,
          supportEmail,
          productUrl,
          completedAt: new Date().toISOString(),
        })
      );
    } catch {
      // ignore localStorage quota errors
    }

    if (productUrl.trim()) {
      router.push(`/dashboard?url=${encodeURIComponent(productUrl.trim())}`);
    } else {
      router.push("/dashboard");
    }
  };

  const STEPS = [
    {
      num: 1 as const,
      title: "Personal details",
      subtitle: "Tell us a bit about yourself",
    },
    {
      num: 2 as const,
      title: "Business details",
      subtitle: "Tell us about your organization",
    },
    {
      num: 3 as const,
      title: "Product details",
      subtitle: "What you are building and selling",
    },
  ];

  return (
    <div className="min-h-screen bg-[#07080a] text-white flex flex-col md:flex-row antialiased selection:bg-blue-600 selection:text-white">
      {/* ─── LEFT SIDEBAR (STEPPER & BRAND) ─── */}
      <aside className="w-full md:w-[280px] lg:w-[310px] shrink-0 border-b md:border-b-0 md:border-r border-white/[0.07] bg-[#090a0d] p-6 sm:p-8 flex flex-col justify-between">
        <div className="space-y-10">
          {/* Brand Logo */}
          <Link href="/" className="inline-flex items-center gap-2 group">
            <span className="w-6 h-6 flex items-center justify-center text-white">
              <Asterisk className="w-5 h-5 stroke-[2.5] text-white group-hover:rotate-45 transition-transform duration-300" />
            </span>
            <span className="font-semibold text-white tracking-tight text-sm">
              RelatiV
            </span>
          </Link>

          {/* Stepper Steps */}
          <div className="relative pl-1 space-y-7">
            {/* Vertical connector line */}
            <div className="hidden md:block absolute left-[15px] top-3 bottom-3 w-[1px] bg-white/[0.12] -z-0" />

            {STEPS.map((s) => {
              const isCompleted = s.num < step;
              const isCurrent = s.num === step;

              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setStep(s.num)}
                  className="flex items-start gap-3.5 text-left w-full group cursor-pointer relative z-10"
                >
                  {/* Step circle indicator */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isCompleted
                        ? "bg-white text-black"
                        : isCurrent
                        ? "bg-white text-black shadow-sm font-semibold"
                        : "bg-[#111215] text-zinc-500 border border-white/[0.15] group-hover:border-white/30"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      <span className="text-xs font-bold">{s.num}</span>
                    )}
                  </div>

                  {/* Step text labels */}
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold leading-tight transition-colors ${
                        isCurrent
                          ? "text-white"
                          : isCompleted
                          ? "text-zinc-200"
                          : "text-zinc-500 group-hover:text-zinc-400"
                      }`}
                    >
                      {s.title}
                    </p>
                    <p
                      className={`text-[11px] leading-tight mt-1 truncate ${
                        isCurrent
                          ? "text-zinc-400"
                          : isCompleted
                          ? "text-zinc-400"
                          : "text-zinc-600"
                      }`}
                    >
                      {s.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer Links */}
        <div className="pt-8 md:pt-0 mt-6 md:mt-0 flex items-center gap-4 text-xs text-zinc-500">
          <Link
            href="/dashboard"
            className="hover:text-zinc-300 transition-colors"
          >
            User settings
          </Link>
          <span className="text-zinc-700">·</span>
          <Link href="/" className="hover:text-zinc-300 transition-colors">
            Log out
          </Link>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ─── */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-[620px] bg-[#0d0e12] border border-white/[0.08] rounded-2xl p-6 sm:p-9 shadow-2xl relative">
          <AnimatePresence mode="wait">
            {/* ═════════ STEP 1: PERSONAL DETAILS ═════════ */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                    Personal Details
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    Tell us a bit about yourself so we can tailor your experience.
                  </p>
                </div>

                {/* Role Pill Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-200 block">
                    What best describes your role?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Founder / Solo Builder",
                      "Content Creator",
                      "Video Editor",
                      "Marketing Lead",
                      "Agency Owner",
                      "Streamer",
                      "Other",
                    ].map((role) => {
                      const isSelected = personalRole === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setPersonalRole(role)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#25272e] text-white border-white/30 shadow-sm"
                              : "bg-[#141519] text-zinc-400 border-white/[0.08] hover:bg-[#1b1c22] hover:text-zinc-300"
                          }`}
                        >
                          {role}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Name & Handle Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-200 block">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full rounded-xl bg-[#131417] border border-white/10 px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#2563eb] focus:ring-[3px] focus:ring-[#2563eb]/30 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-200 block">
                      Handle / Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@username"
                      className="w-full rounded-xl bg-[#131417] border border-white/10 px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#2563eb] focus:ring-[3px] focus:ring-[#2563eb]/30 transition-all"
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-200 block">
                    Location (optional)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. San Francisco, CA or Remote"
                    className="w-full rounded-xl bg-[#131417] border border-white/10 px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#2563eb] focus:ring-[3px] focus:ring-[#2563eb]/30 transition-all"
                  />
                </div>

                {/* Step 1 Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                  <Link
                    href="/"
                    className="text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                  >
                    Back to Home
                  </Link>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#e4e4e7] text-zinc-950 hover:bg-white transition-colors shadow-sm cursor-pointer"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ═════════ STEP 2: BUSINESS DETAILS ═════════ */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                    Business Details
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    Tell us about your organization and how you operate.
                  </p>
                </div>

                {/* Organization Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-200 block">
                    Organization / Brand Name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. RelatiV Media, Acme Studio"
                    className="w-full rounded-xl bg-[#131417] border border-white/10 px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#2563eb] focus:ring-[3px] focus:ring-[#2563eb]/30 transition-all"
                  />
                </div>

                {/* Team Size */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-200 block">
                    Team size
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {["Just me", "2–5 members", "6–20 members", "20+ members"].map(
                      (size) => {
                        const isSelected = teamSize === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setTeamSize(size)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-[#25272e] text-white border-white/30 shadow-sm"
                                : "bg-[#141519] text-zinc-400 border-white/[0.08] hover:bg-[#1b1c22] hover:text-zinc-300"
                            }`}
                          >
                            {size}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Primary Distribution Channel */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-200 block">
                    Primary distribution channel
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Direct Website / SaaS",
                      "YouTube & Shorts",
                      "TikTok & Instagram",
                      "Twitter / X",
                      "Podcast Platforms",
                      "Other",
                    ].map((chan) => {
                      const isSelected = primaryChannel === chan;
                      return (
                        <button
                          key={chan}
                          type="button"
                          onClick={() => setPrimaryChannel(chan)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#25272e] text-white border-white/30 shadow-sm"
                              : "bg-[#141519] text-zinc-400 border-white/[0.08] hover:bg-[#1b1c22] hover:text-zinc-300"
                          }`}
                        >
                          {chan}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2 Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#e4e4e7] text-zinc-950 hover:bg-white transition-colors shadow-sm cursor-pointer"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ═════════ STEP 3: PRODUCT DETAILS (POLAR REFERENCE SPEC) ═════════ */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Header */}
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                    Product Details
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    Help us understand what you&apos;re building so we can tailor
                    your experience.
                  </p>
                </div>

                {/* 1. What are you selling? (Pills) */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-200 block">
                    What are you selling?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        "Software / SaaS",
                        "Digital downloads",
                        "E-books or courses",
                        "Physical products",
                        "Services",
                        "Financial Trading",
                        "Advertising",
                        "Marketplace",
                        "Other",
                      ] as SellingType[]
                    ).map((item) => {
                      const isSelected = sellingTypes.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleSellingType(item)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#25272e] text-white border-white/30 shadow-sm"
                              : "bg-[#141519] text-zinc-400 border-white/[0.08] hover:bg-[#1b1c22] hover:text-zinc-300"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Describe your product (Textarea with exact blue focus halo & char count) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-200 block">
                    Describe your product
                  </label>
                  <div className="relative">
                    <textarea
                      value={productDescription}
                      onChange={(e) => setProductDescription(e.target.value)}
                      placeholder="Tell us about what you're selling..."
                      rows={2}
                      maxLength={3000}
                      className="w-full rounded-xl bg-[#141519] border border-white/10 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#2563eb] focus:ring-[3px] focus:ring-[#2563eb]/35 transition-all resize-none"
                    />
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {productDescription.length}/3000 (min 30)
                  </div>
                </div>

                {/* 3. Pricing model (Pills) */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-200 block">
                    Pricing model
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        "Subscription",
                        "Seat-based subscription",
                        "One-time purchase",
                        "Usage-based",
                      ] as PricingModel[]
                    ).map((model) => {
                      const isSelected = pricingModel === model;
                      return (
                        <button
                          key={model}
                          type="button"
                          onClick={() => setPricingModel(model)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#25272e] text-white border-white/30 shadow-sm"
                              : "bg-[#141519] text-zinc-400 border-white/[0.08] hover:bg-[#1b1c22] hover:text-zinc-300"
                          }`}
                        >
                          {model}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Currently selling on (optional) (Pills) */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-200 block">
                    Currently selling on{" "}
                    <span className="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        "Paddle",
                        "Lemon Squeezy",
                        "Gumroad",
                        "Stripe",
                        "Other",
                      ] as SellingPlatform[]
                    ).map((plat) => {
                      const isSelected = sellingPlatforms.includes(plat);
                      return (
                        <button
                          key={plat}
                          type="button"
                          onClick={() => togglePlatform(plat)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#25272e] text-white border-white/30 shadow-sm"
                              : "bg-[#141519] text-zinc-400 border-white/[0.08] hover:bg-[#1b1c22] hover:text-zinc-300"
                          }`}
                        >
                          {plat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Support Email & Product URL (Side-by-side) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-200 block">
                      Support Email{" "}
                      <span className="text-zinc-500 font-normal">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      placeholder="support@example.com"
                      className="w-full rounded-xl bg-[#141519] border border-white/10 px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#2563eb] focus:ring-[3px] focus:ring-[#2563eb]/35 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-200 block">
                      Product URL{" "}
                      <span className="text-zinc-500 font-normal">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="url"
                      value={productUrl}
                      onChange={(e) => setProductUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full rounded-xl bg-[#141519] border border-white/10 px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#2563eb] focus:ring-[3px] focus:ring-[#2563eb]/35 transition-all"
                    />
                  </div>
                </div>

                {/* 6. Bottom Actions: Back on left, Launch Dashboard on right */}
                <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={handleLaunchDashboard}
                    className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#e4e4e7] text-zinc-950 hover:bg-white transition-colors shadow-sm cursor-pointer"
                  >
                    Launch Dashboard
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07080a] flex items-center justify-center text-zinc-500 text-xs">
          Loading onboarding...
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
