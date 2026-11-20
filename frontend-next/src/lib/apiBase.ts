/**
 * Shared API base URL helper.
 *
 * All browser-originated requests use the same-origin Next.js proxy so it can
 * forward the Supabase access token to FastAPI without exposing backend URLs.
 *
 * NEXT_PUBLIC_API_URL is now ONLY used for SSR / server-side fetches.
 * For browser code, use this helper to get the same-origin path.
 *
 */

const TUNNEL_PREFIX = "/api/proxy";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Returns the base URL to use for fetch calls.
 *
 * - Browser in dev and prod: relative same-origin proxy path
 * - SSR (no window): from NEXT_PUBLIC_API_URL env, or "" (proxy)
 */
export function apiBase(): string {
  if (!isBrowser()) {
    // SSR — use env var or empty (relative)
    return process.env.NEXT_PUBLIC_API_URL || "";
  }
  return TUNNEL_PREFIX;
}

/**
 * Returns the full path to use for an API call. Use this for all
 * browser-side auth/data calls.
 *
 *   apiPath("/api/v1/auth/login")
 *     browser      → "/api/proxy/api/v1/auth/login" (proxy forwards the bearer token)
 *     SSR          → "/api/v1/auth/login" or NEXT_PUBLIC_API_URL+"/api/v1/auth/login"
 *
 * Note: the backend FastAPI routers are mounted WITHOUT the /api/v1/
 * prefix (e.g. /process/youtube, not /api/v1/process/youtube). The
 * /api/v1/ segment exists only as a client-side version marker; the
 * Vercel Edge proxy in /api/proxy/[...path]/route.ts strips it before
 * forwarding upstream.
 */
export function apiPath(path: string): string {
  if (!isBrowser()) {
    const base = process.env.NEXT_PUBLIC_API_URL || "";
    return `${base}${path}`;
  }
  return `${TUNNEL_PREFIX}${path}`;
}
