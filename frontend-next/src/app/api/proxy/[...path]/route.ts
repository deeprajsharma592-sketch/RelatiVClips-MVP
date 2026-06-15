// Vercel Edge Function — proxies backend calls to Hetzner over the public internet.
// This sidesteps the Vercel->Hetzner HTTP-rewrite timeout issue by giving us
// proper error handling, timeouts, and streaming.
//
// Path convention: /api/proxy/<original-path>  →  <BACKEND_BASE>/<original-path>
//
// BACKEND_BASE comes from the BACKEND_BASE_URL env var (set in Vercel).
// Fallback to the last known good Cloudflare Quick Tunnel URL.
// To regenerate a tunnel: ssh hetzner "bash /root/.vercel-tmp/start-tunnel.sh"
// then update the BACKEND_BASE_URL env var on Vercel (no code change needed).
import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.BACKEND_BASE_URL
  || "https://retro-turned-outlined-decorative.trycloudflare.com";
const REQUEST_TIMEOUT_MS = 25_000;

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const pathStr = path.join("/");
  const search = req.nextUrl.search;

  // The frontend calls /api/proxy/api/v1/<path> but the backend FastAPI
  // routers are mounted WITHOUT the /api/v1/ prefix (e.g. /process/youtube,
  // not /api/v1/process/youtube). Strip the prefix before forwarding so
  // /api/proxy/api/v1/process/youtube → ${BACKEND_BASE}/process/youtube.
  let cleanedPath = pathStr;
  const apiV1Prefix = "api/v1/";
  if (cleanedPath === "api/v1" || cleanedPath.startsWith(apiV1Prefix)) {
    cleanedPath = cleanedPath.slice(apiV1Prefix.length);
    if (cleanedPath === "") cleanedPath = ""; // root → just /, not //
  }

  const targetUrl = `${BACKEND_BASE}/${cleanedPath}${search}`;

  // Stream-friendly headers
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.set("x-forwarded-host", req.headers.get("host") || "relativclips.com");
  headers.set("x-forwarded-proto", "https");
  headers.set("x-relativ-proxy", "vercel-edge-v2");

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

    // Forward important upstream response headers (cookies for auth!)
    const headersToForward = [
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

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    const isTimeout = err instanceof Error && err.name === "AbortError";

    // Detailed error for diagnosis
    let detail = (err as Error).message;
    let code = "unknown";

    if (isTimeout) {
      detail = `Backend didn't respond within ${REQUEST_TIMEOUT_MS}ms`;
      code = "ETIMEDOUT";
    } else if (err instanceof Error) {
      // Vercel/Node.js fetch errors include a .cause with the underlying error
      const cause = (err as any).cause;
      if (cause) {
        code = cause.code || cause.name || "fetch_error";
        detail = `${cause.code || cause.name}: ${cause.message || ""} (syscall=${cause.syscall || "n/a"})`;
      }
    }

    // Log to Vercel's function logs (visible in dashboard)
    console.error(`[proxy] FAILED ${req.method} ${targetUrl}`, {
      code,
      detail,
      latency_ms: latency,
      method: req.method,
      target: targetUrl,
      host: req.headers.get("host"),
      user_agent: req.headers.get("user-agent")?.slice(0, 80),
    });

    return NextResponse.json(
      {
        error: code,
        detail,
        target: targetUrl,
        latency_ms: latency,
      },
      {
        status: isTimeout ? 504 : 502,
        headers: {
          "x-proxy-error": code,
          "x-proxy-latency-ms": String(latency),
        },
      }
    );
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
