import type { User as SupabaseUser } from "@supabase/supabase-js";
import { apiPath } from "./apiBase";
import { getSupabaseBrowserClient } from "./supabase/client";

export type UserRole = "creator" | "brand" | "clipper";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  can_access_creator_workspace?: boolean;
  is_verified: boolean;
  credit_balance: number;
  plan_tier: string;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
  profile: Record<string, unknown>;
}

export interface AuthResponse {
  user: User;
  needsEmailVerification?: boolean;
}

function toAppUser(user: SupabaseUser): User {
  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || "",
    name: String(metadata.name || metadata.full_name || user.email?.split("@")[0] || "Creator"),
    // Roles and workspace access come from the backend profile, never from
    // editable Supabase user_metadata. The backend profile replaces this after
    // login; until then we use the least-privileged new-account default.
    role: "creator",
    can_access_creator_workspace: true,
    is_verified: Boolean(user.email_confirmed_at),
    credit_balance: 400,
    plan_tier: "free",
    is_admin: false,
    created_at: user.created_at,
    last_login_at: user.last_sign_in_at || null,
    profile: {},
  };
}

async function fetchApplicationProfile(): Promise<User | null> {
  const response = await fetch(apiPath("/api/v1/auth/me"), {
    credentials: "include",
    cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    let detail = `Application profile unavailable (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  const body = await response.json() as { user: User };
  return body.user;
}

export async function login(payload: { email: string; password: string }): Promise<AuthResponse> {
  const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Supabase did not return a signed-in user.");

  let user = toAppUser(data.user);
  try {
    user = (await fetchApplicationProfile()) || user;
  } catch {
    // Supabase Auth remains the identity source if the app database is briefly
    // unavailable. Feature APIs report their own database connection errors.
  }
  return { user };
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
  redirectTo?: string;
}): Promise<AuthResponse> {
  if (!payload.accept_tos) throw new Error("Please accept the Terms of Service to continue.");
  const origin = typeof window === "undefined" ? "https://relativclips.com" : window.location.origin;
  const next = payload.redirectTo?.startsWith("/") ? payload.redirectTo : "/dashboard";
  const { data, error } = await getSupabaseBrowserClient().auth.signUp({
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
    options: {
      data: { name: payload.name.trim(), role: "creator" },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Could not create your account. Please try again.");
  return { user: toAppUser(data.user), needsEmailVerification: !data.session };
}

export async function signInWithGoogle(redirectTo = "/dashboard") {
  const origin = typeof window === "undefined" ? "https://relativclips.com" : window.location.origin;
  const next = redirectTo.startsWith("/") ? redirectTo : "/dashboard";
  const { data, error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) throw new Error(error.message);
  if (data.url && typeof window !== "undefined") window.location.assign(data.url);
}

export async function requestPasswordReset(email: string) {
  const origin = typeof window === "undefined" ? "https://relativclips.com" : window.location.origin;
  const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) throw new Error(error.message);
}

export async function setNewPassword(password: string) {
  const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function resendSignupVerification(email: string) {
  const origin = typeof window === "undefined" ? "https://relativclips.com" : window.location.origin;
  const { error } = await getSupabaseBrowserClient().auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });
  if (error) throw new Error(error.message);
}

export async function logout(): Promise<void> {
  const { error } = await getSupabaseBrowserClient().auth.signOut();
  if (error) throw new Error(error.message);
}

export async function me(): Promise<AuthResponse | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (error.name === "AuthSessionMissingError") return null;
    throw new Error(error.message);
  }
  if (!data.user) return null;

  let user = toAppUser(data.user);
  try {
    user = (await fetchApplicationProfile()) || user;
  } catch {
    // Preserve the verified Auth identity while an app-profile request retries.
  }
  return { user };
}

export const ROLE_LABEL: Record<UserRole, string> = {
  creator: "Creator",
  brand: "D2C Brand",
  clipper: "Paying Clipper",
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  creator: "You make long-form content. We help you publish clips more consistently.",
  brand: "Post campaigns, set a budget, and review creator submissions.",
  clipper: "Create clips for brand campaigns and track your earnings.",
};
