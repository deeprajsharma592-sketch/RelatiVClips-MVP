"use client";

/**
 * /signup — multi-step: role select → role-specific form → submit.
 *
 * 3 user types:
 *  - Creator: own long-form content (YouTube, podcasts). Get clipped, earn.
 *  - Brand: D2C company, agency, or sponsor. Post campaigns, pay clippers.
 *  - Clipper: Pro/Elite subscriber. Create clips, get paid weekly.
 *
 * Wire-up:
 *  - Role selection drives which fields render in step 2.
 *  - On submit, calls lib/auth.ts → backend POST /api/v1/auth/signup
 *  - On success, the backend sets the HttpOnly cookie; we redirect to
 *    /account where the user can see their freshly-created profile.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signup, ROLE_DESCRIPTION, type UserRole, type User } from "@/lib/auth";

type Step = "role" | "form" | "done";

interface FormState {
  email: string;
  password: string;
  name: string;
  role: UserRole | null;
  // creator
  handle: string;
  primary_platform: string;
  channel_url: string;
  // brand
  company_name: string;
  website: string;
  industry: string;
  // clipper
  specialty: string;
  accept_tos: boolean;
}

const INITIAL: FormState = {
  email: "",
  password: "",
  name: "",
  role: null,
  handle: "",
  primary_platform: "youtube",
  channel_url: "",
  company_name: "",
  website: "",
  industry: "",
  specialty: "",
  accept_tos: false,
};

const ROLE_META: { key: UserRole; icon: string; tagline: string }[] = [
  { key: "creator", icon: "▶", tagline: "Long-form → viral clips" },
  { key: "brand", icon: "$", tagline: "Pay per view, not flat fee" },
  { key: "clipper", icon: "✂", tagline: "Pro/Elite subscription" },
];

const PLATFORM_OPTIONS = ["youtube", "spotify", "apple_podcasts", "rumble", "twitch", "other"];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("role");
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const onPickRole = (r: UserRole) => {
    set("role", r);
    setStep("form");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.role) return;
    if (!form.accept_tos) {
      setSubmitError("You must accept the Terms of Service to continue.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Build payload with only the role-relevant fields
      const payload: any = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        name: form.name.trim(),
        role: form.role,
        accept_tos: form.accept_tos,
      };
      if (form.role === "creator") {
        payload.handle = form.handle || undefined;
        payload.primary_platform = form.primary_platform;
        payload.channel_url = form.channel_url || undefined;
      } else if (form.role === "brand") {
        payload.company_name = form.company_name || undefined;
        payload.website = form.website || undefined;
        payload.industry = form.industry || undefined;
      } else if (form.role === "clipper") {
        payload.handle = form.handle || undefined;
        payload.specialty = form.specialty || undefined;
      }
      const result = await signup(payload);
      setStep("done");
      // Role-based redirect: brand → /brands/dashboard, clipper → /clippers/dashboard,
      // creator → /creators/dashboard, fallback → /account.
      const dest = roleDestination(result.user);
      setTimeout(() => router.push(dest), 1500);
    } catch (err: any) {
      setSubmitError(err?.message || "Sign up failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-32 pb-16 px-4 sm:px-6 animate-page-enter">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/3 h-[400px] w-[400px] rounded-full bg-[color:var(--color-glow-primary)] opacity-30 blur-[120px]" />
        <div className="absolute bottom-0 right-1/3 h-[300px] w-[300px] rounded-full bg-[color:var(--color-glow-violet)] opacity-25 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["role", "form", "done"] as const).map((s, i) => {
            const idx = ["role", "form", "done"].indexOf(step);
            const active = i <= idx;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-mono ${
                    active
                      ? "bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)]"
                      : "bg-[color:var(--color-surface)] text-text-muted"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 2 && (
                  <div
                    className={`w-8 h-px ${
                      i < idx ? "bg-[color:var(--color-accent)]" : "bg-[color:var(--color-border)]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* STEP 1: role pick */}
        {step === "role" && (
          <div className="text-center">
            <span className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
              STEP 1 / 3 · WHO ARE YOU
            </span>
            <h1 className="font-display font-bold text-3xl md:text-5xl text-text-primary tracking-tight mt-3">
              Pick your role.
            </h1>
            <p className="mt-3 text-text-secondary max-w-md mx-auto">
              Each role gets its own dashboard, data model, and onboarding. You can&apos;t be two at once.
            </p>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-3">
              {ROLE_META.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => onPickRole(r.key)}
                  className="group text-left rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-surface-2)] transition-all"
                >
                  <div className="text-3xl mb-3 text-[color:var(--color-accent)] group-hover:scale-110 transition-transform inline-block">
                    {r.icon}
                  </div>
                  <div className="font-display font-bold text-lg text-text-primary mb-1 capitalize">
                    {r.key === "brand" ? "D2C Brand" : r.key}
                  </div>
                  <p className="text-xs text-text-muted mb-3 leading-relaxed">
                    {ROLE_DESCRIPTION[r.key]}
                  </p>
                  <div className="text-[10px] font-mono text-text-faint">{r.tagline}</div>
                </button>
              ))}
            </div>
            <p className="mt-8 text-xs text-text-muted">
              Already have an account?{" "}
              <Link href="/login" className="text-[color:var(--color-accent)] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}

        {/* STEP 2: form */}
        {step === "form" && form.role && (
          <form onSubmit={onSubmit} className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/80 backdrop-blur p-8 space-y-6">
            <div className="text-center mb-4">
              <span className="inline-flex items-center gap-2 mb-2 px-3 py-1.5 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
                STEP 2 / 3 · YOUR DETAILS
              </span>
              <h1 className="font-display font-bold text-2xl text-text-primary mt-2 capitalize">
                {form.role === "brand" ? "D2C Brand" : form.role} account
              </h1>
              <button
                type="button"
                onClick={() => setStep("role")}
                className="text-xs text-text-muted hover:text-text-primary mt-1"
              >
                ← Change role
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Your name" required>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Maya Chen"
                  className={inputClass}
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Password" required hint="Minimum 8 characters">
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
            </Field>

            {/* Role-specific fields */}
            {form.role === "creator" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Handle (YouTube / TikTok / etc.)">
                    <input
                      type="text"
                      value={form.handle}
                      onChange={(e) => set("handle", e.target.value)}
                      placeholder="@hookqueen"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Primary platform">
                    <select
                      value={form.primary_platform}
                      onChange={(e) => set("primary_platform", e.target.value)}
                      className={inputClass}
                    >
                      {PLATFORM_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Channel URL" hint="Optional — we'll use it to verify your account later">
                  <input
                    type="url"
                    value={form.channel_url}
                    onChange={(e) => set("channel_url", e.target.value)}
                    placeholder="https://youtube.com/@you"
                    className={inputClass}
                  />
                </Field>
              </>
            )}

            {form.role === "brand" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Company name" required>
                    <input
                      type="text"
                      required
                      value={form.company_name}
                      onChange={(e) => set("company_name", e.target.value)}
                      placeholder="Acme Co."
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Industry">
                    <input
                      type="text"
                      value={form.industry}
                      onChange={(e) => set("industry", e.target.value)}
                      placeholder="D2C · Wellness"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="Website">
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="https://acme.com"
                    className={inputClass}
                  />
                </Field>
              </>
            )}

            {form.role === "clipper" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Handle">
                    <input
                      type="text"
                      value={form.handle}
                      onChange={(e) => set("handle", e.target.value)}
                      placeholder="@hookqueen"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Specialty">
                    <input
                      type="text"
                      value={form.specialty}
                      onChange={(e) => set("specialty", e.target.value)}
                      placeholder="Podcasts · Tech"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="rounded-md border border-[color:var(--color-accent-tertiary)]/30 bg-[color:var(--color-accent-tertiary)]/5 p-3 text-xs text-text-secondary">
                  Heads up: paying clipper accounts are billed via Stripe. You&apos;ll set up
                  payment on the next step.
                </div>
              </>
            )}

            <label className="flex items-start gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={form.accept_tos}
                onChange={(e) => set("accept_tos", e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I agree to the{" "}
                <Link href="/legal/terms" className="text-[color:var(--color-accent)] hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/legal/privacy" className="text-[color:var(--color-accent)] hover:underline">
                  Privacy Policy
                </Link>
                . I confirm I&apos;m 18+.
              </span>
            </label>

            {submitError && (
              <div className="rounded-md border border-[color:var(--color-error)]/30 bg-[color:var(--color-error)]/10 px-4 py-3 text-sm text-[color:var(--color-error)]">
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep("role")}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary btn-shine text-sm"
                style={{ paddingTop: "12px", paddingBottom: "12px", paddingLeft: "28px", paddingRight: "28px" }}
              >
                {submitting ? "Creating account…" : "Create account →"}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: done */}
        {step === "done" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-success)]/15 border border-[color:var(--color-success)]/30 text-[color:var(--color-success)] text-3xl mb-6">
              ✓
            </div>
            <h1 className="font-display font-bold text-3xl text-text-primary mb-2">
              You&apos;re in.
            </h1>
            <p className="text-text-secondary">Redirecting to your account…</p>
          </motion.div>
        )}
      </div>
    </section>
  );
}

const inputClass =
  "w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[color:var(--color-bg-base)] border border-[color:var(--color-border)] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-[color:var(--color-accent)]";

/**
 * Where to send a freshly-signed-up user based on the role their account was
 * created with. We trust the role returned by the backend (which just issued
 * the session) over the form state.
 */
function roleDestination(user: User): string {
  switch (user.role) {
    case "brand":
      return "/brands/dashboard";
    case "clipper":
      return "/clippers/dashboard";
    case "creator":
      return "/creators/dashboard";
    default:
      return "/account";
  }
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 mb-2 text-xs font-mono tracking-wider text-text-muted uppercase">
        <span>{label}</span>
        {required && <span className="text-[color:var(--color-accent)]">*</span>}
      </span>
      {children}
      {hint && <span className="block mt-1 text-[10px] text-text-faint">{hint}</span>}
    </label>
  );
}
