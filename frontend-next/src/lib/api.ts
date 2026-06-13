import type { ProcessInitResponse, StatusResponse, Clip as PipelineClip } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ──────────────────────────────────────────────────────────────────────────
   Creator dashboard types + fetcher
   ──────────────────────────────────────────────────────────────────────────
   Shape mirrors /api/v1/dashboard/creator (see backend/routers/dashboard_router.py).
   All money values are integer cents — UI converts to dollars on display.
*/

export interface CreatorDashboardKpis {
  earnings_cents_month: number;
  earnings_change_pct: number;
  auto_clips_count: number;
  channels_count: number;
  open_deals_cents: number;
}

export interface CreatorEarningsPoint {
  month: string; // "Jan", "Feb", ...
  cents: number;
}

export interface CreatorAutoClip {
  id: string;
  title: string;
  source_url: string;
  duration_s: number;
  hook: string;
  platform: string; // tiktok | instagram | youtube_shorts | ...
  generated_at: string; // ISO
  status: string; // ready | processing | ...
  viral_score: number; // 0-100
}

export interface CreatorChannel {
  platform: string;
  handle: string;
  url: string;
  total_views: number;
  monthly_earnings_cents: number;
}

export interface CreatorBrandDeal {
  id: string;
  brand_name: string;
  vertical: string;
  value_cents: number;
  status: string; // pending | negotiating | signed | rejected | expired | ...
  expires_at: string; // ISO
}

export interface CreatorDashboardData {
  kpis: CreatorDashboardKpis;
  earnings_chart: CreatorEarningsPoint[];
  auto_clips: CreatorAutoClip[];
  channels: CreatorChannel[];
  brand_deals: CreatorBrandDeal[];
}

/**
 * Fetch the creator dashboard payload from the backend.
 *
 * Uses the same-origin /api/proxy/api/v1/... path so the Vercel edge
 * function attaches origin/CORS headers and forwards our HttpOnly session
 * cookie. Relative URL = same origin = cookie sent automatically.
 */
export async function fetchCreatorDashboard(): Promise<CreatorDashboardData> {
  const res = await fetch("/api/proxy/api/v1/dashboard/creator", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch {
      // not JSON
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function submitYouTubeUrl(
  url: string
): Promise<ProcessInitResponse> {
  const res = await fetch(`${API_BASE}/process/youtube`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed with status ${res.status}`);
  }

  const data = await res.json();
  return {
    taskId: data.task_id,
    status: data.status,
    position: data.position,
  };
}

export async function checkProcessingStatus(
  taskId: string
): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/status/${taskId}`);

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Task not found. It may have expired.");
    }
    throw new Error(`Status check failed: ${res.status}`);
  }

  return res.json();
}


/* ──────────────────────────────────────────────────────────────────────────
   Email-auth (forgot-password, reset, verify)
   ──────────────────────────────────────────────────────────────────────────
   All endpoints go through the same-origin /api/proxy/api/v1/... path
   so the Vercel edge forwards the HttpOnly cookie. For forgot-password
   the cookie is irrelevant; for verify-email via GET, the token comes
   from the URL; for resend-verification we DO need the cookie.
*/

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const res = await fetch("/api/proxy/api/v1/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch("/api/proxy/api/v1/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Reset failed (${res.status})`);
  }
  return res.json();
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const res = await fetch(`/api/proxy/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Verification failed (${res.status})`);
  }
  return res.json();
}

export async function resendVerification(): Promise<{ message: string }> {
  const res = await fetch("/api/proxy/api/v1/auth/resend-verification", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Resend failed (${res.status})`);
  }
  return res.json();
}


/* ──────────────────────────────────────────────────────────────────────────
   Billing (Stripe)
   ──────────────────────────────────────────────────────────────────────────
   All endpoints go through /api/proxy/api/v1/... (same-origin so cookies
   are sent on the authed calls). The /config endpoint is public; the rest
   require a session.
*/

export interface BillingPlan {
  key: string;
  label: string;
  amount_cents: number;
  tier: string;
  description: string;
  available: boolean;
}

export interface BillingConfig {
  stripe_enabled: boolean;
  publishable_key: string;
  plans: BillingPlan[];
}

export interface SubscriptionInfo {
  tier: string;
  status: string;
  renews_at: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  has_payment_method: boolean;
}

export async function getBillingConfig(): Promise<BillingConfig> {
  const res = await fetch("/api/proxy/api/v1/billing/config");
  if (!res.ok) {
    throw new Error(`Billing config failed (${res.status})`);
  }
  return res.json();
}

export async function createCheckout(plan: string): Promise<{ checkout_url: string; plan: string; amount_cents: number; publishable_key: string }> {
  const res = await fetch("/api/proxy/api/v1/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Checkout failed (${res.status})`);
  }
  return res.json();
}

