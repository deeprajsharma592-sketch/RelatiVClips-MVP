"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import {
  HelpCircle,
  ArrowLeft,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  Loader2,
  LifeBuoy,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { apiPath } from "@/lib/apiBase";

const SUPPORT_EMAIL = "engineering@relativ.dev";

const CATEGORIES = [
  "Video Processing / Stuck Job",
  "Billing & Credits",
  "YouTube & Social Publishing",
  "API Access & Webhooks",
  "Account & Privacy",
  "Bug Report",
];

const FAQS = [
  {
    q: "My video is taking longer than expected to process. What should I do?",
    a: "Longer source videos (30–90+ minutes) typically complete in 2–5 minutes. If a job appears stalled for more than 10 minutes, raise a ticket below with your Project or Task ID so our engineering team can inspect the worker logs.",
  },
  {
    q: "How do credits work when generating clips?",
    a: "Credits are only deducted when clips are generated. Failed jobs do not consume credits. You can view your balance in the Studio sidebar or upgrade anytime under Plans.",
  },
  {
    q: "How do I schedule clips directly to YouTube Shorts?",
    a: "Open Social Accounts in your Studio dashboard and connect your Google / YouTube channel via OAuth. Once linked, click the calendar icon on any generated clip to schedule it.",
  },
  {
    q: "How can I export or delete my feedback and preference data?",
    a: "You can export or permanently erase your feedback history at any time via your account privacy settings or by emailing our support team from your registered address.",
  },
];

export default function HelpCenterPage() {
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState<"Normal" | "High">("Normal");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user?.email, email]);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    const trimmedDesc = description.trim();

    if (!trimmedEmail || !trimmedSubject || !trimmedDesc) {
      setError("Please fill in your email, subject, and issue description.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(apiPath("/api/v1/support/contact"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          subject: `[${category} · ${priority}] ${trimmedSubject}`.slice(0, 200),
          message: trimmedDesc.slice(0, 4000),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.detail || "Support service is temporarily unavailable. Please email engineering@relativ.dev directly."
        );
      }

      const generatedRef = `RLV-${Math.floor(100000 + Math.random() * 900000)}`;
      setTicketId(generatedRef);
      setSubject("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0B0E] text-[#F4F1E8] pt-28 pb-24">
      <div className="mx-auto max-w-6xl px-6">
        {/* Top Bar */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#141517] px-3.5 py-2 text-xs text-[#b6b7bc] transition hover:border-white/20 hover:text-white"
          >
            <ArrowLeft size={14} />
            Back to Studio
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E7B84B]/30 bg-[#E7B84B]/10 px-3 py-1 font-mono text-[11px] text-[#E7B84B]">
            <HelpCircle size={12} />
            Help Center & Support
          </span>
        </div>

        {/* Hero */}
        <section className="border-b border-white/10 pb-10">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[#F4F1E8] sm:text-5xl">
            How can we help?
          </h1>
          <p className="mt-4 max-w-2xl text-base text-[#a2a3aa]">
            Raise a support ticket directly with our engineering team or send an email to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#67D8DF] underline underline-offset-4">
              {SUPPORT_EMAIL}
            </a>
            . We respond to every ticket within 24 hours.
          </p>
        </section>

        {/* Main 2-Col Grid: Ticket Form + Email/FAQ */}
        <section className="mt-12 grid gap-10 lg:grid-cols-12">
          {/* Left: Raise a Support Ticket */}
          <div className="lg:col-span-7">
            <div className="rounded-xl border border-white/10 bg-[#141517] p-6 sm:p-8">
              <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
                <LifeBuoy size={18} className="text-[#E7B84B]" />
                <h2 className="font-display text-xl font-semibold text-white">Raise a Support Ticket</h2>
              </div>

              {ticketId ? (
                <div className="mt-6 rounded-xl border border-[#A8FF4F]/30 bg-[#A8FF4F]/10 p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#A8FF4F]" />
                    <div>
                      <p className="font-semibold text-white">
                        Ticket submitted ({ticketId})
                      </p>
                      <p className="mt-1.5 text-sm text-[#c8c9cd]">
                        Our support and engineering team has received your issue and will reply to your email within 24 hours.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTicketId(null)}
                        className="mt-4 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                      >
                        Submit another ticket
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                  {error && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200">
                      <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#b6b7bc]">
                        Your Email
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full rounded-lg border border-white/15 bg-[#0A0B0E] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#E7B84B] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#b6b7bc]">
                        Issue Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-[#0A0B0E] px-3.5 py-2.5 text-sm text-white focus:border-[#E7B84B] focus:outline-none"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-[#b6b7bc]">
                        Subject
                      </label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Brief summary of the issue"
                        className="w-full rounded-lg border border-white/15 bg-[#0A0B0E] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#E7B84B] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#b6b7bc]">
                        Priority
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-white/15 bg-[#0A0B0E] p-1">
                        {(["Normal", "High"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPriority(p)}
                            className={`rounded-md py-1.5 text-xs font-medium transition ${
                              priority === p
                                ? p === "High"
                                  ? "bg-amber-500/25 text-amber-300"
                                  : "bg-white/15 text-white"
                                : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#b6b7bc]">
                      Issue Details
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what happened, steps to reproduce, and any Task ID or YouTube URL if applicable..."
                      className="w-full rounded-lg border border-white/15 bg-[#0A0B0E] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#E7B84B] focus:outline-none resize-y"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#E7B84B] px-5 py-3 text-sm font-semibold text-[#07080B] transition hover:brightness-110 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Submitting Ticket...
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        Submit Support Ticket
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right: Mail Support Team + FAQs */}
          <div className="lg:col-span-5 space-y-6">
            {/* Mail our Support Team */}
            <div className="rounded-xl border border-white/10 bg-[#141517] p-6">
              <div className="flex items-center gap-2.5">
                <Mail size={18} className="text-[#67D8DF]" />
                <h2 className="font-display text-lg font-semibold text-white">
                  Mail Our Support Team
                </h2>
              </div>
              <p className="mt-2 text-sm text-[#9b9ca3]">
                Prefer to send screenshots, screen recordings, or logs directly from your inbox? Email us anytime.
              </p>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-[#0A0B0E] px-3.5 py-2.5">
                <span className="font-mono text-xs text-[#F4F1E8]">{SUPPORT_EMAIL}</span>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[#9b9ca3] transition hover:bg-white/10 hover:text-white"
                >
                  {copiedEmail ? <Check size={13} className="text-[#A8FF4F]" /> : <Copy size={13} />}
                  {copiedEmail ? "Copied" : "Copy"}
                </button>
              </div>

              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("RelatiV Support Request")}`}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#67D8DF]/40 bg-[#67D8DF]/10 px-4 py-2.5 text-sm font-medium text-[#67D8DF] transition hover:bg-[#67D8DF]/20"
              >
                <Mail size={15} />
                Open Mail Client
              </a>
            </div>

            {/* Quick Troubleshooting FAQ */}
            <div className="rounded-xl border border-white/10 bg-[#141517] p-6">
              <h2 className="font-display text-lg font-semibold text-white mb-4">
                Common Questions
              </h2>
              <div className="divide-y divide-white/10">
                {FAQS.map((item, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div key={item.q} className="py-3 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-[#e5e5e7] hover:text-white"
                      >
                        <span>{item.q}</span>
                        <ChevronDown
                          size={15}
                          className={`shrink-0 text-[#8f9095] transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <p className="mt-2 text-xs leading-relaxed text-[#9b9ca3]">
                          {item.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
