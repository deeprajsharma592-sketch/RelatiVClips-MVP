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

function b64urlToBuf(b64url: string): ArrayBuffer {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufToB64url(buf: ArrayBuffer | null | undefined): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function fetchAdminPasskeyStatus(): Promise<{ configured: boolean; count: number }> {
  const response = await fetch(apiPath("/api/v1/admin/passkey/status"), {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    return { configured: false, count: 0 };
  }
  return response.json();
}

export async function registerAdminPasskey(payload?: {
  email?: string;
  password?: string;
  label?: string;
}): Promise<{ ok: boolean }> {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new AdminApiError("Passkeys (WebAuthn) are not supported in this browser.", 400);
  }
  const optRes = await fetch(apiPath("/api/v1/admin/passkey/register/options"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!optRes.ok) {
    let msg = `Could not start passkey setup (HTTP ${optRes.status}).`;
    try {
      const b = await optRes.json();
      msg = b.detail || b.error || msg;
    } catch {}
    throw new AdminApiError(msg, optRes.status);
  }
  const opts = await optRes.json();

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: b64urlToBuf(opts.challenge),
      rp: opts.rp,
      user: {
        id: b64urlToBuf(opts.user.id),
        name: opts.user.name,
        displayName: opts.user.displayName,
      },
      pubKeyCredParams: opts.pubKeyCredParams,
      authenticatorSelection: opts.authenticatorSelection,
      timeout: opts.timeout || 60000,
    },
  })) as PublicKeyCredential | null;

  if (!cred) {
    throw new AdminApiError("Passkey registration was cancelled.", 400);
  }
  const res = cred.response as AuthenticatorAttestationResponse;
  const spki = typeof res.getPublicKey === "function" ? res.getPublicKey() : null;
  if (!spki) {
    throw new AdminApiError("Browser did not return a passkey public key.", 400);
  }

  const verifyRes = await fetch(apiPath("/api/v1/admin/passkey/register/verify"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challenge_id: opts.challenge_id,
      credential_id: bufToB64url(cred.rawId),
      public_key_spki: bufToB64url(spki),
      client_data_json: bufToB64url(res.clientDataJSON),
      authenticator_data: bufToB64url(res.getAuthenticatorData ? res.getAuthenticatorData() : null),
      label: payload?.label || "Mac Touch ID",
    }),
  });
  if (!verifyRes.ok) {
    let msg = `Passkey registration failed (HTTP ${verifyRes.status}).`;
    try {
      const b = await verifyRes.json();
      msg = b.detail || b.error || msg;
    } catch {}
    throw new AdminApiError(msg, verifyRes.status);
  }
  return verifyRes.json();
}

export async function loginWithAdminPasskey(): Promise<{ ok: boolean; email?: string }> {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new AdminApiError("Passkeys (WebAuthn) are not supported in this browser.", 400);
  }
  const optRes = await fetch(apiPath("/api/v1/admin/passkey/login/options"), {
    method: "POST",
    credentials: "include",
  });
  if (!optRes.ok) {
    let msg = `Could not start passkey sign-in (HTTP ${optRes.status}).`;
    try {
      const b = await optRes.json();
      msg = b.detail || b.error || msg;
    } catch {}
    throw new AdminApiError(msg, optRes.status);
  }
  const opts = await optRes.json();

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: b64urlToBuf(opts.challenge),
      rpId: opts.rpId,
      allowCredentials: (opts.allowCredentials || []).map((c: { id: string; type: PublicKeyCredentialType }) => ({
        id: b64urlToBuf(c.id),
        type: c.type,
      })),
      userVerification: "required",
      timeout: opts.timeout || 60000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new AdminApiError("Passkey verification was cancelled.", 400);
  }
  const res = assertion.response as AuthenticatorAssertionResponse;

  const verifyRes = await fetch(apiPath("/api/v1/admin/passkey/login/verify"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challenge_id: opts.challenge_id,
      credential_id: bufToB64url(assertion.rawId),
      client_data_json: bufToB64url(res.clientDataJSON),
      authenticator_data: bufToB64url(res.authenticatorData),
      signature: bufToB64url(res.signature),
    }),
  });
  if (!verifyRes.ok) {
    let msg = `Passkey sign-in failed (HTTP ${verifyRes.status}).`;
    try {
      const b = await verifyRes.json();
      msg = b.detail || b.error || msg;
    } catch {}
    throw new AdminApiError(msg, verifyRes.status);
  }
  return verifyRes.json();
}
