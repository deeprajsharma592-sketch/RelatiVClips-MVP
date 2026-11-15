import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/creators/dashboard";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    const destination = new URL("/login?auth_error=confirmation", request.url);
    return NextResponse.redirect(destination);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const destination = new URL("/login?auth_error=confirmation", request.url);
      return NextResponse.redirect(destination);
    }
  } catch {
    const destination = new URL("/login?auth_error=configuration", request.url);
    return NextResponse.redirect(destination);
  }

  return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")), request.url));
}
