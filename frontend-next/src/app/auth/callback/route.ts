import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { safeAuthDestination } from "@/lib/auth-destination";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeAuthDestination(url.searchParams.get("next"));

  const loginError = (reason: string) => {
    const destination = new URL("/login", request.url);
    destination.searchParams.set("auth_error", reason);
    if (next) destination.searchParams.set("next", next);
    return NextResponse.redirect(destination);
  };

  if (!code) {
    return loginError("confirmation");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return loginError("confirmation");
    }
  } catch {
    return loginError("configuration");
  }

  return NextResponse.redirect(new URL(next || "/dashboard", request.url));
}
