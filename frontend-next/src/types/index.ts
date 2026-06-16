export type ProcessState = "idle" | "processing" | "completed" | "error";

export type TaskStatus = "queued" | "processing" | "complete" | "failed";

export interface Clip {
  clip_id: string;
  start: number;
  end: number;
  duration_s: number;
  caption: string;
  viral_title: string;
  hashtags: string;
  file_path: string;
  file_size_mb: number;
  created_at: string;
}

export interface ProcessStep {
  label: string;
  status: "pending" | "active" | "done" | "error";
}

export interface ProcessInitResponse {
  taskId: string;
  status: TaskStatus;
  position?: number | null;
}

export interface StatusResponse {
  task_id: string;
  status: TaskStatus;
  current_step?: string | null;
  progress?: number | null;
  step_number?: number | null;
  total_steps?: number | null;
  step_name?: string | null;
  time_elapsed_seconds?: number | null;
  time_estimate_seconds?: number | null;
  clips?: Clip[] | null;
  error?: string | null;
  // Cost (NEW 2026-06-16)
  llm_cost_usd?: number | null;
  cost_per_clip_usd?: number | null;
  llm_provider?: string | null;
  clips_verified?: number | null;
  clips_unverified?: number | null;
  clips_requested?: number | null;
  // Cache (NEW 2026-06-16)
  cache_hit?: boolean | null;
  cache_age_hours?: number | null;
  cache_savings_usd?: number | null;
  // Per-stage timing (NEW 2026-06-16)
  step_times?: Array<{ step: number; duration_s: number; started_at: string }> | null;
  started_at?: string | null;
}

export interface PipelineStep {
  number: number;
  label: string;
  sub: string;
  icon: string;  // emoji or icon name
  /** Visual "vibe" key — drives the per-stage animation */
  vibe: "fetch" | "audio" | "transcribe" | "llm" | "face" | "render";
}
