import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { posts } from "./data";

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
    <section className="relative pt-28 md:pt-32 pb-24 px-4 md:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-mono text-accent">[Φ-Notes]</span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent to-transparent" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight mb-3">
            Notes on{" "}
            <span className="italic font-serif text-accent">the work.</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
            Essays on taste, the creator economy, the 3-sided marketplace
            we're building, and what we've shipped. Slow posts, not hot takes.
          </p>
        </div>

        <div className="space-y-6">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="block group p-6 md:p-8 rounded-2xl bg-text-primary/[0.02] hover:bg-text-primary/[0.04] border border-border-glass hover:border-border-strong transition-all"
            >
              <div className="flex items-baseline gap-3 mb-3 flex-wrap text-xs font-mono text-muted-foreground">
                <time dateTime={p.date}>{p.date}</time>
                <span>·</span>
                <span>{p.readTime}</span>
                <span>·</span>
                <span className="text-accent">{p.tag}</span>
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-2 group-hover:text-accent transition-colors">
                {p.title}
              </h2>
              <p className="text-[15px] text-foreground/75 leading-relaxed mb-4">
                {p.dek}
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-mono text-accent">
                Read
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-16 pt-10 border-t border-border text-center text-sm text-muted-foreground">
          More posts coming.{" "}
          <Link
            href="/changelog"
            className="text-accent hover:underline underline-offset-4"
          >
            See the changelog →
          </Link>
        </div>
      </div>
    </section>
  );
}