export async function createPortal(): Promise<{ portal_url: string }> {
  const res = await fetch("/api/proxy/api/v1/billing/portal", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Portal failed (${res.status})`);
  }
  return res.json();
}

export async function getSubscription(): Promise<SubscriptionInfo> {
  const res = await fetch("/api/proxy/api/v1/billing/subscription", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Subscription fetch failed (${res.status})`);
  }
  return res.json();
}

export async function pollUntilComplete(
  taskId: string,
  onProgress?: (
    progress: number,
    status: string,
    stepName: string | null,
    response?: StatusResponse
  ) => void,
  intervalMs: number = 2000
): Promise<StatusResponse> {
  let attempts = 0;
  const maxAttempts = 180;

  while (attempts < maxAttempts) {
    const response = await checkProcessingStatus(taskId);

    onProgress?.(
      response.progress ?? 0,
      response.status,
      response.step_name ?? response.current_step ?? null,
      response
    );

    if (response.status === "complete") {
      return response;
    }

    if (response.status === "failed") {
      throw new Error(response.error || "Processing failed");
    }

    await delay(intervalMs);
    attempts++;
  }

  throw new Error("Processing timed out after maximum polling attempts");
}

export function getDownloadUrl(clipId: string): string {
  return `${API_BASE}/download/${clipId}`;
}

// ─── Clipper dashboard (live data) ──────────────────────────────────────
//
// The dashboard is fetched via the Vercel Edge proxy so the browser can
// reach the Hetzner backend across Cloudflare with proper cookie handling
// and timeout. The page is responsible for the loading / error / empty
// states; this helper just performs the round-trip.

export interface ClipperDashboardKpis {
  earnings_cents_week: number;
  earnings_change_pct: number;
  clips_live: number;
  pending_payout_cents: number;
  lifetime_earnings_cents: number;
  avg_cpm_cents: number;
}

export interface ClipperWeekPoint {
  date: string; // YYYY-MM-DD
  earnings_cents: number;
}

export interface ClipperOpenCampaign {
  id: string;
  brand_name: string;
  vertical: string;
  cpm_cents: number;
  slots_total: number;
  slots_filled: number;
  deadline: string | null; // ISO datetime
  premium: boolean;
  brief: string;
}

export interface ClipperRecentClip {
  id: string;
  campaign_id: string;
  title: string;
  hook: string | null;
  caption: string | null;
  platform: string;
  posted_url: string | null;
  duration_s: number | null;
  thumbnail_url: string | null;
  status: string;
  views: number;
  earnings_cents: number;
  submitted_at: string | null;
  approved_at: string | null;
  verified_at: string | null;
  paid_at: string | null;
  campaign_name: string;
}

export interface ClipperDashboardData {
  kpis: ClipperDashboardKpis;
  week_chart: ClipperWeekPoint[];
  open_campaigns: ClipperOpenCampaign[];
  recent_clips: ClipperRecentClip[];
}

export async function fetchClipperDashboard(): Promise<ClipperDashboardData> {
  const res = await fetch(`/api/proxy/api/v1/dashboard/clipper`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.detail ||
        err.error ||
        `Dashboard request failed with status ${res.status}`
    );
  }
  return res.json();
}

// ─── Brand dashboard ──────────────────────────────────────────────────────
//
// All dashboard fetches go through /api/proxy/* so the Vercel edge function
// can attach the right origin/CORS headers and forward our HttpOnly session
// cookie. Relative URL = same origin = cookie sent automatically.

export interface BrandDashboardKpis {
  spent_cents: number;
  spent_change_pct: number;
  active_campaigns: number;
  active_change_pct: number;
  total_views: number;
  views_change_pct: number;
  avg_cpm_cents: number;
}

export interface BrandDashboardCampaign {
  id: string;
  name: string;
  brief: string;
  vertical: string;
  cpm_cents: number;
  budget_cents: number;
  spent_cents: number;
  slots_total: number;
  slots_filled: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  clips: { total: number; approved: number; pending: number };
}

export interface BrandDashboardPendingClip {
  id: string;
  campaign_name: string;
  campaign_id: string;
  clipper_name: string;
  clipper_handle: string;
  title: string;
  hook: string;
  duration_s: number;
  platform: string;
  thumbnail_url: string | null;
  submitted_at: string | null;
  submitted_minutes_ago: number;
}

export interface BrandDashboardWeekPoint {
  date: string;
  views: number;
  approved_clips: number;
}

export interface BrandDashboardResponse {
  kpis: BrandDashboardKpis;
  campaigns: BrandDashboardCampaign[];
  pending_clips: BrandDashboardPendingClip[];
  week_chart: BrandDashboardWeekPoint[];
}

export async function getBrandDashboard(): Promise<BrandDashboardResponse> {
  const res = await fetch("/api/proxy/api/v1/dashboard/brand", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch {
      // body wasn't JSON
    }
    throw new Error(detail);
  }
  return res.json();
}


