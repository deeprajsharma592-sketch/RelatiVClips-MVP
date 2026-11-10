import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendBase = process.env.BACKEND_BASE_URL || "";
  // Return the direct backend upload endpoint so browsers bypass Vercel's 4.5MB payload limit
  return NextResponse.json({
    uploadUrl: backendBase ? `${backendBase.replace(/\/+$/, "")}/upload` : "/api/proxy/upload",
  });
}
