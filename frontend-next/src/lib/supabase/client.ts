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
  browserClient = createBrowserClient(config.url, config.key);
  return browserClient;
}
