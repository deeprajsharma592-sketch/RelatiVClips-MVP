"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Film,
  Download,
  Trash2,
  ExternalLink,
  Search,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { type StoredProject, deleteProject } from "@/lib/projectStorage";
import { apiPath } from "@/lib/apiBase";

interface ProjectsViewProps {
  projects: StoredProject[];
  onSelectProject: (projectId: string) => void;
  onRefresh: () => void;
  onNewClip: () => void;
}

export default function ProjectsView({
  projects,
  onSelectProject,
  onRefresh,
  onNewClip,
}: ProjectsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "processing">("all");

  const filteredProjects = projects.filter((p) => {
    const title = p?.title || "";
    const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filter === "all" ? true : filter === "ready" ? p.status === "ready" : p.status === "processing";
    return matchesSearch && matchesFilter;
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this project?")) {
      deleteProject(id);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* ── Title & Search Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            My Projects
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Access past auto-clipped footage, generated 9:16 vertical edits, and transcripts.
          </p>
        </div>

        <button
          onClick={onNewClip}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-white text-black hover:bg-zinc-200 transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search projects..."
            className="w-full rounded-lg bg-white/[0.03] border border-white/10 pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs">
          {(["all", "ready", "processing"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-md font-medium capitalize transition cursor-pointer ${
                filter === tab
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── PROJECTS GRID ── */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const clipCount = project.clips ? project.clips.length : 0;
            const topScore =
              project.clips && project.clips.length > 0
                ? Math.max(...project.clips.map((c) => c.hook_score || 0))
                : null;

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className="rounded-xl border border-white/[0.08] bg-[#121215] overflow-hidden flex flex-col justify-between shadow-md cursor-pointer hover:border-white/20 transition group"
              >
                {/* Visual Header / Cover */}
                <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
                  {project.clips && project.clips[0]?.thumbnail_url ? (
                    <img
                      src={
                        project.clips[0].thumbnail_url.startsWith("http")
                          ? project.clips[0].thumbnail_url
                          : apiPath(project.clips[0].thumbnail_url)
                      }
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500">
                      <Film className="w-5 h-5 text-zinc-400" />
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    {project.status === "ready" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {clipCount} Clips Ready
                      </span>
                    ) : project.status === "failed" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30 backdrop-blur-md">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/20 text-white border border-white/30 backdrop-blur-md animate-pulse">
                        <Clock className="w-2.5 h-2.5" />
                        Processing
                      </span>
                    )}
                  </div>

                  {topScore && (
                    <div className="absolute top-2.5 right-2.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-black shadow-sm">
                        ⚡ {topScore}
                      </span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-semibold text-white line-clamp-1 group-hover:text-zinc-200 transition">
                      {project.title}
                    </h3>
                    <p className="text-[10px] text-zinc-500">
                      Created {new Date(project.createdAt).toLocaleDateString()} · {clipCount} clips
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
                    <span className="text-white font-medium text-xs group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Open in Studio <ArrowRight className="w-3 h-3" />
                    </span>

                    <button
                      onClick={(e) => handleDelete(e, project.id)}
                      className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-10 text-center space-y-3">
          <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-zinc-500">
            <FolderOpen className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="space-y-1 max-w-xs mx-auto">
            <h3 className="text-sm font-semibold text-white">No projects found</h3>
            <p className="text-xs text-zinc-500">
              {searchTerm
                ? "Try searching for another keyword."
                : "Drop a YouTube link on the Home tab to start your first project."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
