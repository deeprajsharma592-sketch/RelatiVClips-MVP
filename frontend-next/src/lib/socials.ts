import { apiPath } from "./apiBase";

export type SocialPlatform = "youtube" | "instagram";

export interface ConnectedAccount {
  id: string;
  platform: SocialPlatform;
  platform_account_id?: string | null;
  name: string;
  handle: string;
  followers: string;
  avatar_url?: string | null;
  status: "connected";
  auto_publish: boolean;
  has_oauth: boolean;
  has_api_key: boolean;
  can_publish: boolean;
  connected_at?: string | null;
}

export interface AccountsResponse {
  success: boolean;
  accounts: ConnectedAccount[];
  total_connected: number;
  oauth_available: {
    youtube: boolean;
    instagram: boolean;
  };
}

export interface ScheduledPost {
  id: string;
  clip_id?: string | null;
  video_url?: string | null;
  title: string;
  caption: string;
  hashtags?: string | null;
  platforms: SocialPlatform[];
  scheduled_at: string;
  timezone_name?: string | null;
  status: "scheduled" | "publishing" | "published" | "failed" | "cancelled";
  publish_results?: Record<string, { status: string; post_url?: string; error?: string }>;
  error_message?: string | null;
  published_at?: string | null;
  created_at?: string | null;
}

export interface AnalyticsVideoItem {
  id: string;
  platform: SocialPlatform;
  title: string;
  published_at?: string | null;
  thumbnail_url?: string | null;
  views: number;
  likes: number;
  comments: number;
  url?: string | null;
}

export interface AnalyticsResponse {
  connected: boolean;
  accounts: ConnectedAccount[];
  summary: {
    views: number;
    watch_time_minutes?: number | null;
    avg_retention_pct?: number | null;
    published_count: number;
    subscribers: number;
    likes: number;
    comments: number;
  } | null;
  daily: Array<{
    date: string;
    views: number;
    watch_time_minutes?: number;
  }>;
  videos: AnalyticsVideoItem[];
  notes: string[];
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : detail?.message || data?.error || `Request failed (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export async function fetchSocialAccounts(): Promise<AccountsResponse> {
  const res = await fetch(apiPath("/api/v1/socials/accounts"), {
    credentials: "include",
  });
  return parseJsonOrThrow<AccountsResponse>(res);
}

export async function startSocialOAuth(platform: SocialPlatform): Promise<{ auth_url: string }> {
  const res = await fetch(apiPath(`/api/v1/socials/oauth/${platform}/start`), {
    credentials: "include",
  });
  return parseJsonOrThrow<{ auth_url: string }>(res);
}

export async function connectSocialAccount(payload: {
  platform: SocialPlatform;
  channel_id?: string;
  api_key?: string;
  access_token?: string;
  refresh_token?: string;
  auto_publish?: boolean;
}): Promise<{ success: boolean; account: ConnectedAccount; message: string }> {
  const res = await fetch(apiPath("/api/v1/socials/accounts/connect"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function updateSocialAccount(
  accountId: string,
  payload: { auto_publish?: boolean; api_key?: string; access_token?: string }
): Promise<{ success: boolean; account: ConnectedAccount }> {
  const res = await fetch(apiPath(`/api/v1/socials/accounts/${encodeURIComponent(accountId)}`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function refreshSocialAccount(
  accountId: string
): Promise<{ success: boolean; account: ConnectedAccount }> {
  const res = await fetch(
    apiPath(`/api/v1/socials/accounts/${encodeURIComponent(accountId)}/refresh`),
    {
      method: "POST",
      credentials: "include",
    }
  );
  return parseJsonOrThrow(res);
}

export async function disconnectSocialAccount(accountId: string): Promise<void> {
  const res = await fetch(apiPath(`/api/v1/socials/accounts/${encodeURIComponent(accountId)}`), {
    method: "DELETE",
    credentials: "include",
  });
  await parseJsonOrThrow(res);
}

export async function fetchScheduledPosts(): Promise<{ success: boolean; posts: ScheduledPost[] }> {
  const res = await fetch(apiPath("/api/v1/socials/schedule"), {
    credentials: "include",
  });
  return parseJsonOrThrow(res);
}

export async function createScheduledPost(payload: {
  clip_id?: string;
  video_url?: string;
  title: string;
  caption: string;
  hashtags?: string;
  platforms: SocialPlatform[];
  scheduled_at?: string;
  timezone_name?: string;
  publish_now?: boolean;
}): Promise<{ success: boolean; post: ScheduledPost }> {
  const res = await fetch(apiPath("/api/v1/socials/schedule"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function updateScheduledPost(
  postId: string,
  payload: {
    title?: string;
    caption?: string;
    hashtags?: string;
    platforms?: SocialPlatform[];
    scheduled_at?: string;
    status?: string;
  }
): Promise<{ success: boolean; post: ScheduledPost }> {
  const res = await fetch(apiPath(`/api/v1/socials/schedule/${encodeURIComponent(postId)}`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function publishScheduledPostNow(
  postId: string
): Promise<{ success: boolean; post: ScheduledPost }> {
  const res = await fetch(
    apiPath(`/api/v1/socials/schedule/${encodeURIComponent(postId)}/publish`),
    {
      method: "POST",
      credentials: "include",
    }
  );
  return parseJsonOrThrow(res);
}

export async function deleteScheduledPost(postId: string): Promise<void> {
  const res = await fetch(apiPath(`/api/v1/socials/schedule/${encodeURIComponent(postId)}`), {
    method: "DELETE",
    credentials: "include",
  });
  await parseJsonOrThrow(res);
}

export async function fetchSocialAnalytics(
  days: number = 7,
  platform: string = "all"
): Promise<AnalyticsResponse> {
  const res = await fetch(
    apiPath(`/api/v1/socials/analytics?days=${days}&platform=${encodeURIComponent(platform)}`),
    { credentials: "include" }
  );
  return parseJsonOrThrow<AnalyticsResponse>(res);
}

export async function configureYouTubeAnalytics(payload: {
  api_key?: string;
  channel_id?: string;
  access_token?: string;
}): Promise<{ success: boolean; account: ConnectedAccount }> {
  const res = await fetch(apiPath("/api/v1/socials/youtube-analytics/config"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}