// ─────────────────────────────────────────────────────────────────────
// Tier 2 — Marketplace (campaigns, claims, clips, verification)
// ─────────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  brand_user_id: string;
  name: string;
  brief: string;
  vertical: string | null;
  source_handle: string | null;
  cpm_cents: number;
  budget_cents: number;
  spent_cents: number;
  slots_total: number;
  slots_filled: number;
  slots_remaining: number;
  status: CampaignStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  claim_count: number;
  clip_count: number;
}

export type CampaignStatus = "draft" | "live" | "paused" | "completed" | "cancelled";

export interface Claim {
  id: string;
  campaign_id: string;
  clipper_user_id: string;
  status: "claimed" | "submitted" | "approved" | "rejected" | "expired";
  claimed_at: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
  campaign?: {
    id: string;
    name: string;
    cpm_cents: number;
    status: string;
    vertical: string | null;
  } | null;
  clipper?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Clip {
  id: string;
  campaign_id: string;
  claim_id: string;
  clipper_user_id: string;
  title: string;
  hook: string;
  caption: string;
  platform: "tiktok" | "instagram" | "youtube_shorts" | "twitter" | "x" | null;
  posted_url: string | null;
  duration_s: number | null;
  thumbnail_url: string | null;
  status: "submitted" | "approved" | "live" | "rejected" | "verified" | "paid";
  views: number;
  earnings_cents: number;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  verified_at: string | null;
  paid_at: string | null;
  brand_notes: string | null;
  campaign?: { id: string; name: string; cpm_cents: number } | null;
  clipper?: { id: string; name: string; email: string };
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch { /* not JSON */ }
    throw new Error(detail);
  }
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      detail = errBody.detail || errBody.error || detail;
    } catch { /* not JSON */ }
    throw new Error(detail);
  }
  return res.json();
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      detail = errBody.detail || errBody.error || detail;
    } catch { /* not JSON */ }
    throw new Error(detail);
  }
  return res.json();
}

// Campaigns
export const listCampaigns = (params: { mine?: boolean; status?: string; q?: string } = {}) => {
  const search = new URLSearchParams();
  if (params.mine) search.set("mine", "true");
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return apiGet<{ items: Campaign[]; total: number }>(`/api/v1/campaigns${qs ? `?${qs}` : ""}`);
};

export const getCampaign = (id: string) => apiGet<Campaign>(`/api/v1/campaigns/${id}`);

export interface CampaignCreatePayload {
  name: string;
  brief: string;
  vertical?: string;
  source_handle?: string;
  cpm_cents: number;
  budget_cents: number;
  slots_total: number;
  ends_at?: string | null;
}

export const createCampaign = (payload: CampaignCreatePayload) =>
  apiPost<Campaign>("/api/v1/campaigns", payload);

export const pauseCampaign = (id: string) => apiPost<Campaign>(`/api/v1/campaigns/${id}/pause`, {});
export const resumeCampaign = (id: string) => apiPost<Campaign>(`/api/v1/campaigns/${id}/resume`, {});
export const completeCampaign = (id: string) => apiPost<Campaign>(`/api/v1/campaigns/${id}/complete`, {});
export const cancelCampaign = (id: string) => apiDelete<Campaign>(`/api/v1/campaigns/${id}`);

// Claims
export const claimSlot = (campaignId: string) =>
  apiPost<Claim>(`/api/v1/campaigns/${campaignId}/claim`, {});

export const releaseClaim = (campaignId: string) =>
  apiDelete<{ released: boolean; id: string }>(`/api/v1/campaigns/${campaignId}/claim`);

export const listCampaignClaims = (campaignId: string) =>
  apiGet<{ items: Claim[]; total: number }>(`/api/v1/campaigns/${campaignId}/claims`);

export const myClaims = () =>
  apiGet<{ items: Claim[]; total: number }>("/api/v1/me/claims");

// Clips
export interface ClipSubmitPayload {
  title: string;
  hook: string;
  caption: string;
  platform: "tiktok" | "instagram" | "youtube_shorts" | "twitter" | "x";
  posted_url: string;
  duration_s: number;
  thumbnail_url?: string;
}

export const submitClip = (claimId: string, payload: ClipSubmitPayload) =>
  apiPost<Clip>(`/api/v1/claims/${claimId}/clips`, payload);

export const approveClip = (clipId: string) =>
  apiPost<Clip>(`/api/v1/clips/${clipId}/approve`, {});

export const rejectClip = (clipId: string, reason: string) =>
  apiPost<Clip>(`/api/v1/clips/${clipId}/reject`, { reason });

export const listMyClips = () =>
  apiGet<{ items: Clip[]; total: number }>("/api/v1/me/clips");

export const listCampaignClips = (campaignId: string) =>
  apiGet<{ items: Clip[]; total: number }>(`/api/v1/campaigns/${campaignId}/clips`);

export const listPendingReview = () =>
  apiGet<{ items: Clip[]; total: number }>("/api/v1/clips/pending-review");

// Verification
export const runVerification = () =>
  apiPost<{ updated: number; verified: number; total_views_added: number; ran_at: string }>(
    "/api/v1/verification/run",
    {}
  );
