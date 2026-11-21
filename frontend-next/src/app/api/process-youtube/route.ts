import { NextRequest, NextResponse } from "next/server";

import { getBackendBase } from "@/lib/backend-base";

const BACKEND = getBackendBase();
const TIMEOUT_MS = 120_000; // 2 min for full pipeline

export async function POST(req: NextRequest) {
  if (!BACKEND) {
    return NextResponse.json(
      { error: "backend_not_configured", detail: "The RelatiV processing service is not connected yet." },
      { status: 503 },
    );
  }
  const body = await req.json();
  const targetUrl = `${BACKEND}/process/youtube`;
  
  try {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), TIMEOUT_MS);

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });

    clearTimeout(tid);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: isTimeout ? "timeout" : "fetch_failed", detail: err instanceof Error ? err.message : "Unknown backend connection error" },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
