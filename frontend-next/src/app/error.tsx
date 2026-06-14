"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to console for debugging — production logging would go here.
    console.error("Page error boundary caught:", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-24 flex flex-col items-center justify-center text-center">
      <div className="mb-6">
        <span
          className="text-sm font-mono"
          style={{ color: "var(--color-accent)" }}
        >
          [Σ-Error]
        </span>
        <h1
          className="font-display font-bold mt-3 mb-2"
          style={{
            fontSize: "clamp(2.5rem, 8vw, 5rem)",
            lineHeight: 1,
            background: "linear-gradient(135deg, #FF77E9 0%, #FFD24D 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Something went wrong
        </h1>
        <p
          className="text-base mb-2"
          style={{ color: "var(--color-text-secondary)" }}
        >
          The pipeline hit an unexpected error.
        </p>
        {error.digest && (
          <p
            className="text-xs font-mono mb-6"
            style={{ color: "var(--color-text-muted)" }}
          >
            [∅] digest: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-[4px] hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 bg-transparent border border-border text-text-primary text-sm font-semibold rounded-[4px] hover:border-accent transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
