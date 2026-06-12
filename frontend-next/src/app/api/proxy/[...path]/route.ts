// Vercel Edge Function — proxies backend calls to Hetzner over the public internet.
// This sidesteps the Vercel->Hetzner HTTP-rewrite timeout issue by giving us
// proper error handling, timeouts, and streaming.
//
// Path convention: /api/proxy/<original-path>  →  http://91.98.144.72:9000/<original-path>

import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = "http://91.98.144.72:9000";
const REQUEST_TIMEOUT_MS = 25_000; // Vercel edge max is 25s on hobby, 60s on pro

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const pathStr = path.join("/");
  const search = req.nextUrl.search;
  const targetUrl = `${BACKEND_BASE}/${pathStr}${search}`;

  // Stream-friendly headers
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  // Pass through client IP + forwarded chain (hashed by backend for GDPR)
  headers.set("x-forwarded-host", req.headers.get("host") || "relativclips.com");
  headers.set("x-forwarded-proto", "https");

  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

  try {
    const body =
      req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      signal: ac.signal,
      // Don't keepalive the upstream connection — Vercel edge prefers short-lived
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    // Stream the response back
    const responseHeaders = new Headers();
    responseHeaders.set("content-type", upstream.headers.get("content-type") || "application/json");
    responseHeaders.set("x-proxied-by", "vercel-edge-relativclips");
    // CORS — we use the same-origin pattern (frontend hits /api/proxy/* on
    // relativclips.com), so CORS isn't strictly needed, but we add it for
    // safety and tooling access.
    const origin = req.headers.get("origin") || "https://relativclips.com";
    responseHeaders.set("access-control-allow-origin", origin);
    responseHeaders.set("access-control-allow-credentials", "true");
    responseHeaders.set("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
    responseHeaders.set("access-control-allow-headers", "content-type,authorization");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        error: isTimeout ? "upstream_timeout" : "upstream_unreachable",
        detail: isTimeout
          ? `Backend didn't respond within ${REQUEST_TIMEOUT_MS}ms`
          : (err as Error).message,
        target: targetUrl,
      },
      { status: isTimeout ? 504 : 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;

// Preflight handler
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": req.headers.get("origin") || "https://relativclips.com",
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
      "access-control-max-age": "86400",
    },
  });
}
