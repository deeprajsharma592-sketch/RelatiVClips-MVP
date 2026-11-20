"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Eye, Edit3, Check, Save, Download } from "lucide-react";

export interface CustomBlogPost {
  slug: string;
  date: string;
  readTime: string;
  tag: string;
  title: string;
  dek: string;
  content: string;
  author: { name: string; handle: string };
}

export default function BlogWriterPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [dek, setDek] = useState("");
  const [tag, setTag] = useState("Creator tips");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("Deepraj");
  const [authorHandle, setAuthorHandle] = useState("@deepraj");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [saved, setSaved] = useState(false);

  // Auto calculate read time
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const readTime = `${Math.max(1, Math.ceil(wordCount / 200))} min`;

  const handleSave = () => {
    if (!title.trim()) {
      alert("Please enter a blog post title.");
      return;
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const newPost: CustomBlogPost = {
      slug: slug || `post-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      readTime,
      tag,
      title: title.trim(),
      dek: dek.trim() || title.trim(),
      content: content.trim(),
      author: {
        name: authorName,
        handle: authorHandle,
      },
    };

    try {
      const existingRaw = localStorage.getItem("relativ_custom_blogs");
      const existing: CustomBlogPost[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [newPost, ...existing.filter((p) => p.slug !== newPost.slug)];
      localStorage.setItem("relativ_custom_blogs", JSON.stringify(updated));
      setSaved(true);
      setTimeout(() => {
        router.push("/blog");
      }, 900);
    } catch {
      alert("Saved to local storage draft.");
    }
  };

  return (
    <div className="min-h-screen bg-[#08080A] text-white selection:bg-white selection:text-black">
      {/* Top Header */}
      <header className="h-16 border-b border-white/[0.08] px-6 sm:px-12 flex items-center justify-between sticky top-0 bg-[#08080A]/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/blog"
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-xs font-semibold text-zinc-300">RelatiV Editorial Desk</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setMode("write")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                mode === "write" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Write</span>
            </button>
            <button
              onClick={() => setMode("preview")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                mode === "preview" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          {/* Publish / Save */}
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saved ? "Published!" : "Publish to Blog"}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        {mode === "write" ? (
          <div className="space-y-6">
            {/* Meta Tags & Category Row */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="bg-white/5 border border-white/10 text-zinc-300 text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:border-white/30 cursor-pointer"
              >
                <option value="Creator tips">Creator tips</option>
                <option value="Product teardown">Product teardown</option>
                <option value="Founder notes">Founder notes</option>
                <option value="Viral breakdown">Viral breakdown</option>
                <option value="AI research">AI research</option>
              </select>

              <span className="text-xs text-zinc-500 font-mono">
                {readTime} read · {wordCount} words
              </span>
            </div>

            {/* Title */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title of your post..."
                className="w-full bg-transparent text-3xl sm:text-4xl font-display font-bold text-white placeholder-zinc-600 focus:outline-none tracking-tight"
              />
            </div>

            {/* Subtitle / Dek */}
            <div>
              <textarea
                value={dek}
                onChange={(e) => setDek(e.target.value)}
                rows={2}
                placeholder="Write a compelling subtitle or summary (1-2 sentences)..."
                className="w-full bg-transparent text-sm sm:text-base text-zinc-400 placeholder-zinc-600 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="h-px w-full bg-white/[0.08]" />

            {/* Author details */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-zinc-500">Author:</span>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Author name"
                className="bg-white/5 border border-white/10 text-zinc-300 px-2.5 py-1 rounded-md focus:outline-none text-xs"
              />
              <input
                type="text"
                value={authorHandle}
                onChange={(e) => setAuthorHandle(e.target.value)}
                placeholder="@handle"
                className="bg-white/5 border border-white/10 text-zinc-400 px-2.5 py-1 rounded-md focus:outline-none text-xs font-mono"
              />
            </div>

            {/* Body Markdown Content */}
            <div className="space-y-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                placeholder="Write your blog post in markdown or plain text...
## Introduction
Share your observations on viral pacing, hook retention, and creative workflows.

- Key takeaway one
- Key takeaway two"
                className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-5 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/20 resize-y font-sans leading-relaxed"
              />
            </div>
          </div>
        ) : (
          /* PREVIEW MODE */
          <div className="space-y-8">
            <div className="space-y-3 border-b border-white/[0.08] pb-6">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <span className="text-white font-semibold">{tag}</span>
                <span>·</span>
                <span>{readTime} read</span>
                <span>·</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">
                {title || "Untitled Blog Post"}
              </h1>
              {dek && <p className="text-base text-zinc-400 leading-relaxed">{dek}</p>}
              <div className="pt-2 text-xs text-zinc-500">
                By <span className="text-white font-medium">{authorName}</span> ({authorHandle})
              </div>
            </div>

            {/* Rendered content */}
            <div className="prose prose-invert max-w-none text-zinc-300 leading-relaxed space-y-4 whitespace-pre-wrap text-sm sm:text-base">
              {content || "No content written yet. Switch to the 'Write' tab to start composing."}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
