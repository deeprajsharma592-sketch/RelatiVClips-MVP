/**
 * Shared API base URL helper.
 *
 * In production, all browser-originated requests must use the same-origin
 * Vercel proxy (/api/proxy/...) so:
 *   1. The HttpOnly session cookie is sent automatically
 *   2. The Vercel edge function adds CORS headers
 *   3. We don't expose the Hetzner / Cloudflare tunnel URL to the browser
 *
 * NEXT_PUBLIC_API_URL is now ONLY used for SSR / server-side fetches.
 * For browser code, use this helper to get the same-origin path.
 *
 * In dev (localhost), allow the direct backend URL for fast iteration.
 */

const TUNNEL_PREFIX = "/api/proxy";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isDev(): boolean {
  return isBrowser() && window.location.hostname === "localhost";
}

/**
 * Returns the base URL to use for fetch calls.
 *
 * - Browser in dev: http://localhost:9000 (no proxy needed)
 * - Browser in prod: "" (relative — same origin → /api/proxy/...)
 * - SSR (no window): from NEXT_PUBLIC_API_URL env, or "" (proxy)
 */
export function apiBase(): string {
  if (!isBrowser()) {
    // SSR — use env var or empty (relative)
    return process.env.NEXT_PUBLIC_API_URL || "";
  }
  if (isDev()) {
    return "http://localhost:9000";
  }
  return ""; // prod browser → same-origin → Vercel proxy
}

/**
 * Returns the full path to use for an API call. Use this for all
 * browser-side auth/data calls.
 *
 *   apiPath("/api/v1/auth/login")
 *     browser prod → "/api/proxy/api/v1/auth/login"
 *     browser dev  → "http://localhost:9000/api/v1/auth/login"
 *     SSR          → "/api/v1/auth/login" or NEXT_PUBLIC_API_URL+"/api/v1/auth/login"
 *
 * NOTE: `path` MUST start with "/api/v1/" — the helper does not
 * auto-prepend the API version. Missing the prefix used to silently
 * 404 in production (browser → /api/proxy/support/contact with no
 * /api/v1). We now warn in dev if the prefix is missing.
 */
export function apiPath(path: string): string {
  if (path && !path.startsWith("/api/v1/")) {
    if (typeof console !== "undefined") {
      console.warn(
        `[apiBase] path "${path}" is missing the "/api/v1/" prefix — backend routes require it`
      );
    }
  }
  if (!isBrowser()) {
    const base = process.env.NEXT_PUBLIC_API_URL || "";
    return `${base}${path}`;
  }
  if (isDev()) {
    return `http://localhost:9000${path}`;
  }
  return `${TUNNEL_PREFIX}${path}`;
}
