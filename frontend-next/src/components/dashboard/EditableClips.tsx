"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Clapperboard, Clock3, Pencil, Search, Video } from "lucide-react";
import type { Clip } from "@/types";
import type { StoredProject } from "@/lib/projectStorage";
import { apiPath } from "@/lib/apiBase";

type EditableClip = {
  clip: Clip;
  index: number;
  projectId: string;
  projectTitle: string;
  createdAt: number;
};

function timecode(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function posterUrl(clip: Clip) {
  if (clip.thumbnail_url) return clip.thumbnail_url.startsWith("http") ? clip.thumbnail_url : apiPath(clip.thumbnail_url);
  return clip.clip_id ? apiPath(`/thumbnail/${clip.clip_id}`) : "";
}

export default function EditableClips({
  projects,
  onEdit,
  onCreateClip,
}: {
  projects: StoredProject[];
  onEdit: (clip: Clip, index: number, projectId: string) => void;
  onCreateClip: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "longest">("newest");

  const clips = useMemo(() => {
    const all: EditableClip[] = projects.flatMap((project) =>
      (project.clips || []).map((clip, index) => ({
        clip,
        index,
        projectId: project.id,
        projectTitle: project.title,
        createdAt: project.createdAt,
      })),
    );
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? all.filter(({ clip, projectTitle }) => `${clip.viral_title} ${clip.caption} ${projectTitle}`.toLowerCase().includes(needle))
      : all;
    return filtered.sort((a, b) => sort === "longest" ? b.clip.duration_s - a.clip.duration_s : b.createdAt - a.createdAt);
  }, [projects, query, sort]);

  return (
    <div className="pb-12">
      <header className="flex flex-col gap-5 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Clapperboard className="size-5 text-[#4FD1C5]" />
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#F4F1E8]">Editable clips</h2>
          </div>
          <p className="mt-1.5 max-w-lg text-xs leading-5 text-[#85868b]">Choose a generated cut to adjust its timing, transcript, captions and framing.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-white/[0.09] bg-black px-3 sm:w-64">
            <Search size={14} className="shrink-0 text-[#73747a]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search editable clips" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[#66676c]" />
          </label>
          <select value={sort} onChange={(event) => setSort(event.target.value as "newest" | "longest")} className="h-9 border border-white/[0.09] bg-black px-3 text-xs text-[#B9BABE] outline-none">
            <option value="newest">Newest</option>
            <option value="longest">Longest</option>
          </select>
        </div>
      </header>

      {clips.length > 0 ? (
        <section className="mt-6 border-y border-white/[0.07]">
          {clips.map(({ clip, index, projectId, projectTitle, createdAt }) => {
            const poster = posterUrl(clip);
            return (
              <article key={`${projectId}-${clip.clip_id}`} className="group grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.07] py-3 last:border-b-0 sm:grid-cols-[116px_minmax(0,1fr)_auto] sm:gap-5 sm:py-4">
                <button type="button" onClick={() => onEdit(clip, index, projectId)} className="relative aspect-video overflow-hidden border border-white/[0.08] bg-black text-[#5F6168]">
                  {poster ? <Image src={poster} alt="" fill unoptimized className="object-cover transition duration-300 group-hover:scale-[1.03]" /> : <span className="grid h-full place-items-center"><Video className="size-5" /></span>}
                  <span className="absolute right-1.5 bottom-1 bg-black/80 px-1.5 py-0.5 font-mono text-[9px] text-white">{timecode(clip.duration_s || 0)}</span>
                </button>

                <div className="min-w-0">
                  <button type="button" onClick={() => onEdit(clip, index, projectId)} className="block max-w-full truncate text-left text-sm font-medium text-[#ECEAE3] transition hover:text-white">
                    {clip.viral_title || `Clip ${index + 1}`}
                  </button>
                  <p className="mt-1 truncate text-[11px] text-[#777980]">{projectTitle}</p>
                  <div className="mt-2 hidden items-center gap-3 text-[10px] text-[#606269] sm:flex">
                    <span className="flex items-center gap-1"><Clock3 className="size-3" />{new Date(createdAt).toLocaleDateString()}</span>
                    <span>{clip.caption_words?.length || 0} timed words</span>
                    <span>{clip.file_size_mb?.toFixed(1) || "0.0"} MB</span>
                  </div>
                </div>

                <button type="button" onClick={() => onEdit(clip, index, projectId)} className="flex h-9 items-center gap-2 border border-[#4FD1C5]/30 bg-[#4FD1C5]/[0.07] px-3 text-[11px] font-semibold text-[#9CEAE2] transition hover:border-[#4FD1C5]/65 hover:bg-[#4FD1C5]/[0.12] sm:px-4">
                  <Pencil className="size-3.5" /><span className="hidden sm:inline">Edit clip</span><span className="sm:hidden">Edit</span>
                </button>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="mt-8 border border-dashed border-white/[0.12] bg-black px-6 py-14 text-center">
          <Clapperboard className="mx-auto size-7 text-[#55575D]" />
          <h2 className="mt-4 text-sm font-medium text-[#E6E3DB]">{query ? "No clips match that search" : "No editable clips yet"}</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-[#777980]">{query ? "Try another title, caption, or project name." : "Generate a clip first. Every completed cut will appear here automatically."}</p>
          {!query && <button type="button" onClick={onCreateClip} className="mt-5 h-9 bg-[#E7B84B] px-4 text-xs font-semibold text-black hover:bg-[#F0C96A]">Create your first clip</button>}
        </section>
      )}
    </div>
  );
}
