import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_BASE_URL || "http://91.98.144.72";
const TIMEOUT_MS = 120_000; // 2 min for full pipeline

export async function POST(req: NextRequest) {
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
  } catch (err: any) {
    const isTimeout = err.name === "AbortError";
    return NextResponse.json(
      { error: isTimeout ? "timeout" : "fetch_failed", detail: err.message },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
