"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { apiPath } from "@/lib/apiBase";

const SPECIALTIES = [
  "Podcasts · Tech",
  "Podcasts · Business",
  "Podcasts · Health",
  "Sports · MMA",
  "Sports · Football",
  "Sports · Basketball",
  "Comedy · Stand-up",
  "Comedy · Late night",
  "Education · Science",
  "Education · History",
  "Music · Behind the scenes",
  "Brands · D2C",
  "Gaming · Esports",
  "News · Politics",
  "Other",
];

const PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts", "LinkedIn", "X / Twitter"];

export default function ClipperApplyPage() {
  const [submitted, setSubmitted] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  if (submitted) {
    return (
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden pt-32 pb-16 px-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[400px] w-[400px] rounded-full bg-[color:var(--color-glow-violet)] opacity-50 blur-[120px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-xl w-full text-center"
        >
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-success)]/15 border border-[color:var(--color-success)]/30 text-[color:var(--color-success)] text-3xl mb-6">
            ✓
          </div>
          <h1 className="font-display font-bold text-4xl md:text-5xl text-text-primary tracking-tight">
            You&apos;re in the queue.
          </h1>
          <p className="mt-4 text-lg text-text-secondary">
            We review every application within 48 hours. Watch your email — including the spam folder.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/clippers"
              className="px-6 py-3 bg-[color:var(--color-surface-2)] border border-[color:var(--color-border-strong)] text-text-primary rounded-full font-semibold hover:border-[color:var(--color-accent)] transition-colors"
            >
              Back to clipper network
            </Link>
            <Link
              href="/"
              className="px-6 py-3 text-text-muted hover:text-text-primary transition-colors"
            >
              ← Home
            </Link>
          </div>
        </motion.div>
      </section>
    );
  }

  return (
    <section className="relative min-h-[80vh] overflow-hidden pt-32 pb-16 px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-[300px] w-[300px] rounded-full bg-[color:var(--color-glow-violet)] opacity-30 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
            CLIPPER APPLICATION · 5 MIN
          </span>
          <h1 className="font-display font-bold text-4xl md:text-5xl text-text-primary tracking-tight">
            Tell us about your clips.
          </h1>
          <p className="mt-4 text-text-secondary">
            We pair clippers with shows that match their style. The more specific you are, the better the match.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);
            setSubmitError(null);

            const form = e.currentTarget;
            const fd = new FormData(form);
            const portfolioRaw = (fd.get("portfolio_urls") as string) || "";
            const portfolio_urls = portfolioRaw
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean);

            const payload = {
              name: String(fd.get("name") || "").trim(),
              email: String(fd.get("email") || "").trim(),
              handle: String(fd.get("handle") || "").trim(),
              specialty: selectedSpecialty || "",
              platforms: selectedPlatforms,
              weekly_volume: fd.get("weekly_volume")
                ? Number(fd.get("weekly_volume"))
                : null,
              portfolio_urls,
            };

            try {
              const r = await fetch(apiPath("/api/v1/clippers/apply"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (!r.ok) {
                const err = await r.json().catch(() => ({ detail: r.statusText }));
                throw new Error(err.detail || `HTTP ${r.status}`);
              }
              setSubmitted(true);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              setSubmitError(
                message || "Couldn't submit. Please try again or email hello@relativ.video."
              );
            } finally {
              setSubmitting(false);
            }
          }}
          className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 space-y-6"
        >
          {/* Name + email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Your name" required>
              <input
                name="name"
                type="text"
                required
                placeholder="Maya Chen"
                className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[color:var(--color-bg-base)] border border-[color:var(--color-border)] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-[color:var(--color-accent-tertiary)]"
              />
            </Field>
            <Field label="Email" required>
              <input
                name="email"
                type="email"
                required
                placeholder="maya@example.com"
                className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[color:var(--color-bg-base)] border border-[color:var(--color-border)] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-[color:var(--color-accent-tertiary)]"
              />
            </Field>
          </div>

          {/* Handle */}
          <Field label="TikTok / Instagram / YouTube handle" required>
            <input
              name="handle"
              type="text"
              required
              placeholder="@hookqueen"
              className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[color:var(--color-bg-base)] border border-[color:var(--color-border)] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-[color:var(--color-accent-tertiary)]"
            />
          </Field>

          {/* Specialty chips */}
          <Field label="Specialty" required>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSelectedSpecialty(s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selectedSpecialty === s
                      ? "bg-[color:var(--color-accent-tertiary)]/15 border-[color:var(--color-accent-tertiary)] text-[color:var(--color-accent-tertiary)]"
                      : "bg-[color:var(--color-bg-base)] border-[color:var(--color-border)] text-text-secondary hover:border-[color:var(--color-border-strong)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>

          {/* Platform chips */}
          <Field label="Platforms you post on" required>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selectedPlatforms.includes(p)
                      ? "bg-[color:var(--color-accent)]/15 border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                      : "bg-[color:var(--color-bg-base)] border-[color:var(--color-border)] text-text-secondary hover:border-[color:var(--color-border-strong)]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>

          {/* Monthly volume */}
          <Field label="How many clips do you publish per week?">
            <input
              name="weekly_volume"
              type="number"
              min={0}
              max={500}
              placeholder="e.g. 14"
              className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[color:var(--color-bg-base)] border border-[color:var(--color-border)] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-[color:var(--color-accent-tertiary)]"
            />
          </Field>

          {/* Portfolio URL */}
          <Field label="Best 3 clips (paste any URLs)" required>
            <textarea
              name="portfolio_urls"
              required
              rows={3}
              placeholder={"https://tiktok.com/@you/video/1\nhttps://tiktok.com/@you/video/2\nhttps://tiktok.com/@you/video/3"}
              className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[color:var(--color-bg-base)] border border-[color:var(--color-border)] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-[color:var(--color-accent-tertiary)] font-mono text-sm"
            />
          </Field>

          {/* Error message */}
          {submitError && (
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-error)]/30 bg-[color:var(--color-error)]/10 px-4 py-3 text-sm text-[color:var(--color-error)]">
              {submitError}
            </div>
          )}

          {/* Submit */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-text-muted">
              We review every application within 48 hours. No spam, ever.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="px-7 py-3 bg-[color:var(--color-accent-tertiary)] text-[color:var(--color-bg-base)] font-semibold rounded-full shadow-[0_0_24px_var(--color-glow-violet)] hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {submitting ? "Submitting…" : "Submit application →"}
            </button>
          </div>
        </motion.form>
      </div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-mono tracking-wider text-text-muted mb-2 uppercase">
        {label}
        {required && <span className="text-[color:var(--color-accent)] ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
