"use client";

/**
 * /clippers/clips/new — Clip submission form.
 *
 *  - Accessed with ?claim_id=<id> in the URL
 *  - On mount, fetches myClaims() and locates the matching claim
 *  - Shows claim details (campaign name, CPM, deadline) at the top so
 *    the clipper is always looking at the brief they're fulfilling
 *  - Form fields with the same constraints the backend enforces:
 *      title:        3-300 chars
 *      hook:         3-500 chars
 *      caption:      3-4000 chars
 *      platform:     tiktok | instagram | youtube_shorts | twitter | x
 *      posted_url:   required URL
 *      duration_s:   5-180 (number)
 *      thumbnail_url:optional URL
 *  - On submit → submitClip(claimId, payload) → router.replace("/clippers/clips?submitted=1")
 *  - Auth-guard via useAuth() (loading / not-signed-in / wrong-role)
 *  - Loading / Error / Loaded / Submitting states
 *
 * Aesthetic: cream glass, fuchsia→violet primary buttons, monospace
 * labels, Instrument Serif accents — matches the rest of the clipper
 * surface. Wrapped in <Suspense> because of useSearchParams (Next 16).
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  DollarSign,
  LogIn,
  Target,
  Upload,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { myClaims, submitClip, type Claim } from "@/lib/api";

// ─── Field constraints (mirror the backend validation) ────────────────────
const TITLE_MIN = 3;
const TITLE_MAX = 300;
const HOOK_MIN = 3;
const HOOK_MAX = 500;
const CAPTION_MIN = 3;
const CAPTION_MAX = 4000;
const DURATION_MIN = 5;
const DURATION_MAX = 180;

const PLATFORM_OPTIONS: { value: string; label: string }[] = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram Reels" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "twitter", label: "X / Twitter" },
  { value: "x", label: "X (legacy)" },
];

// ─── Display helpers ──────────────────────────────────────────────────────
function formatCents(cents: number): string {
  if (!cents || cents <= 0) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "Rolling";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Rolling";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function isLikelyUrl(s: string): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ─── Section marker (consistent with the rest of the app) ────────────────
function SectionMarker({
  num,
  label,
  subtitle,
}: {
  num: string;
  label: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span
        className="text-[10px] font-mono tracking-widest tabular-nums"
        style={{ color: "var(--color-text-faint)" }}
      >
        {num}
      </span>
      <h1
        className="font-display font-semibold text-2xl md:text-3xl tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        {label}
      </h1>
      {subtitle && (
        <span
          className="text-[11px] font-mono ml-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

// ─── Skeleton block ───────────────────────────────────────────────────────
function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-[color:var(--color-surface)]/60 animate-pulse border border-[color:var(--color-border)] ${className}`}
    />
  );
}

// ─── Form field shell (label + hint + error) ──────────────────────────────
type FieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  counter?: string;
  required?: boolean;
  children: React.ReactNode;
};

function Field({ label, hint, error, counter, required, children }: FieldProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {label}
          {required && (
            <span style={{ color: "var(--color-accent)" }} className="ml-1">
              *
            </span>
          )}
        </label>
        {counter && (
          <span
            className="text-[10px] font-mono tabular-nums"
            style={{ color: "var(--color-text-faint)" }}
          >
            {counter}
          </span>
        )}
      </div>
      {children}
      {hint && !error && (
        <p
          className="mt-1.5 text-[11px]"
          style={{ color: "var(--color-text-faint)" }}
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          className="mt-1.5 text-[11px] inline-flex items-center gap-1"
          style={{ color: "var(--color-error)" }}
        >
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Claim banner (shows the brief the clipper is fulfilling) ────────────
function ClaimBanner({ claim }: { claim: Claim }) {
  const campaign = claim.campaign;
  const cpm = campaign?.cpm_cents ?? 0;
  const d = daysUntil(claim.deadline_at);
  const dText =
    d === null
      ? "Rolling deadline"
      : d < 0
      ? "Deadline passed"
      : d === 0
      ? "Due today"
      : d === 1
      ? "1 day left"
      : `${d} days left`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card p-5 mb-6 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(236, 72, 153, 0.04) 100%)",
        border: "1px solid rgba(139, 92, 246, 0.20)",
      }}
    >
      <div
        className="absolute -top-px left-0 right-0 h-1"
        style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)" }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] font-mono uppercase tracking-widest mb-1.5"
            style={{ color: "var(--color-text-faint)" }}
          >
            Submitting for claim
          </div>
          <h2
            className="font-display font-semibold text-lg leading-snug"
            style={{ color: "var(--color-text-primary)" }}
          >
            {campaign?.name || "Campaign"}
          </h2>
          {campaign?.vertical && (
            <p
              className="text-xs font-mono mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              {campaign.vertical.toUpperCase()}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div
            className="font-display font-semibold text-2xl tabular-nums leading-none"
            style={{ color: "#8B5CF6" }}
          >
            {formatCents(cpm)}
          </div>
          <div
            className="text-[10px] font-mono mt-1"
            style={{ color: "var(--color-text-faint)" }}
          >
            PER 1K VIEWS
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[color:var(--color-border)] flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
          <span
            className="text-[11px] font-mono"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Deadline · {formatDeadline(claim.deadline_at)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
          <span
            className="text-[11px] font-mono"
            style={{ color: d !== null && d <= 3 ? "var(--color-error)" : "var(--color-text-secondary)" }}
          >
            {dText}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
          <span
            className="text-[11px] font-mono"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Claim status · {claim.status}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Form payload type (matches ClipSubmitPayload in @/lib/api) ───────────
type Platform = "tiktok" | "instagram" | "youtube_shorts" | "twitter" | "x";

type FormState = {
  title: string;
  hook: string;
  caption: string;
  platform: Platform;
  posted_url: string;
  duration_s: string; // keep as string for the input
  thumbnail_url: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  hook: "",
  caption: "",
  platform: "tiktok",
  posted_url: "",
  duration_s: "30",
  thumbnail_url: "",
};

// ─── Inner page (uses useSearchParams → must be in a Suspense boundary) ──
function NewClipForm() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const claimId = search.get("claim_id");

  const [claim, setClaim] = useState<Claim | null>(null);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsError, setClaimsError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── Fetch the claim on mount (only once user is resolved) ────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (user.role !== "clipper") return;
    if (!claimId) return; // missing-claim-id handled in render

    let cancelled = false;
    setClaimsLoading(true);
    setClaimsError(null);
    myClaims()
      .then((res) => {
        if (cancelled) return;
        const found = (res.items || []).find((c) => c.id === claimId) || null;
        setClaim(found);
        if (!found) {
          setClaimsError(
            "We couldn't find that claim. It may belong to another account or has expired."
          );
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        setClaimsError(e?.message || "Failed to load your claims");
      })
      .finally(() => {
        if (!cancelled) setClaimsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, claimId]);

  // ─── Field change handler with clear-on-edit errors ────────────────────
  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
      setErrors((e) => ({ ...e, [key]: undefined }));
    },
    []
  );

  // ─── Validation (client-side mirror of backend constraints) ────────────
  const validate = useCallback((): Partial<Record<keyof FormState, string>> => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (form.title.trim().length < TITLE_MIN)
      e.title = `Title needs at least ${TITLE_MIN} characters.`;
    else if (form.title.length > TITLE_MAX)
      e.title = `Title must be ${TITLE_MAX} characters or fewer.`;

    if (form.hook.trim().length < HOOK_MIN)
      e.hook = `Hook needs at least ${HOOK_MIN} characters.`;
    else if (form.hook.length > HOOK_MAX)
      e.hook = `Hook must be ${HOOK_MAX} characters or fewer.`;

    if (form.caption.trim().length < CAPTION_MIN)
      e.caption = `Caption needs at least ${CAPTION_MIN} characters.`;
    else if (form.caption.length > CAPTION_MAX)
      e.caption = `Caption must be ${CAPTION_MAX} characters or fewer.`;

    if (!form.platform) e.platform = "Pick a platform.";

    if (!form.posted_url.trim()) e.posted_url = "Posted URL is required.";
    else if (!isLikelyUrl(form.posted_url.trim()))
      e.posted_url = "Must be a valid http(s) URL.";

    const dur = Number(form.duration_s);
    if (!Number.isFinite(dur))
      e.duration_s = "Duration must be a number.";
    else if (dur < DURATION_MIN || dur > DURATION_MAX)
      e.duration_s = `Duration must be between ${DURATION_MIN} and ${DURATION_MAX} seconds.`;

    if (form.thumbnail_url.trim() && !isLikelyUrl(form.thumbnail_url.trim()))
      e.thumbnail_url = "Must be a valid http(s) URL.";

    return e;
  }, [form]);

  // ─── Submit handler ────────────────────────────────────────────────────
  const onSubmit = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      if (!claimId) {
        setSubmitError("Missing claim_id in URL.");
        return;
      }
      const ve = validate();
      if (Object.keys(ve).length > 0) {
        setErrors(ve);
        return;
      }
      setSubmitting(true);
      setSubmitError(null);
      try {
        await submitClip(claimId, {
          title: form.title.trim(),
          hook: form.hook.trim(),
          caption: form.caption.trim(),
          platform: form.platform,
          posted_url: form.posted_url.trim(),
          duration_s: Math.round(Number(form.duration_s)),
          thumbnail_url: form.thumbnail_url.trim() || undefined,
        });
        // Hard navigate so the destination page re-fetches and shows the toast
        router.replace("/clippers/clips?submitted=1");
      } catch (e: any) {
        setSubmitError(e?.message || "Submission failed. Please try again.");
        setSubmitting(false);
      }
    },
    [claimId, form, router, validate]
  );

  // ─── Auth: still resolving ─────────────────────────────────────────────
  if (authLoading) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-32">
        <div
          className="inline-block h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#8B5CF6", borderTopColor: "transparent" }}
        />
      </section>
    );
  }

  // ─── Auth: not signed in ───────────────────────────────────────────────
  if (!user) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-32 pb-16">
        <div className="text-center max-w-sm">
          <LogIn className="h-8 w-8 mx-auto mb-3" style={{ color: "#8B5CF6" }} />
          <h1 className="font-display font-bold text-2xl mb-2">
            Sign in to submit a clip
          </h1>
          <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
            Sign in with your clipper account to continue.
          </p>
          <Link
            href={`/login?next=/clippers/clips/new?claim_id=${encodeURIComponent(claimId || "")}`}
            className="btn-primary btn-shine"
          >
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  // ─── Auth: wrong role ──────────────────────────────────────────────────
  if (user.role !== "clipper") {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-32 pb-16">
        <div className="text-center max-w-md">
          <div
            className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4"
            style={{
              background: "rgba(139, 92, 246, 0.10)",
              border: "1px solid rgba(139, 92, 246, 0.25)",
            }}
          >
            <Target className="h-6 w-6" style={{ color: "#8B5CF6" }} />
          </div>
          <h1 className="font-display font-bold text-2xl mb-2">
            Clipper accounts only
          </h1>
          <p
            className="text-sm mb-5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Only Pro/Elite clippers can submit clips. Your account is a{" "}
            <span className="font-mono text-[12px]">{user.role}</span>.
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/clippers/apply" className="btn-primary btn-shine">
              Apply as a clipper
            </Link>
            <Link
              href={
                user.role === "creator"
                  ? "/creators/dashboard"
                  : user.role === "brand"
                  ? "/brands/dashboard"
                  : "/account"
              }
              className="btn-secondary"
            >
              Go to my dashboard
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <section className="relative pt-28 md:pt-32 pb-20 px-4 md:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute top-0 left-1/3 h-[400px] w-[400px] rounded-full blur-3xl opacity-40"
          style={{
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.18) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/2 right-1/4 h-[350px] w-[350px] rounded-full blur-3xl opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(217, 70, 239, 0.16) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Back link */}
        <Link
          href="/clippers/campaigns"
          className="inline-flex items-center gap-1.5 text-[12px] font-mono mb-6 transition-colors"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to campaigns
        </Link>

        <SectionMarker
          num="01"
          label="Submit your clip"
          subtitle={
            claim ? `For · ${claim.campaign?.name || "Campaign"}` : undefined
          }
        />
        <p
          className="text-sm md:text-base max-w-2xl mt-2 mb-8"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <span className="font-serif italic" style={{ color: "var(--color-text-primary)" }}>
            Drop the link,
          </span>{" "}
          paste the hook, hit submit. The brand has 48 hours to approve.
        </p>

        {/* ─── Missing claim_id ────────────────────────────────────── */}
        {!claimId && (
          <div
            className="flex items-start gap-3 p-5 rounded-2xl border"
            style={{
              background: "rgba(239, 68, 68, 0.05)",
              borderColor: "rgba(239, 68, 68, 0.30)",
            }}
          >
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#EF4444" }} />
            <div className="flex-1 text-sm">
              <p
                className="font-semibold mb-0.5"
                style={{ color: "var(--color-text-primary)" }}
              >
                No claim selected
              </p>
              <p style={{ color: "var(--color-text-secondary)" }}>
                This form needs a <span className="font-mono">claim_id</span> in
                the URL. Claim a campaign first, then come back here.
              </p>
              <Link
                href="/clippers/campaigns"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: "#8B5CF6" }}
              >
                Browse campaigns <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* ─── Claim not found ─────────────────────────────────────── */}
        {claimId && !claimsLoading && claimsError && (
          <div
            className="flex items-start gap-3 p-5 rounded-2xl border"
            style={{
              background: "rgba(239, 68, 68, 0.05)",
              borderColor: "rgba(239, 68, 68, 0.30)",
            }}
          >
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#EF4444" }} />
            <div className="flex-1 text-sm">
              <p
                className="font-semibold mb-0.5"
                style={{ color: "var(--color-text-primary)" }}
              >
                {claimsError}
              </p>
              <p style={{ color: "var(--color-text-secondary)" }}>
                Pick a fresh claim from the campaign board.
              </p>
              <Link
                href="/clippers/campaigns"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: "#8B5CF6" }}
              >
                Browse campaigns <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* ─── Loading claims ──────────────────────────────────────── */}
        {claimId && claimsLoading && (
          <div className="space-y-4">
            <SkeletonBlock className="h-32" />
            <SkeletonBlock className="h-96" />
          </div>
        )}

        {/* ─── Loaded: claim + form ────────────────────────────────── */}
        {claimId && !claimsLoading && claim && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <ClaimBanner claim={claim} />

            {/* Submit error banner */}
            <AnimatePresence>
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-5 flex items-start gap-3 p-4 rounded-2xl border"
                  style={{
                    background: "rgba(239, 68, 68, 0.05)",
                    borderColor: "rgba(239, 68, 68, 0.30)",
                  }}
                >
                  <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#EF4444" }} />
                  <div className="flex-1 text-sm">
                    <p
                      className="font-semibold mb-0.5"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      Submission failed
                    </p>
                    <p style={{ color: "var(--color-text-secondary)" }}>{submitError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubmitError(null)}
                    className="text-xs font-mono"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Dismiss
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <form
              onSubmit={onSubmit}
              noValidate
              className="glass-card p-6 md:p-8 space-y-5"
            >
              <Field
                label="Title"
                hint="A short, hook-first label. The brand sees this first."
                required
                counter={`${form.title.length} / ${TITLE_MAX}`}
                error={errors.title}
              >
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  maxLength={TITLE_MAX}
                  placeholder="e.g. The 30-second cold-email template that booked 12 calls"
                  className="input-glass"
                  autoFocus
                />
              </Field>

              <Field
                label="Hook"
                hint="The first 1-2 lines of the clip — what made people stop scrolling."
                required
                counter={`${form.hook.length} / ${HOOK_MAX}`}
                error={errors.hook}
              >
                <input
                  type="text"
                  value={form.hook}
                  onChange={(e) => update("hook", e.target.value)}
                  maxLength={HOOK_MAX}
                  placeholder="e.g. Most cold emails fail because they start with 'I'."
                  className="input-glass"
                />
              </Field>

              <Field
                label="Caption"
                hint="Full caption with hashtags, mentions, and any FTC disclosure."
                required
                counter={`${form.caption.length} / ${CAPTION_MAX}`}
                error={errors.caption}
              >
                <textarea
                  value={form.caption}
                  onChange={(e) => update("caption", e.target.value)}
                  maxLength={CAPTION_MAX}
                  rows={5}
                  placeholder="Paste the exact caption you posted (or will post). Include #ad if required."
                  className="input-glass resize-y min-h-[120px]"
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field
                  label="Platform"
                  required
                  error={errors.platform}
                >
                  <select
                    value={form.platform}
                    onChange={(e) => update("platform", e.target.value as Platform)}
                    className="input-glass"
                  >
                    {PLATFORM_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Duration (seconds)"
                  required
                  hint={`${DURATION_MIN}–${DURATION_MAX}s`}
                  error={errors.duration_s}
                >
                  <input
                    type="number"
                    min={DURATION_MIN}
                    max={DURATION_MAX}
                    value={form.duration_s}
                    onChange={(e) => update("duration_s", e.target.value)}
                    className="input-glass tabular-nums"
                  />
                </Field>
              </div>

              <Field
                label="Posted URL"
                hint="Public link to the live clip on the platform."
                required
                error={errors.posted_url}
              >
                <input
                  type="url"
                  value={form.posted_url}
                  onChange={(e) => update("posted_url", e.target.value)}
                  placeholder="https://www.tiktok.com/@you/video/..."
                  className="input-glass"
                />
              </Field>

              <Field
                label="Thumbnail URL"
                hint="Optional. A direct image link (.jpg / .png / .webp)."
                error={errors.thumbnail_url}
              >
                <input
                  type="url"
                  value={form.thumbnail_url}
                  onChange={(e) => update("thumbnail_url", e.target.value)}
                  placeholder="https://..."
                  className="input-glass"
                />
              </Field>

              <div
                className="pt-2 mt-2 border-t border-[color:var(--color-border)] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <Link
                  href="/clippers/clips"
                  className="text-[12px] font-mono"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-shine inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-full text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-wait disabled:hover:translate-y-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
                    boxShadow: "0 6px 18px rgba(139, 92, 246, 0.35)",
                  }}
                >
                  {submitting ? (
                    <>
                      <span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"
                        aria-hidden
                      />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Submit clip for review
                    </>
                  )}
                </button>
              </div>
            </form>

            <p
              className="text-[11px] font-mono text-center mt-6"
              style={{ color: "var(--color-text-faint)" }}
            >
              RelatiV verifies view counts every Sunday. Payouts every Monday.
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
}

// ─── Suspense-wrapped default export ─────────────────────────────────────
export default function NewClipPage() {
  return (
    <Suspense fallback={null}>
      <NewClipForm />
    </Suspense>
  );
}
