import { NextResponse } from "next/server";
import { getBackendBase } from "@/lib/backend-base";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendBase = getBackendBase();
  // Return the direct backend upload endpoint so browsers bypass Vercel's 4.5MB payload limit
  return NextResponse.json({
    uploadUrl: backendBase ? `${backendBase.replace(/\/+$/, "")}/upload` : "/api/proxy/upload",
  });
}
