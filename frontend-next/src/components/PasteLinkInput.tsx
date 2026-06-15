"use client";

/**
 * PasteLinkInput — The "Paste your URL" input.
 *
 * Designed to "dissolve" into the glassmorphic funnel graphic on the
 * landing page. The input is a glass card that:
 *   1. Sits on top of the funnel (z-index above it)
 *   2. Has backdrop-filter: blur so the funnel shines through
 *   3. Has a soft fade mask at the bottom edge so it visually
 *      "becomes" the funnel below it
 *
 * Variants:
 *   - "hero"   — the prominent input inside the hero, dissolves into funnel
 *   - "sticky" — the compact bar that appears on scroll
 *
 * Both share the same submit handler logic.
 */

import { useState, useCallback, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Link2, Sparkles, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface PasteLinkInputProps {
  variant?: "hero" | "sticky";
  className?: string;
  autoFocus?: boolean;
}

const URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;

export default function PasteLinkInput({
  variant = "hero",
  className = "",
  autoFocus = false,
}: PasteLinkInputProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = url.trim().length === 0 || URL_REGEX.test(url.trim());

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = url.trim();
      if (!trimmed) {
        setTouched(true);
        return;
      }
      if (!URL_REGEX.test(trimmed)) {
        setError("That doesn't look like a YouTube link.");
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        // Hand off to the workspace, where the real processing happens
        const target = `/process?url=${encodeURIComponent(trimmed)}`;
        router.push(target);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setSubmitting(false);
      }
    },
    [url, router]
  );

  // ── Hero variant: prominent, with bottom-edge mask to dissolve into funnel
  if (variant === "hero") {
    return (
      <div className={`relative ${className}`}>
        {/* The dissolve mask — gradient that fades to transparent at the bottom
            so the input visually merges with the funnel graphic below. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, transparent 60%, rgba(250, 246, 238, 0.4) 85%, rgba(250, 246, 238, 0.85) 100%)",
            maskImage:
              "linear-gradient(180deg, black 0%, black 50%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, black 0%, black 50%, transparent 100%)",
          }}
        />

        <form
          onSubmit={handleSubmit}
          className="relative z-[2] flex items-stretch gap-0 rounded-full overflow-hidden"
          style={{
            background: "var(--glass-light-strong)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid var(--color-border)",
            boxShadow:
              "0 12px 40px rgba(40, 30, 20, 0.10), 0 2px 6px rgba(40, 30, 20, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
          }}
        >
          <div
            className="flex items-center justify-center pl-5 pr-3"
            style={{ color: "var(--color-text-muted)" }}
          >
            <Link2 className="h-4 w-4" />
          </div>
          <input
            type="url"
            inputMode="url"
            value={url}
            autoFocus={autoFocus}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            onBlur={() => setTouched(true)}
            placeholder="Paste a YouTube link…"
            disabled={submitting}
            className="flex-1 min-w-0 bg-transparent py-4 pr-2 text-[15px] outline-none placeholder:text-[var(--color-text-muted)]/70"
            style={{ color: "var(--color-text-primary)" }}
            aria-label="YouTube URL"
          />
          <button
            type="submit"
            disabled={!url.trim() || !valid || submitting}
            className="m-1.5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #D946EF 0%, #F59E0B 100%)",
              color: "#FFFFFF",
              boxShadow:
                "0 4px 14px rgba(217, 70, 239, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.97)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            {submitting ? (
              <>
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span>Working…</span>
              </>
            ) : (
              <>
                <span>Get clips</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Validation hint row */}
        <AnimatePresence>
          {(touched && !valid && url.trim()) || error ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 ml-6 flex items-center gap-1.5 text-[12px]"
              style={{ color: "var(--color-accent)" }}
            >
              <X className="h-3 w-3" />
              {error ?? "That doesn't look like a YouTube link."}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {/* Below-input helper text + sample link */}
        <div
          className="mt-4 ml-6 flex items-center gap-3 text-[12px] font-mono"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>try:</span>
          <button
            type="button"
            onClick={() => setUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}
            className="inline-flex items-center gap-1 transition-colors hover:text-[var(--color-text-primary)]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <span className="underline decoration-dotted underline-offset-2">
              sample video
            </span>
          </button>
          <span style={{ color: "var(--color-text-faint)" }}>·</span>
          <span>or drop a file in the workspace</span>
        </div>
      </div>
    );
  }

  // ── Sticky variant: compact, no dissolve, fits in a thin top bar
  return (
    <form
      onSubmit={handleSubmit}
      className={`relative flex items-stretch gap-0 rounded-full overflow-hidden ${className}`}
      style={{
        background: "var(--glass-light-strong)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid var(--color-border)",
        boxShadow:
          "0 6px 18px rgba(40, 30, 20, 0.10), 0 1px 0 rgba(255, 255, 255, 0.5) inset",
      }}
    >
      <div
        className="flex items-center justify-center pl-4 pr-2"
        style={{ color: "var(--color-text-muted)" }}
      >
        <Link2 className="h-3.5 w-3.5" />
      </div>
      <input
        type="url"
        inputMode="url"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          if (error) setError(null);
        }}
        onBlur={() => setTouched(true)}
        placeholder="Paste a YouTube link…"
        disabled={submitting}
        className="flex-1 min-w-0 bg-transparent py-2.5 pr-1 text-[13px] outline-none placeholder:text-[var(--color-text-muted)]/70"
        style={{ color: "var(--color-text-primary)" }}
        aria-label="YouTube URL"
      />
      <button
        type="submit"
        disabled={!url.trim() || !valid || submitting}
        className="m-1 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, #D946EF 0%, #F59E0B 100%)",
          color: "#FFFFFF",
          boxShadow:
            "0 2px 8px rgba(217, 70, 239, 0.30), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
        }}
      >
        {submitting ? (
          <Sparkles className="h-3 w-3 animate-pulse" />
        ) : (
          <>
            <span className="hidden sm:inline">Get clips</span>
            <ArrowRight className="h-3 w-3" />
          </>
        )}
      </button>
    </form>
  );
}
