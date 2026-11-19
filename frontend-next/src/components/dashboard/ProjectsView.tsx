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
  Play,
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
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
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
    <div className="space-y-8 pb-16">
      {/* ── Title & Search Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-2">
            <FolderOpen className="w-3.5 h-3.5 text-purple-400" />
            Workspace Storage
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            My Projects
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Access past auto-clipped footage, generated 9:16 vertical edits, and transcripts.
          </p>
        </div>

        <button
          onClick={onNewClip}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-white text-black hover:bg-zinc-100 transition shadow-lg cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-black" />
          <span>+ New Clip Project</span>
        </button>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search projects..."
            className="w-full rounded-xl bg-white/[0.03] border border-white/10 pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
          {(["all", "ready", "processing"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-lg font-medium capitalize transition cursor-pointer ${
                filter === tab
                  ? "bg-white/15 text-white shadow-sm"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const clipCount = project.clips ? project.clips.length : 0;
            const topScore =
              project.clips && project.clips.length > 0
                ? Math.max(...project.clips.map((c) => c.hook_score || 0))
                : null;

            return (
              <motion.div
                key={project.id}
                whileHover={{ y: -3 }}
                onClick={() => onSelectProject(project.id)}
                className="rounded-2xl border border-white/10 bg-[#0B0C10] overflow-hidden flex flex-col justify-between shadow-xl cursor-pointer hover:border-cyan-500/30 transition group"
              >
                {/* Visual Header / Cover */}
                <div className="relative aspect-video w-full bg-[#12141C] flex items-center justify-center overflow-hidden">
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
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500">
                      <Film className="w-6 h-6 text-zinc-400" />
                    </div>
                  )}

                  {/* Status Overlay */}
                  <div className="absolute top-3 left-3">
                    {project.status === "ready" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
                        <CheckCircle2 className="w-3 h-3" />
                        {clipCount} Clips Ready
                      </span>
                    ) : project.status === "failed" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 backdrop-blur-md">
                        <AlertCircle className="w-3 h-3" />
                        Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 backdrop-blur-md animate-pulse">
                        <Clock className="w-3 h-3" />
                        Processing
                      </span>
                    )}
                  </div>

                  {topScore && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-black shadow-md">
                        ⚡ {topScore} Viral
                      </span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-cyan-300 transition">
                      {project.title}
                    </h3>
                    <p className="text-[11px] text-zinc-400 flex items-center gap-2">
                      <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{project.clips.length} generated outputs</span>
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-cyan-400 font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      Open in Studio <ArrowRight className="w-3 h-3" />
                    </span>

                    <button
                      onClick={(e) => handleDelete(e, project.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-[#0B0C10] p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-zinc-500">
            <FolderOpen className="w-6 h-6 text-zinc-400" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-white">No projects found</h3>
            <p className="text-xs text-zinc-400">
              {searchTerm
                ? "Try searching for a different keyword or clearing your filter."
                : "You haven't generated any clips yet. Drop a YouTube link or upload a video on the Home tab!"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
