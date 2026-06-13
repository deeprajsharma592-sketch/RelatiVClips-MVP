/**
 * Auth client helpers.
 *
 * Why this is plain fetch (not Auth.js / NextAuth): the backend already
 * has full auth (bcrypt + JWT + sessions). Auth.js would be a second
 * layer of state to keep in sync. The simpler path: hit our backend
 * directly, let it set the HttpOnly cookie, and use /me to read state.
 *
 * Tokens are HttpOnly so JS can't read them — XSS-resistant by design.
 * The browser sends the cookie automatically on every fetch.
 *
 * All paths go through apiPath() which routes to /api/proxy/* in
 * production (same-origin, cookie sent, no CORS) and to localhost:9000
 * in dev.
 */

import { apiPath } from "./apiBase";

export type UserRole = "creator" | "brand" | "clipper";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_verified: boolean;
  created_at: string;
  last_login_at: string | null;
  profile: Record<string, unknown>;
}

export interface AuthResponse {
  user: User;
}

async function authFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const r = await fetch(apiPath(path), {
    ...init,
    credentials: "include", // send the HttpOnly cookie
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!r.ok) {
    let detail = `HTTP ${r.status}`;
    try {
      const body = await r.json();
      detail = body.detail || detail;
    } catch {
      // body wasn't JSON
    }
    throw new Error(detail);
  }
  // 204 No Content (logout) returns empty
  const text = await r.text();
  return (text ? JSON.parse(text) : (undefined as unknown)) as T;
}

export async function signup(payload: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  company_name?: string;
  handle?: string;
  specialty?: string;
  primary_platform?: string;
  channel_url?: string;
  industry?: string;
  website?: string;
  accept_tos: boolean;
}): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout(): Promise<void> {
  await authFetch<void>("/api/v1/auth/logout", { method: "POST" });
}

export async function me(): Promise<AuthResponse | null> {
  try {
    return await authFetch<AuthResponse>("/api/v1/auth/me");
  } catch (e: any) {
    if (e?.message?.includes("Not authenticated") || e?.message?.includes("401")) {
      return null;
    }
    throw e;
  }
}

export const ROLE_LABEL: Record<UserRole, string> = {
  creator: "Creator",
  brand: "D2C Brand",
  clipper: "Paying Clipper",
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  creator: "You make long-form content. We pay clippers to turn it into viral shorts.",
  brand: "You post campaigns and pay clippers per view. Set CPM, brief, budget.",
  clipper: "Pro/Elite subscriber. Create clips for brand campaigns, get paid weekly.",
};
