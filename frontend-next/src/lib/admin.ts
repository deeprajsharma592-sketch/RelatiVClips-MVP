import { apiPath } from "@/lib/apiBase";

export interface AdminOverview {
  generated_clips: { all_time: number; last_24h: number; last_7d: number };
  jobs: {
    all_time: number;
    completed: number;
    failed: number;
    success_rate: number;
    active_now: number;
    queued_now: number;
  };
  accounts: { all_time: number; active: number; new_last_7d: number };
  marketplace: {
    live_campaigns: number;
    submitted_clips: number;
    tracked_views: number;
    campaign_spend_cents: number;
  };
  recent_jobs: Array<{
    id: string;
    source: string;
    status: string;
    progress: number;
    created_at: string | null;
    updated_at: string | null;
    error: string | null;
  }>;
  daily_generated: Array<{ date: string; count: number }>;
  generated_at: string;
  refresh_interval_seconds: number;
}

export type AdminCollection = "users" | "jobs" | "clips" | "campaigns" | "submissions" | "applications" | "brand_contacts" | "quotes" | "system" | "audit_logs";
export interface AdminRecords {
  collection: AdminCollection;
  records: Array<Record<string, string | number | boolean | null>>;
  total: number;
  page: number;
  page_size: number;
}

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const response = await fetch(apiPath("/api/v1/admin/overview"), {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "Could not load the admin dashboard.";
    try {
      message = (await response.json()).detail || message;
    } catch {}
    if ([502, 503, 504].includes(response.status) && message === "Could not load the admin dashboard.") {
      message = "The backend is unreachable. Admin sign-in and account setup are unavailable until the API connection is restored.";
    }
    throw new AdminApiError(message, response.status);
  }
  return response.json();
}

export async function fetchAdminRecords(collection: AdminCollection, page: number, q: string): Promise<AdminRecords> {
  const params = new URLSearchParams({ collection, page: String(page), page_size: "25", q });
  const response = await fetch(`${apiPath("/api/v1/admin/records")}?${params}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "Could not load platform records.";
    try { message = (await response.json()).detail || message; } catch {}
    throw new AdminApiError(message, response.status);
  }
  return response.json();
}

export async function sendSmtpTest(to = "deepraj@relativclips.com"): Promise<{ ok: boolean; to: string; detail: string }> {
  const response = await fetch(apiPath("/api/v1/admin/smtp-test"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to }),
  });
  if (!response.ok) {
    let message = "SMTP test failed.";
    try { message = (await response.json()).detail || message; } catch {}
    throw new AdminApiError(message, response.status);
  }
  return response.json();
}

export async function requestAdmin2faChallenge(): Promise<{ ok: boolean; challenge_id: string; expires_in_seconds: number }> {
  const response = await fetch(apiPath("/api/v1/admin/2fa/challenge"), {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    let message = `Could not send 2FA verification code (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      message = body.detail || body.error || body.message || message;
    } catch {}
    throw new AdminApiError(message, response.status);
  }
  return response.json();
}

export async function verifyAdmin2faChallenge(challengeId: string, code: string): Promise<{ ok: boolean }> {
  const response = await fetch(apiPath("/api/v1/admin/2fa/verify"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge_id: challengeId, code: code.trim() }),
  });
  if (!response.ok) {
    let message = "Invalid verification code.";
    try { message = (await response.json()).detail || message; } catch {}
    throw new AdminApiError(message, response.status);
  }
  return response.json();
}
