"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, PenSquare } from "lucide-react";
import { posts as staticPosts, type BlogPost } from "./data";
import type { CustomBlogPost } from "./write/page";

export default function BlogListClient() {
  const [allPosts, setAllPosts] = useState<BlogPost[]>(staticPosts);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("relativ_custom_blogs");
      if (raw) {
        const custom: CustomBlogPost[] = JSON.parse(raw);
        // Prepend custom posts
        const merged = [...custom, ...staticPosts.filter((s) => !custom.some((c) => c.slug === s.slug))];
        setAllPosts(merged);
      }
    } catch {}
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2">
        <span className="text-xs uppercase font-mono text-zinc-400 tracking-wider">
          All Articles ({allPosts.length})
        </span>

        <Link
          href="/blog/write"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-bold transition shadow-sm"
        >
          <PenSquare className="w-3.5 h-3.5" />
          <span>Write a Blog</span>
        </Link>
      </div>

      <div className="space-y-4">
        {allPosts.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="block group p-6 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all"
          >
            <div className="flex items-baseline gap-2.5 mb-2.5 flex-wrap text-xs text-zinc-400">
              <time dateTime={p.date}>{p.date}</time>
              <span>·</span>
              <span>{p.readTime}</span>
              <span>·</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-medium">
                {p.tag}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2 text-white group-hover:text-zinc-200 transition-colors">
              {p.title}
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              {p.dek}
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
              Read article
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
