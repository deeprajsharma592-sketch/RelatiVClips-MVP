"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { FolderHeart, Plus, Search, Trash2, Clock3, CircleCheck, CircleAlert } from "lucide-react";
import { type StoredProject, deleteProject } from "@/lib/projectStorage";
import { apiPath } from "@/lib/apiBase";

interface Props { projects: StoredProject[]; onSelectProject: (id: string) => void; onRefresh: () => void; onNewClip: () => void }

export default function ProjectsView({ projects, onSelectProject, onRefresh, onNewClip }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "ready" | "processing">("all");
  const visible = useMemo(() => projects.filter((project) => {
    const statusMatches = tab === "all" || project.status === tab;
    return statusMatches && project.title.toLowerCase().includes(query.toLowerCase());
  }), [projects, query, tab]);

  const remove = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    if (window.confirm("Delete this project and remove it from this device?")) { deleteProject(id); onRefresh(); }
  };

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col gap-5 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#F4F1E8]">My projects</h1><p className="mt-1 text-xs text-[#85868b]">Every source, cut and export from this workspace.</p></div>
        <label className="flex h-9 w-full items-center gap-2 rounded-md border border-white/[0.08] bg-[#18191b] px-3 sm:w-64">
          <Search size={14} className="text-[#73747a]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" className="w-full bg-transparent text-xs text-white outline-none placeholder:text-[#66676c]" />
        </label>
      </div>

      <div className="flex items-center gap-7 border-b border-white/[0.07] text-sm">
        {(["all", "ready", "processing"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`relative pb-3 capitalize ${tab === item ? "text-white after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-[#E7B84B]" : "text-[#77787d] hover:text-[#c4c5c8]"}`}>{item === "all" ? "All" : item}</button>)}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[#a9aaae]">Collections</h2>
        <div className="flex flex-wrap gap-3">
          <button className="flex h-16 min-w-52 items-center gap-3 rounded-lg border border-dashed border-white/[0.13] px-4 text-xs text-[#8b8c91] hover:border-white/25 hover:text-white"><Plus size={17} />Add collection</button>
          <button className="flex h-16 min-w-52 items-center gap-3 rounded-lg border border-white/[0.07] bg-[#1c1d20] px-4 text-left"><FolderHeart size={18} className="text-[#E7B84B]" /><span><b className="block text-xs font-medium text-white">Saved cuts</b><small className="text-[10px] text-[#77787d]">0 clips</small></span></button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-medium text-[#a9aaae]">Projects <span className="text-[#65666b]">{visible.length}</span></h2><span className="text-[11px] text-[#65666b]">48-hour media vault</span></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button onClick={onNewClip} className="grid min-h-52 place-items-center rounded-xl border border-dashed border-white/[0.13] bg-[#151618] text-[#85868b] hover:border-[#E7B84B]/45 hover:text-white">
            <span className="text-center"><Plus size={22} className="mx-auto mb-2" /><b className="block text-xs font-medium">Start a new project</b><small className="mt-1 block text-[10px] text-[#65666b]">YouTube link or local video</small></span>
          </button>
          {visible.map((project) => {
            const first = project.clips?.[0];
            const thumb = first?.thumbnail_url ? (first.thumbnail_url.startsWith("http") ? first.thumbnail_url : apiPath(first.thumbnail_url)) : undefined;
            const StateIcon = project.status === "ready" ? CircleCheck : project.status === "failed" ? CircleAlert : Clock3;
            return (
              <article key={project.id} onClick={() => onSelectProject(project.id)} className="group cursor-pointer overflow-hidden rounded-xl border border-white/[0.07] bg-[#18191b] hover:border-white/[0.18]">
                <div className="relative aspect-video overflow-hidden bg-[#202124]">{thumb ? <Image src={thumb} alt="" fill unoptimized className="object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="grid h-full place-items-center text-[#4f5055]"><FolderHeart size={28} /></div>}<span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[10px] text-white"><StateIcon size={11} />{project.status}</span></div>
                <div className="flex items-start justify-between gap-3 p-3"><div className="min-w-0"><h3 className="truncate text-xs font-medium text-white">{project.title}</h3><p className="mt-1 text-[10px] text-[#77787d]">{project.clips?.length || 0} clips · {new Date(project.createdAt).toLocaleDateString()}</p></div><button onClick={(event) => remove(event, project.id)} aria-label="Delete project" className="text-[#66676c] opacity-0 transition hover:text-rose-400 group-hover:opacity-100"><Trash2 size={14} /></button></div>
              </article>
            );
          })}
        </div>
        {visible.length === 0 && projects.length > 0 && <p className="py-8 text-center text-xs text-[#77787d]">No projects match this view.</p>}
      </section>
    </div>
  );
}
