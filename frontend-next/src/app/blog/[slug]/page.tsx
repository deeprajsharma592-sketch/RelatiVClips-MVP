import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { posts, postBodies } from "../data";

type Params = { slug: string };

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) return { title: "Not found" };
  return {
    title: `${post.title} — RelatiV Blog`,
    description: post.dek,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.dek,
      type: "article",
      url: `https://relativclips.com/blog/${post.slug}`,
    },
  };
}

export default function BlogPostPage({ params }: { params: Params }) {
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) notFound();
  const body = postBodies[post.slug];

  return (
    <article className="relative pt-28 md:pt-32 pb-24 px-4 md:px-6">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All posts
        </Link>

        <div className="flex items-baseline gap-3 mb-3 flex-wrap text-xs font-mono text-muted-foreground">
          <time dateTime={post.date}>{post.date}</time>
          <span>·</span>
          <span>{post.readTime}</span>
          <span>·</span>
          <span className="text-accent">{post.tag}</span>
        </div>

        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-3 leading-[1.05]">
          {post.title}
        </h1>
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
          {post.dek}
        </p>

        <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground pb-10 mb-10 border-b border-white/10">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center text-white text-xs font-bold">
            {post.author.name[0]}
          </div>
          <span>{post.author.name}</span>
          <span className="text-muted-foreground/50">·</span>
          <span>{post.author.handle}</span>
        </div>

        <div className="prose-relativ">
          {body}
        </div>

        <div className="mt-16 pt-10 border-t border-white/10">
          <Link
            href="/blog"
            className="text-sm font-mono text-accent hover:underline underline-offset-4"
          >
            ← All posts
          </Link>
        </div>
      </div>

      <style>{`
        .prose-relativ { color: var(--color-foreground); }
        .prose-relativ p { margin-bottom: 1.25em; line-height: 1.75; font-size: 16px; }
        .prose-relativ h2 { font-family: var(--font-display); font-size: 1.5rem; font-weight: 600; margin-top: 2.5em; margin-bottom: 0.75em; letter-spacing: -0.01em; }
        .prose-relativ h3 { font-family: var(--font-display); font-size: 1.2rem; font-weight: 600; margin-top: 1.75em; margin-bottom: 0.5em; }
        .prose-relativ blockquote { border-left: 2px solid var(--color-accent); padding-left: 1.25em; margin: 1.5em 0; font-style: italic; color: var(--color-muted-foreground); }
        .prose-relativ strong { color: var(--color-foreground); font-weight: 600; }
        .prose-relativ em { font-style: italic; }
        .prose-relativ code { font-family: var(--font-mono); font-size: 0.875em; padding: 0.15em 0.4em; background: rgba(255,255,255,0.06); border-radius: 0.25em; }
        .prose-relativ ul, .prose-relativ ol { margin: 1em 0 1.25em 1.25em; }
        .prose-relativ li { margin-bottom: 0.4em; line-height: 1.7; }
        .prose-relativ a { color: var(--color-accent); text-decoration: underline; text-underline-offset: 3px; }
      `}</style>
    </article>
  );
}
