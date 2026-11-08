import type { Clip } from "@/types";

export interface StoredProject {
  id: string;
  title: string;
  createdAt: number;
  expiresAt: number; // 4 days TTL
  status: "processing" | "ready" | "failed";
  progress?: number;
  taskId?: string;
  clips: Clip[];
}

const STORAGE_KEY = "relativ_studio_projects_v2";
const RETENTION_MS = 4 * 24 * 60 * 60 * 1000; // 4 days

export function getStoredProjects(): StoredProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: StoredProject[] = JSON.parse(raw);
    const now = Date.now();
    // Filter out expired items (older than 4 days)
    const valid = list.filter((p) => p.expiresAt > now);
    if (valid.length !== list.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return [];
  }
}

export function saveProject(project: StoredProject): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredProjects().filter((p) => p.id !== project.id);
    existing.unshift(project);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {}
}

export function createNewProject(title: string, taskId?: string): StoredProject {
  const now = Date.now();
  const project: StoredProject = {
    id: "proj-" + Math.random().toString(36).substring(2, 9),
    title: title || "Short Form Video",
    createdAt: now,
    expiresAt: now + RETENTION_MS,
    status: "processing",
    progress: 10,
    taskId,
    clips: [],
  };
  saveProject(project);
  return project;
}

export function updateProjectStatus(
  id: string,
  status: "processing" | "ready" | "failed",
  clips: Clip[] = [],
  progress = 100
): void {
  if (typeof window === "undefined") return;
  try {
    const list = getStoredProjects();
    const target = list.find((p) => p.id === id);
    if (target) {
      target.status = status;
      target.progress = progress;
      if (clips.length > 0) target.clips = clips;
      saveProject(target);
    }
  } catch {}
}

export function getRemainingTimeFormatted(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${mins}m`;
}
