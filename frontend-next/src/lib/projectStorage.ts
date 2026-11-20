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
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const now = Date.now();

    // Sanitize and normalize every project item
    const valid: StoredProject[] = list
      .filter((p): p is Record<string, any> => Boolean(p && typeof p === "object"))
      .map((p) => {
        const id = typeof p.id === "string" && p.id.trim() ? p.id : `proj-${Math.random().toString(36).slice(2, 9)}`;
        const title = typeof p.title === "string" && p.title.trim() ? p.title : "Short Form Video";
        const createdAt = typeof p.createdAt === "number" && !isNaN(p.createdAt) ? p.createdAt : now;
        const expiresAt = typeof p.expiresAt === "number" && !isNaN(p.expiresAt) ? p.expiresAt : now + RETENTION_MS;
        const status = p.status === "ready" || p.status === "failed" ? p.status : "processing";
        const progress = typeof p.progress === "number" ? p.progress : 100;
        const clips = Array.isArray(p.clips) ? p.clips.filter((c: any) => c && typeof c === "object") : [];

        return {
          id,
          title,
          createdAt,
          expiresAt,
          status,
          progress,
          taskId: typeof p.taskId === "string" ? p.taskId : undefined,
          clips,
        };
      })
      .filter(
        (p) =>
          p.expiresAt > now &&
          !p.id.startsWith("proj-demo-") &&
          !p.title.toLowerCase().includes("joe rogan") &&
          !p.title.toLowerCase().includes("huberman")
      );

    if (valid.length !== list.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch (e) {
    console.warn("Could not read stored projects:", e);
    return [];
  }
}

export function saveProject(project: StoredProject): void {
  if (typeof window === "undefined" || !project) return;
  try {
    const safeProject: StoredProject = {
      ...project,
      title: project.title || "Short Form Video",
      clips: Array.isArray(project.clips) ? project.clips : [],
      createdAt: project.createdAt || Date.now(),
      expiresAt: project.expiresAt || Date.now() + RETENTION_MS,
    };
    const existing = getStoredProjects().filter((p) => p.id !== safeProject.id);
    existing.unshift(safeProject);
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
  if (typeof window === "undefined" || !id) return;
  try {
    const list = getStoredProjects();
    const target = list.find((p) => p.id === id);
    if (target) {
      target.status = status;
      target.progress = progress;
      target.clips = Array.isArray(clips) ? clips : [];
      saveProject(target);
    }
  } catch {}
}

export function deleteProject(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const list = getStoredProjects().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export function clearAllStoredProjects(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function getRemainingTimeFormatted(expiresAt: number): string {
  if (!expiresAt) return "4d";
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  return `${Math.max(1, hours)}h`;
}
