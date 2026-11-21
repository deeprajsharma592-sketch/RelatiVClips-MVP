// Vercel Edge Function — proxies backend calls to Hetzner over the public internet.
//
// Path convention: /api/proxy/<original-path>  →  <BACKEND_BASE>/<original-path>
//
// BACKEND_BASE comes from the BACKEND_BASE_URL env var (set in Vercel dashboard).
// Fallback uses HTTP on the Hetzner IP (Caddy handles HTTPS termination).
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

import { getBackendBase } from "@/lib/backend-base";

const BACKEND_BASE = getBackendBase();
const REQUEST_TIMEOUT_MS = 25_000;

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const pathStr = path.join("/");
  const search = req.nextUrl.search;

  // FastAPI auth, dashboard, billing, campaigns, taste, verification, and clips
  // are all mounted at /api/v1/... on the backend.
  // ONLY strip api/v1/ for un-prefixed backend routers: process, upload, download, status, health.
  let cleanedPath = pathStr;
  const unPrefixed = ["api/v1/process", "api/v1/upload", "api/v1/download", "api/v1/status", "api/v1/health"];
  if (unPrefixed.some((prefix) => cleanedPath === prefix || cleanedPath.startsWith(prefix + "/"))) {
    cleanedPath = cleanedPath.slice("api/v1/".length);
  }

  const download = /^download\/[^/]+$/i.test(cleanedPath) &&
    req.nextUrl.searchParams.has("download");
  const legacyDownload = /^clips\/[^/]+$/i.test(cleanedPath);
  const requiresDownloadSession = download || legacyDownload;

  const targetUrl = `${BACKEND_BASE}/${cleanedPath}${search}`;

  // Forward only clean headers — strip Cloudflare / Vercel CDN loop headers
  const headers = new Headers();
  for (const [key, val] of req.headers.entries()) {
    const k = key.toLowerCase();
    if (
      k.startsWith("cf-") ||
      k === "cdn-loop" ||
      k.startsWith("x-vercel-") ||
      k === "host" ||
      k === "connection" ||
      k === "content-length" ||
      k === "cookie" ||
      k === "authorization"
    ) {
      continue;
    }
    headers.set(key, val);
  }
  try {
    headers.set("host", new URL(BACKEND_BASE).host);
  } catch {
    // ignore
  }
  headers.set("x-forwarded-host", req.headers.get("host") || "relativclips.com");
  headers.set("x-forwarded-proto", "https");
  headers.set("x-relativ-proxy", "vercel-edge-v2");

  let supabaseCookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];
  const supabaseConfig = getSupabasePublicConfig();
  if (supabaseConfig) {
    const supabase = createServerClient(supabaseConfig.url, supabaseConfig.key, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => { supabaseCookiesToSet = cookies; },
      },
    });
    if (requiresDownloadSession) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        return NextResponse.json({ detail: "Sign in to download this clip." }, { status: 401 });
      }
    }
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      headers.set("authorization", `Bearer ${data.session.access_token}`);
    }
  }

  if (requiresDownloadSession && !headers.has("authorization")) {
    return NextResponse.json({ detail: "Sign in to download this clip." }, { status: 401 });
  }

  if (!BACKEND_BASE) {
    return NextResponse.json(
      {
        error: "BACKEND_NOT_CONFIGURED",
        detail: "RelatiV’s processing service is not connected yet. Please try again later.",
      },
      { status: 503 },
    );
  }

  const withSupabaseCookies = (response: NextResponse) => {
    for (const cookie of supabaseCookiesToSet) {
      response.cookies.set(cookie.name, cookie.value, cookie.options as never);
    }
    return response;
  };

  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
  const startTime = Date.now();

  try {
    const body =
      req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      signal: ac.signal,
      cache: "no-store",
      // Disable keep-alive to avoid hanging sockets
      keepalive: false,
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    // Stream the response back
    const responseHeaders = new Headers();
    responseHeaders.set("content-type", upstream.headers.get("content-type") || "application/json");
    responseHeaders.set("x-proxied-by", "vercel-edge-relativclips");
    responseHeaders.set("x-proxy-latency-ms", String(latency));
    const origin = req.headers.get("origin") || "https://relativclips.com";
    responseHeaders.set("access-control-allow-origin", origin);
    responseHeaders.set("access-control-allow-credentials", "true");
    responseHeaders.set("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
    responseHeaders.set("access-control-allow-headers", "content-type,authorization");

    if (requiresDownloadSession) responseHeaders.set("cache-control", "private, no-store");

    // Forward important upstream response headers (media streaming & auth!)
    const headersToForward = [
      "content-length",
      "content-range",
      "accept-ranges",
      "content-disposition",
      "set-cookie",
      "x-request-id",
      "x-rate-limit-limit",
      "x-rate-limit-remaining",
      "x-rate-limit-reset",
    ];
    for (const h of headersToForward) {
      const v = upstream.headers.get(h);
      if (v) responseHeaders.set(h, v);
    }

    return withSupabaseCookies(new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    }));
  } catch (err) {
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    const isTimeout = err instanceof Error && err.name === "AbortError";

    // Detailed error for diagnosis
    let detail = err instanceof Error ? err.message : "Unknown proxy error";
    let code = "unknown";

    if (isTimeout) {
      detail = `Backend didn't respond within ${REQUEST_TIMEOUT_MS}ms`;
      code = "ETIMEDOUT";
    } else if (err instanceof Error) {
      // Vercel/Node.js fetch errors include a .cause with the underlying error
      const rawCause = err.cause;
      const cause = rawCause && typeof rawCause === "object" ? rawCause as Record<string, unknown> : null;
      if (cause) {
        const causeCode = typeof cause.code === "string" ? cause.code : typeof cause.name === "string" ? cause.name : "fetch_error";
        const causeMessage = typeof cause.message === "string" ? cause.message : "";
        const syscall = typeof cause.syscall === "string" ? cause.syscall : "n/a";
        code = causeCode;
        detail = `${causeCode}: ${causeMessage} (syscall=${syscall})`;
      }
    }

    // Log to Vercel's function logs (visible in dashboard)
    console.error(`[proxy] FAILED ${req.method} ${pathStr}`, {
      code,
      detail,
      latency_ms: latency,
      method: req.method,
      backend_host: (() => { try { return new URL(BACKEND_BASE).host; } catch { return "invalid_backend_url"; } })(),
      host: req.headers.get("host"),
      user_agent: req.headers.get("user-agent")?.slice(0, 80),
    });

    return withSupabaseCookies(NextResponse.json(
      {
        error: code,
        detail: isTimeout
          ? "The RelatiV processing service did not respond in time. Please try again shortly."
          : "The RelatiV processing service could not be reached. The service connection needs attention.",
        latency_ms: latency,
      },
      {
        status: isTimeout ? 504 : 502,
        headers: {
          "x-proxy-error": code,
          "x-proxy-latency-ms": String(latency),
        },
      }
    ));
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;

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
