"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Mail,
  Clock,
  Activity,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  MapPin,
  Loader2,
} from "lucide-react";
import { apiPath } from "@/lib/apiBase";

const VERIFIED_EMAIL = "engineering@relativ.dev";

export default function ContactPage() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const intent = params.get("intent");
      if (intent === "api") {
        setSubject("API & High-Volume Endpoint Inquiry");
      } else if (intent === "enterprise") {
        setSubject("Agency & Enterprise Inquiry");
      } else if (intent === "billing-support") {
        setSubject("Billing & Subscription Support");
      }
    }
  }, []);

  const handleCopyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(VERIFIED_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard permission is denied
    }
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();

      const trimmedEmail = email.trim();
      const trimmedSubject = subject.trim();
      const trimmedMessage = message.trim();

      if (!trimmedEmail || !trimmedSubject || !trimmedMessage) {
        setError("All fields are required. Please fill in your email, subject, and message.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setError("Please enter a valid email address.");
        return;
      }

      setError(null);
      setSending(true);

      try {
        const res = await fetch(apiPath("/api/v1/support/contact"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmedEmail,
            subject: trimmedSubject,
            message: trimmedMessage,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const detail =
            data?.detail ||
            data?.error ||
            "The message service is temporarily unavailable. Please email engineering@relativ.dev directly.";
          throw new Error(detail);
        }

        setSent(true);
        setEmail("");
        setSubject("");
        setMessage("");
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Could not send message. Please try again later or reach us directly at engineering@relativ.dev.";
        setError(msg);
      } finally {
        setSending(false);
      }
    },
    [email, subject, message]
  );

  return (
    <div className="relative min-h-[calc(100vh-80px)] bg-[#F7F8FA] dark:bg-[#05060A] text-[#111318] dark:text-[#F3F4F6] overflow-hidden selection:bg-indigo-500/30 selection:text-white">
      {/* Background optical effects & subtle dot matrix */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] dark:bg-[radial-gradient(#1A1F2C_1px,transparent_1px)] [background-size:24px_24px] opacity-40 dark:opacity-30" />

      {/* Atmospheric ambient glows */}
      <div className="pointer-events-none absolute top-12 right-0 w-[580px] h-[580px] bg-indigo-500/5 dark:bg-indigo-600/10 rounded-full blur-[150px]" />
      <div className="pointer-events-none absolute top-36 left-0 w-[420px] h-[420px] bg-amber-500/[0.03] dark:bg-amber-500/[0.04] rounded-full blur-[140px]" />

      {/* Main Container */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-14 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* ============================================================ */}
          {/* LEFT COLUMN — INFORMATION & EDITORIAL HERO                   */}
          {/* ============================================================ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 space-y-8"
          >
            {/* Monospace Telemetry Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono text-zinc-700 dark:text-white/70 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
              [Φ-CONTACT] · DIRECT LINE
            </div>

            {/* Editorial Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-bold text-zinc-950 dark:text-white tracking-tight leading-[1.08] font-display">
                Let&apos;s make something remarkable.
              </h1>
              <p className="text-base sm:text-lg text-zinc-600 dark:text-[#9CA3AF] leading-relaxed font-sans max-w-md">
                Have a question about RelatiV, need help with your workspace, or want to discuss a custom pipeline or enterprise workflow? Send us a message.
              </p>
            </div>

            {/* Structured Information Items */}
            <div className="space-y-3.5 pt-2">
              {/* Email Card with Quick Copy */}
              <div className="group relative rounded-2xl bg-white dark:bg-[#0B0D12] border border-black/[0.08] dark:border-white/[0.07] p-4 sm:p-5 shadow-sm dark:shadow-none transition-all hover:border-black/20 dark:hover:border-white/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-white/[0.05] border border-indigo-100 dark:border-white/[0.08] flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-sans font-medium uppercase tracking-wider text-zinc-500 dark:text-white/50 block">
                        Direct Engineering Email
                      </span>
                      <a
                        href={`mailto:${VERIFIED_EMAIL}`}
                        className="text-sm sm:text-base font-medium text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors font-sans"
                      >
                        {VERIFIED_EMAIL}
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    title="Copy email to clipboard"
                    className="p-2 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.08] transition-all cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Response Time Commitment */}
              <div className="rounded-2xl bg-white dark:bg-[#0B0D12] border border-black/[0.08] dark:border-white/[0.07] p-4 sm:p-5 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-white/[0.05] border border-amber-100 dark:border-white/[0.08] flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-sans font-medium uppercase tracking-wider text-zinc-500 dark:text-white/50 block">
                      Response Commitment
                    </span>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white font-sans">
                      Within 1 business day
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] mt-0.5 font-sans">
                      Messages route directly to our core engineering desk.
                    </p>
                  </div>
                </div>
              </div>

              {/* Verified Operational Status */}
              <div className="rounded-2xl bg-white dark:bg-[#0B0D12] border border-black/[0.08] dark:border-white/[0.07] p-4 sm:p-5 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-white/[0.05] border border-emerald-100 dark:border-white/[0.08] flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-sans font-medium uppercase tracking-wider text-zinc-500 dark:text-white/50 block">
                      Pipeline Operational Status
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                      <span className="text-sm font-medium text-zinc-900 dark:text-white font-sans">
                        Operational · All clipping clusters active
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Engineering Base / Origin */}
              <div className="rounded-2xl bg-white dark:bg-[#0B0D12] border border-black/[0.08] dark:border-white/[0.07] p-4 sm:p-5 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center text-zinc-700 dark:text-white/60">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-sans font-medium uppercase tracking-wider text-zinc-500 dark:text-white/50 block">
                      Headquarters
                    </span>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white font-sans">
                      Built in Bengaluru
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] mt-0.5 font-sans">
                      Engineering AI clipping infrastructure for creators worldwide.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ============================================================ */}
          {/* RIGHT COLUMN — ELEVATED CONTACT FORM CONTAINER               */}
          {/* ============================================================ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7"
          >
            <div className="relative rounded-3xl bg-white dark:bg-[#0B0D12] border border-black/[0.08] dark:border-white/[0.08] p-7 sm:p-10 shadow-xl dark:shadow-[0_0_60px_rgba(99,102,241,0.08)] backdrop-blur-xl overflow-hidden">
              {/* Soft illuminated internal top highlight */}
              <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/20 to-transparent" />
              <div className="pointer-events-none absolute -top-24 -right-24 w-52 h-52 bg-indigo-500/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                {/* Form Heading */}
                <div className="mb-7 pb-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                  <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight font-sans">
                    Send a message
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-[#9CA3AF] mt-1 font-sans">
                    Fill out the fields below and our team will get back to you directly.
                  </p>
                </div>

                {/* Status Banners */}
                <AnimatePresence mode="wait">
                  {sent ? (
                    <motion.div
                      key="sent-state"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="py-10 text-center space-y-4"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-white font-sans">
                        Message received
                      </h3>
                      <p className="text-sm text-zinc-600 dark:text-[#9CA3AF] max-w-md mx-auto leading-relaxed">
                        Thank you for reaching out. We&apos;ve logged your message and our engineering team will get back to you within one business day.
                      </p>
                      <div className="pt-4">
                        <button
                          type="button"
                          onClick={() => setSent(false)}
                          className="px-6 py-2.5 rounded-full bg-zinc-100 dark:bg-white/[0.06] border border-black/[0.1] dark:border-white/[0.1] text-sm text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.12] transition-colors cursor-pointer"
                        >
                          Send another message
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form-state"
                      onSubmit={handleSubmit}
                      className="space-y-5"
                      noValidate
                    >
                      {/* Error Banner */}
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/30 flex items-start gap-3"
                          role="alert"
                        >
                          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                          <div className="text-sm text-red-800 dark:text-red-200 leading-relaxed">
                            {error}
                          </div>
                        </motion.div>
                      )}

                      {/* Field: Email */}
                      <div>
                        <label
                          htmlFor="contact-email"
                          className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2 font-sans"
                        >
                          Email address <span className="text-indigo-600 dark:text-indigo-400">*</span>
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          disabled={sending}
                          autoComplete="email"
                          className="w-full bg-[#F0F2F6] dark:bg-[#06070B] border border-black/[0.1] dark:border-white/[0.1] rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 font-sans focus:outline-none focus:border-zinc-500 dark:focus:border-white/40 focus:ring-1 focus:ring-zinc-400/20 dark:focus:ring-white/20 transition-all disabled:opacity-50"
                        />
                      </div>

                      {/* Field: Subject */}
                      <div>
                        <label
                          htmlFor="contact-subject"
                          className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2 font-sans"
                        >
                          Subject <span className="text-indigo-600 dark:text-indigo-400">*</span>
                        </label>
                        <input
                          id="contact-subject"
                          type="text"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="What would you like to discuss?"
                          disabled={sending}
                          className="w-full bg-[#F0F2F6] dark:bg-[#06070B] border border-black/[0.1] dark:border-white/[0.1] rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 font-sans focus:outline-none focus:border-zinc-500 dark:focus:border-white/40 focus:ring-1 focus:ring-zinc-400/20 dark:focus:ring-white/20 transition-all disabled:opacity-50"
                        />
                      </div>

                      {/* Field: Message */}
                      <div>
                        <label
                          htmlFor="contact-message"
                          className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2 font-sans"
                        >
                          Message <span className="text-indigo-600 dark:text-indigo-400">*</span>
                        </label>
                        <textarea
                          id="contact-message"
                          rows={5}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Tell us a little about your question or project..."
                          disabled={sending}
                          className="w-full bg-[#F0F2F6] dark:bg-[#06070B] border border-black/[0.1] dark:border-white/[0.1] rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 font-sans focus:outline-none focus:border-zinc-500 dark:focus:border-white/40 focus:ring-1 focus:ring-zinc-400/20 dark:focus:ring-white/20 transition-all resize-none disabled:opacity-50"
                        />
                      </div>

                      {/* Primary Submit CTA */}
                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <button
                          type="submit"
                          disabled={sending}
                          className="w-full sm:w-auto px-8 py-3.5 bg-zinc-900 text-white dark:bg-white dark:text-black font-semibold rounded-full hover:bg-zinc-800 dark:hover:bg-[#F4F6FA] transition-all flex items-center justify-center gap-2 text-sm shadow-md dark:shadow-[0_0_25px_rgba(255,255,255,0.12)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {sending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white dark:text-black" />
                              <span>Sending message...</span>
                            </>
                          ) : (
                            <>
                              <span>Send message</span>
                              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </>
                          )}
                        </button>

                        <span className="text-xs text-zinc-500 dark:text-white/40 font-mono">
                          Protected by CORS &amp; rate limiting
                        </span>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
