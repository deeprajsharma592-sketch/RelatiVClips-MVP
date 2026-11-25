import type { Clip } from "@/types";

export interface StoredProject {
  id: string;
  title: string;
  createdAt: number;
  expiresAt: number; // 7-day TTL
  status: "processing" | "ready" | "failed";
  progress?: number;
  taskId?: string;
  sourceThumbnailUrl?: string;
  clips: Clip[];
}

const STORAGE_KEY = "relativ_studio_projects_v2";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function formatProjectTitle(title?: string): string {
  if (!title || !title.trim() || title === "My Clips Project") {
    return "Youtube Video";
  }
  const clean = title.trim();
  // If already in Youtube Video : "..." format
  if (/^Youtube Video\s*:\s*".*"/i.test(clean)) {
    return clean;
  }
  // Matches "YouTube video · <ID>" or "YouTube video - <ID>"
  const match = clean.match(/^YouTube video\s*[·•-]\s*([A-Za-z0-9_-]{11})$/i);
  if (match) {
    return `Youtube Video : "${match[1]}"`;
  }
  return clean;
}

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
        const rawTitle = typeof p.title === "string" && p.title.trim() ? p.title : "Short Form Video";
        const title = formatProjectTitle(rawTitle);
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
          sourceThumbnailUrl: typeof p.sourceThumbnailUrl === "string" ? p.sourceThumbnailUrl : undefined,
          clips,
        };
      })
      .filter(
        (p) =>
          p.expiresAt > now &&
          (p.clips.length > 0 || (p.status === "processing" && now - p.createdAt < 30 * 60 * 1000)) &&
          !p.id.startsWith("proj-demo-") &&
          !p.title.toLowerCase().includes("joe rogan") &&
          !p.title.toLowerCase().includes("huberman")
      );

    const byTaskId = new Map<string, StoredProject>();
    const withoutTaskId: StoredProject[] = [];
    for (const project of valid) {
      if (!project.taskId) {
        withoutTaskId.push(project);
        continue;
      }
      const previous = byTaskId.get(project.taskId);
      if (!previous || project.clips.length > previous.clips.length ||
        (project.clips.length === previous.clips.length && project.createdAt > previous.createdAt)) {
        byTaskId.set(project.taskId, project);
      }
    }
    const unique = [...byTaskId.values(), ...withoutTaskId].sort((a, b) => b.createdAt - a.createdAt);
    if (unique.length !== list.length || valid.length !== list.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
    }
    return unique;
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

export function updateProjectTaskId(id: string, taskId: string): void {
  if (typeof window === "undefined" || !id || !taskId) return;
  const project = getStoredProjects().find((item) => item.id === id);
  if (project) saveProject({ ...project, taskId });
}

export function updateProjectSource(
  id: string,
  sourceName?: string | null,
  sourceThumbnailUrl?: string | null,
): void {
  if (typeof window === "undefined" || !id) return;
  const project = getStoredProjects().find((item) => item.id === id);
  if (!project) return;
  saveProject({
    ...project,
    title: sourceName?.trim() || project.title,
    sourceThumbnailUrl: sourceThumbnailUrl || project.sourceThumbnailUrl,
  });
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

export async function resolveYouTubeVideoTitles(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return false;

    let updated = false;
    for (const proj of list) {
      if (!proj || typeof proj.title !== "string") continue;
      // If title is Youtube Video : "3CzfMXQs0rA" or YouTube video · 3CzfMXQs0rA (raw 11-char ID)
      const match =
        proj.title.match(/^Youtube Video\s*:\s*"([A-Za-z0-9_-]{11})"$/i) ||
        proj.title.match(/^YouTube video\s*[·•-]\s*([A-Za-z0-9_-]{11})$/i);
      if (match) {
        const videoId = match[1];
        try {
          const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.title) {
              proj.title = `Youtube Video : "${data.title.trim()}"`;
              updated = true;
            }
          }
        } catch {}
      }
    }
    if (updated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
    return updated;
  } catch {
    return false;
  }
}
