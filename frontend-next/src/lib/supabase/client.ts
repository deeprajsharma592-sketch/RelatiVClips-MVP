"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error("Supabase is not configured. Add the public project URL and publishable key.");
  }
  const isProd =
    typeof window !== "undefined" && window.location.hostname.endsWith("relativclips.com");
  browserClient = createBrowserClient(config.url, config.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    cookieOptions: {
      domain: isProd ? ".relativclips.com" : undefined,
      path: "/",
      sameSite: "lax",
      secure: isProd,
      maxAge: 60 * 60 * 24 * 365,
    },
  });
  return browserClient;
}
