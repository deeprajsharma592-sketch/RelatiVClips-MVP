import { apiPath } from "./apiBase";

export type FeedbackEventType =
  | "like"
  | "unlike"
  | "dislike"
  | "undislike"
  | "download"
  | "dismiss_popup";

export interface FeedbackPayload {
  event_type: FeedbackEventType;
  reason_codes?: string[];
  reason_other_text?: string;
  clip_version?: string;
  model_version?: string;
}

export interface FeedbackResponse {
  status: string;
  event_id: string;
  clip_id: string;
  event_type: string;
  points: number;
  is_duplicate: boolean;
  created_at: string;
}

/**
 * Send user feedback for a generated clip to the server.
 * Points are calculated server-side; client sends only the event and reasons.
 */
export async function sendClipFeedback(
  clipId: string,
  payload: FeedbackPayload
): Promise<FeedbackResponse> {
  const response = await fetch(apiPath(`/api/v1/clips/${encodeURIComponent(clipId)}/feedback`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Feedback submission failed with HTTP ${response.status}`
    );
  }

  return response.json();
}
