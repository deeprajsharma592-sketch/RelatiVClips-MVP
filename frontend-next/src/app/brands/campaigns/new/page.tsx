"use client";

/**
 * /brands/campaigns/new — Brand campaign creation form.
 *
 * Drop a brief, pick a vertical, set CPM, budget, and slot count. On
 * submit we POST to /api/v1/campaigns (lib/api.createCampaign) and push
 * the user to the new campaign's detail page.
 *
 * v1: Floats the label / field pair (a "floating-label" pattern is too
 * fragile across browsers, so we just use a static sub-label in monospace
 * above each input — matches the cream-glass language of the rest of the
 * auth/forms surfaces).
 *
 * Sections:
 *  01 · Header       — title + breadcrumb back to /brands/campaigns
 *  02 · Brief        — name, brief, vertical, source handle
 *  03 · Payout terms — CPM, budget, slots, end date
 *  04 · Submit       — primary CTA + cancel link
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  LogIn,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { createCampaign, type CampaignCreatePayload } from "@/lib/api";

const VERTICALS = [
  "Podcasts · Tech",
  "Podcasts · Business",
  "Podcasts · Health",
  "Education · AI",
  "Lifestyle",
  "Other",
] as const;
type Vertical = (typeof VERTICALS)[number];

interface FormState {
  name: string;
  brief: string;
  vertical: Vertical | "";
  source_handle: string;
  cpm_dollars: string;
  budget_dollars: string;
  slots_total: string;
  ends_at: string;
}

const INITIAL: FormState = {
  name: "",
  brief: "",
  vertical: "",
  source_handle: "",
  cpm_dollars: "7",
  budget_dollars: "1000",
  slots_total: "5",
  ends_at: "",
};

interface FieldErrors {
  name?: string;
  brief?: string;
  vertical?: string;
  source_handle?: string;
  cpm_dollars?: string;
  budget_dollars?: string;
  slots_total?: string;
  ends_at?: string;
}

// ─── Field — labeled monospace "01 · LABEL" + control + helper ──────────

function Field({
  num,
  label,
  required,
  hint,
  error,
  children,
}: {
  num: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span
          className="text-[10px] font-mono tracking-widest tabular-nums"
          style={{ color: "var(--color-text-faint)" }}
        >
          {num}
        </span>
        <label
          className="text-[11px] font-mono uppercase tracking-widest font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          {label}
          {required && (
            <span style={{ color: "var(--color-accent)" }} className="ml-1">
              *
            </span>
          )}
        </label>
        {hint && (
          <span
            className="text-[10px] font-mono ml-auto"
            style={{ color: "var(--color-text-faint)" }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <div
          className="mt-1.5 text-[11px] flex items-start gap-1.5"
          style={{ color: "var(--color-error)" }}
        >
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ─── Form input — same .input-glass styling, with custom focus state ─────

const inputBaseStyle: React.CSSProperties = {
  background: "rgba(255, 252, 242, 0.7)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  padding: "12px 16px",
  fontSize: "15px",
  color: "var(--color-text-primary)",
  transition: "all 0.2s ease",
  width: "100%",
};

function focusBorder(focused: boolean, error?: string): React.CSSProperties {
  if (error) return { borderColor: "var(--color-error)" };
  if (focused) {
    return {
      borderColor: "var(--color-accent)",
      boxShadow: "0 0 0 4px rgba(217, 70, 239, 0.12)",
      background: "rgba(255, 252, 242, 0.95)",
    };
  }
  return {};
}

// ─── Main component ──────────────────────────────────────────────────────

export default function NewCampaignPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [focused, setFocused] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Update a single field — used everywhere to keep the call site tight
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  // Live char counters
  const nameLen = form.name.length;
  const briefLen = form.brief.length;

  // Live totals — useful preview of what the brand will commit to
  const totalReachCents = useMemo(() => {
    const cpm = Number(form.cpm_dollars);
    const budget = Number(form.budget_dollars);
    if (!Number.isFinite(cpm) || !Number.isFinite(budget) || cpm <= 0) return 0;
    return Math.floor((budget / cpm) * 1000);
  }, [form.cpm_dollars, form.budget_dollars]);

  // Field-level validation
  const validate = (f: FormState): FieldErrors => {
    const e: FieldErrors = {};
    const name = f.name.trim();
    const brief = f.brief.trim();
    if (name.length < 3) e.name = "Name must be at least 3 characters.";
    else if (name.length > 200) e.name = "Name must be 200 characters or fewer.";
    if (brief.length < 10) e.brief = "Brief must be at least 10 characters.";
    else if (brief.length > 4000) e.brief = "Brief must be 4000 characters or fewer.";
    if (!f.vertical) e.vertical = "Pick a vertical — that's how we route to clippers.";
    if (f.source_handle && f.source_handle.length > 64)
      e.source_handle = "Source handle is too long (max 64).";
    if (f.source_handle && !/^@?[A-Za-z0-9._-]{1,64}$/.test(f.source_handle))
      e.source_handle = "Use letters, digits, dot, dash, underscore. Optional @ prefix.";
    const cpm = Number(f.cpm_dollars);
    if (!Number.isFinite(cpm) || cpm < 1) e.cpm_dollars = "CPM must be at least $1.";
    else if (cpm > 1000) e.cpm_dollars = "CPM must be $1,000 or less.";
    const budget = Number(f.budget_dollars);
    if (!Number.isFinite(budget) || budget < 10) e.budget_dollars = "Budget must be at least $10.";
    else if (budget > 100000) e.budget_dollars = "Budget must be $100,000 or less.";
    const slots = Number(f.slots_total);
    if (!Number.isFinite(slots) || !Number.isInteger(slots) || slots < 1)
      e.slots_total = "Slots must be a whole number ≥ 1.";
    else if (slots > 100) e.slots_total = "Slots must be 100 or fewer.";
    if (f.ends_at) {
      const d = new Date(f.ends_at);
      if (isNaN(d.getTime())) e.ends_at = "End date is invalid.";
    }
    return e;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const v = validate(form);
    setErrors(v);
    if (Object.values(v).some(Boolean)) {
      // scroll to first error
      const first = Object.keys(v)[0];
      const el = document.getElementById(`field-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: CampaignCreatePayload = {
        name: form.name.trim(),
        brief: form.brief.trim(),
        vertical: form.vertical || undefined,
        source_handle: form.source_handle ? form.source_handle.trim().replace(/^@/, "") : undefined,
        cpm_cents: Math.round(Number(form.cpm_dollars) * 100),
        budget_cents: Math.round(Number(form.budget_dollars) * 100),
        slots_total: Number(form.slots_total),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };
      const created = await createCampaign(payload);
      router.push(`/brands/campaigns/${created.id}`);
    } catch (err: any) {
      const msg = err?.message || "Failed to create campaign.";
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  // ─── Auth states ─────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4">
        <div
          className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }}
        />
      </section>
    );
  }

  if (!user) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-24">
        <div className="text-center max-w-sm">
          <LogIn className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--color-accent)" }} />
          <h1 className="font-display font-semibold text-2xl mb-2">Sign in to continue</h1>
          <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
            You need a RelatiV brand account to create a campaign.
          </p>
          <Link
            href={`/signup?next=${encodeURIComponent("/brands/campaigns/new")}&role=brand`}
            className="btn-primary btn-shine inline-flex"
          >
            Create brand account
          </Link>
        </div>
      </section>
    );
  }

  if (user.role !== "brand") {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-24">
        <div
          className="glass-card p-10 text-center max-w-md"
          style={{ borderStyle: "dashed" }}
        >
          <AlertCircle
            className="h-8 w-8 mx-auto mb-3"
            style={{ color: "var(--color-accent-coral, #FB7185)" }}
          />
          <h1 className="font-display font-semibold text-2xl mb-2">
            Brand accounts only
          </h1>
          <p
            className="text-sm max-w-sm mx-auto mb-5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Only brand accounts can launch campaigns. Your current role is{" "}
            <span
              className="font-mono text-xs px-1.5 py-0.5 rounded"
              style={{ background: "rgba(60,50,30,0.06)" }}
            >
              {user.role}
            </span>
            .
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              href={
                user.role === "creator"
                  ? "/creators/dashboard"
                  : user.role === "clipper"
                  ? "/clippers/dashboard"
                  : "/account"
              }
              className="btn-glass inline-flex"
            >
              My dashboard
            </Link>
            <Link
              href={`/signup?next=${encodeURIComponent("/brands/campaigns/new")}&role=brand`}
              className="btn-primary btn-shine inline-flex"
            >
              Create brand account
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ─── Form view ───────────────────────────────────────────────────────

  const v = validate(form);
  const isValid = Object.values(v).every((x) => !x);

  return (
    <section
      className="relative min-h-screen pt-28 pb-20 px-4 md:px-6 animate-page-enter"
    >
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 -right-20 h-[600px] w-[600px] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(217, 70, 239, 0.20) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/2 -left-20 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(139, 92, 246, 0.18) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative max-w-3xl mx-auto">
        {/* ─── 01 · HEADER ─── */}
        <header className="mb-10">
          <Link
            href="/brands/campaigns"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono mb-4 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-muted)";
            }}
          >
            <ArrowLeft className="h-3 w-3" />
            Back to campaigns
          </Link>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: "var(--color-text-faint)" }}
            >
              01
            </span>
            <span
              className="h-px w-10"
              style={{ background: "var(--color-border-strong)" }}
            />
            <span
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: "var(--color-text-faint)" }}
            >
              New campaign
            </span>
          </div>
          <h1
            className="font-display font-semibold text-3xl md:text-5xl tracking-tight leading-[1.05]"
            style={{ color: "var(--color-text-primary)" }}
          >
            Launch a new{" "}
            <span className="hero-text text-gradient-sunset" style={{ fontSize: "1.05em" }}>
              campaign
            </span>
            .
          </h1>
          <p
            className="mt-2 text-[15px] max-w-xl"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Drop a brief, set your CPM and budget, and our clipper network will
            start delivering platform-ready clips within 48 hours.
          </p>
        </header>

        {/* ─── FORM CARD ─── */}
        <form onSubmit={onSubmit} noValidate>
          <div className="glass-panel p-6 md:p-8 space-y-8">
            {/* ─── 02 · BRIEF ─── */}
            <section>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-mono tracking-widest"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  02
                </span>
                <span
                  className="h-px w-8"
                  style={{ background: "var(--color-border-strong)" }}
                />
                <span
                  className="text-[10px] font-mono uppercase tracking-widest"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  The brief
                </span>
              </div>
              <h2
                className="font-display font-semibold text-xl mb-5"
                style={{ color: "var(--color-text-primary)" }}
              >
                Tell clippers what to make
              </h2>

              <div className="space-y-5">
                <Field
                  num="01"
                  label="Campaign name"
                  required
                  hint={`${nameLen} / 200`}
                  error={errors.name}
                >
                  <input
                    id="field-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                    placeholder="Q3 founder-mode series"
                    maxLength={200}
                    style={{ ...inputBaseStyle, ...focusBorder(focused === "name", errors.name) }}
                  />
                </Field>

                <Field
                  num="02"
                  label="Brief"
                  required
                  hint={`${briefLen} / 4000`}
                  error={errors.brief}
                >
                  <textarea
                    id="field-brief"
                    value={form.brief}
                    onChange={(e) => set("brief", e.target.value)}
                    onFocus={() => setFocused("brief")}
                    onBlur={() => setFocused(null)}
                    placeholder="What kind of clips? Tone, hooks, do-nots, call-to-action, FTC notes…"
                    rows={6}
                    maxLength={4000}
                    style={{
                      ...inputBaseStyle,
                      ...focusBorder(focused === "brief", errors.brief),
                      resize: "vertical",
                      minHeight: "120px",
                      fontFamily: "inherit",
                    }}
                  />
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field num="03" label="Vertical" required error={errors.vertical}>
                    <select
                      id="field-vertical"
                      value={form.vertical}
                      onChange={(e) => set("vertical", e.target.value as Vertical | "")}
                      onFocus={() => setFocused("vertical")}
                      onBlur={() => setFocused(null)}
                      style={{
                        ...inputBaseStyle,
                        ...focusBorder(focused === "vertical", errors.vertical),
                        appearance: "none",
                        backgroundImage:
                          'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 20 20\' fill=\'%238B8472\'><path fill-rule=\'evenodd\' d=\'M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z\' clip-rule=\'evenodd\'/></svg>")',
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 14px center",
                        backgroundSize: "16px",
                        paddingRight: "40px",
                      }}
                    >
                      <option value="" disabled>
                        Pick one…
                      </option>
                      {VERTICALS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    num="04"
                    label="Source handle"
                    hint="@optional"
                    error={errors.source_handle}
                  >
                    <input
                      id="field-source_handle"
                      type="text"
                      value={form.source_handle}
                      onChange={(e) => set("source_handle", e.target.value)}
                      onFocus={() => setFocused("source_handle")}
                      onBlur={() => setFocused(null)}
                      placeholder="@yourpodcast"
                      maxLength={64}
                      style={{
                        ...inputBaseStyle,
                        ...focusBorder(focused === "source_handle", errors.source_handle),
                      }}
                    />
                  </Field>
                </div>
              </div>
            </section>

            {/* ─── 03 · PAYOUT TERMS ─── */}
            <section>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-mono tracking-widest"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  03
                </span>
                <span
                  className="h-px w-8"
                  style={{ background: "var(--color-border-strong)" }}
                />
                <span
                  className="text-[10px] font-mono uppercase tracking-widest"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  Payout terms
                </span>
              </div>
              <h2
                className="font-display font-semibold text-xl mb-5"
                style={{ color: "var(--color-text-primary)" }}
              >
                How much, how many
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field
                  num="05"
                  label="CPM"
                  required
                  hint="$1 – $1,000"
                  error={errors.cpm_dollars}
                >
                  <div className="relative">
                    <span
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-mono pointer-events-none"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      $
                    </span>
                    <input
                      id="field-cpm_dollars"
                      type="number"
                      min={1}
                      max={1000}
                      step="0.01"
                      value={form.cpm_dollars}
                      onChange={(e) => set("cpm_dollars", e.target.value)}
                      onFocus={() => setFocused("cpm_dollars")}
                      onBlur={() => setFocused(null)}
                      style={{
                        ...inputBaseStyle,
                        ...focusBorder(focused === "cpm_dollars", errors.cpm_dollars),
                        paddingLeft: "32px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    />
                    <span
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono pointer-events-none"
                      style={{ color: "var(--color-text-faint)" }}
                    >
                      per 1k views
                    </span>
                  </div>
                </Field>

                <Field
                  num="06"
                  label="Total budget"
                  required
                  hint="$10 – $100,000"
                  error={errors.budget_dollars}
                >
                  <div className="relative">
                    <span
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-mono pointer-events-none"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      $
                    </span>
                    <input
                      id="field-budget_dollars"
                      type="number"
                      min={10}
                      max={100000}
                      step="1"
                      value={form.budget_dollars}
                      onChange={(e) => set("budget_dollars", e.target.value)}
                      onFocus={() => setFocused("budget_dollars")}
                      onBlur={() => setFocused(null)}
                      style={{
                        ...inputBaseStyle,
                        ...focusBorder(focused === "budget_dollars", errors.budget_dollars),
                        paddingLeft: "32px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    />
                  </div>
                </Field>

                <Field
                  num="07"
                  label="Slots"
                  required
                  hint="1 – 100 clippers"
                  error={errors.slots_total}
                >
                  <input
                    id="field-slots_total"
                    type="number"
                    min={1}
                    max={100}
                    step="1"
                    value={form.slots_total}
                    onChange={(e) => set("slots_total", e.target.value)}
                    onFocus={() => setFocused("slots_total")}
                    onBlur={() => setFocused(null)}
                    style={{
                      ...inputBaseStyle,
                      ...focusBorder(focused === "slots_total", errors.slots_total),
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                </Field>

                <Field num="08" label="End date" hint="optional" error={errors.ends_at}>
                  <input
                    id="field-ends_at"
                    type="date"
                    value={form.ends_at}
                    onChange={(e) => set("ends_at", e.target.value)}
                    onFocus={() => setFocused("ends_at")}
                    onBlur={() => setFocused(null)}
                    style={{
                      ...inputBaseStyle,
                      ...focusBorder(focused === "ends_at", errors.ends_at),
                      colorScheme: "light",
                    }}
                  />
                </Field>
              </div>

              {/* Live preview — what the brand is committing to */}
              <motion.div
                layout
                className="mt-6 rounded-[var(--radius-md)] p-4"
                style={{
                  background: "rgba(217, 70, 239, 0.05)",
                  border: "1px solid rgba(217, 70, 239, 0.20)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--color-accent)" }}
                  />
                  <span
                    className="text-[10px] font-mono uppercase tracking-widest"
                    style={{ color: "var(--color-accent)" }}
                  >
                    Live preview
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <PreviewStat
                    label="Reach"
                    value={
                      totalReachCents > 0
                        ? `${totalReachCents.toLocaleString()} views`
                        : "—"
                    }
                  />
                  <PreviewStat
                    label="Per-clip pay"
                    value={
                      Number(form.cpm_dollars) > 0
                        ? `$${(
                            (Number(form.cpm_dollars) * 0.7) /
                            100
                          ).toFixed(2)} avg`
                        : "—"
                    }
                  />
                  <PreviewStat
                    label="Slots"
                    value={
                      Number(form.slots_total) > 0
                        ? `${form.slots_total} clippers`
                        : "—"
                    }
                  />
                </div>
              </motion.div>
            </section>

            {/* ─── 04 · SUBMIT ─── */}
            <section>
              {/* Backend error */}
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 px-4 py-3 rounded-2xl text-[13px] flex items-start gap-2"
                  style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    color: "var(--color-error)",
                  }}
                >
                  <span className="mt-0.5">⚠</span>
                  <span className="flex-1">{submitError}</span>
                </motion.div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-2">
                <div
                  className="text-[11px] font-mono flex items-center gap-1.5"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  {isValid ? (
                    <>
                      <Check className="h-3 w-3" style={{ color: "var(--color-success)" }} />
                      <span>Ready to launch</span>
                    </>
                  ) : (
                    <span>Fill the required fields to continue</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link href="/brands/campaigns" className="btn-glass">
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary btn-shine inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <span>Launch campaign</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </form>
      </div>
    </section>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[10px] font-mono uppercase tracking-widest mb-0.5"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </div>
      <div
        className="font-display font-semibold text-base tabular-nums"
        style={{ color: "var(--color-text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}
