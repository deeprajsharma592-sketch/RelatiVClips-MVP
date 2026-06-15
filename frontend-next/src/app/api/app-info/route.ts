// App Info — proxies backend /version so the Next.js layer never hardcodes
// the beta marker. This keeps the footer/header BETA pill, JSON-LD, and
// future "what's new" UI all reading from one source of truth.
//
// Cached for 5 minutes — version + stage change only at deploy time, not
// per request. The Cache-Control header is what saves the backend from
// pointless traffic.

import { NextResponse } from "next/server";

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL || "http://localhost:9000";

const FALLBACK = {
  name: "RelatiV",
  version: "2.0.0",
  stage: "beta",
  built_at: "unknown",
  is_beta: true,
  support_url: "https://discord.gg/relativ",
  source: "fallback",
};

export const revalidate = 300; // 5 min

export async function GET() {
  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 4000);
    const res = await fetch(`${BACKEND_BASE_URL}/version`, {
      signal: ac.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`backend returned ${res.status}`);
    const data = await res.json();

    return NextResponse.json(
      { ...data, source: "backend" },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      },
    );
  } catch {
    // Backend unreachable (Vercel cold start, tunnel down, etc.) — serve
    // the fallback so the UI never breaks. The footer still shows BETA.
    return NextResponse.json(FALLBACK, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  }
}
