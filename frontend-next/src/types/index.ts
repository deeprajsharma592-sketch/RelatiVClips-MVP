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
}
