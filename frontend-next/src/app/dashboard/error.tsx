"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RelatiV dashboard error]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090C] px-6 text-white">
      <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121215] p-8 text-center shadow-2xl">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-amber-300">Studio recovery</p>
        <h1 className="mt-3 text-3xl font-semibold">The Studio hit a temporary error.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Your saved projects are still safe. Retry the dashboard, or reload it if a new version was just deployed.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Retry Studio
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/10"
          >
            Reload page
          </button>
        </div>
        {error.digest && <p className="mt-5 text-[11px] font-mono text-zinc-600">Reference: {error.digest}</p>}
      </section>
    </main>
  );
}
