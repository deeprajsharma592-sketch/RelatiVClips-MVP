import type { Metadata } from "next";
import BlogListClient from "./BlogListClient";

export const metadata: Metadata = {
  title: "Blog — RelatiV",
  description:
    "Notes on the creator economy, taste-based AI, and what we're building at RelatiV.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "RelatiV Blog",
    description:
      "Notes on the creator economy, taste-based AI, and what we're building at RelatiV.",
    url: "https://relativclips.com/blog",
  },
};

export default function BlogIndex() {
  return (
    <section className="relative pt-24 pb-24 px-4 md:px-6 bg-[#08080A] min-h-screen text-white">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="space-y-3">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
            Editorial & Insights
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white">
            RelatiV Blog
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
            Essays on viral retention, algorithmic hook mechanics, and the creator tools we build.
          </p>
        </div>

        {/* Dynamic Blog List with Writer */}
        <BlogListClient />
      </div>
    </section>
  );
}
