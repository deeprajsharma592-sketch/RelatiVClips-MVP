import type { ProcessInitResponse, StatusResponse, Clip } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
