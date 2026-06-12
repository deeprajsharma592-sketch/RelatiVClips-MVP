// Diagnostic Edge Function — test if Vercel can reach various public endpoints.
// This helps determine if the Vercel→Hetzner failure is specific to that IP
// or a general Vercel outbound issue.

import { NextRequest, NextResponse } from "next/server";

const TARGETS: Array<{ name: string; url: string }> = [
  { name: "hetzner-9000", url: "http://91.98.144.72:9000/api/v1/auth/me" },
  { name: "hetzner-80", url: "http://91.98.144.72/health" },
  { name: "google", url: "https://www.google.com/" },
  { name: "cloudflare", url: "https://1.1.1.1/" },
];

async function probe(name: string, url: string) {
  const start = Date.now();
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ac.signal,
      cache: "no-store",
      redirect: "manual",
    });
    clearTimeout(timeoutId);
    return {
      name,
      url,
      ok: true,
      status: res.status,
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const e = err as any;
    return {
      name,
      url,
      ok: false,
      latency_ms: Date.now() - start,
      error: e.name || "unknown",
      code: e.cause?.code || e.cause?.name || "n/a",
      message: e.cause?.message || e.message,
    };
  }
}

export async function GET(_req: NextRequest) {
  const results = await Promise.all(TARGETS.map((t) => probe(t.name, t.url)));
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    region: process.env.VERCEL_REGION || "unknown",
    results,
  });
}
