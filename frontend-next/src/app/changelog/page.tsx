import type { Metadata } from "next";
import { changelog } from "./data";

export const metadata: Metadata = {
  title: "Changelog — RelatiV",
  description:
    "Every ship, every fix, every tier. RelatiV moves fast — here's the proof.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "RelatiV Changelog",
    description:
      "Every ship, every fix, every tier. RelatiV moves fast — here's the proof.",
    url: "https://relativclips.com/changelog",
  },
};

export default function ChangelogPage() {
  return (
    <section className="relative pt-28 md:pt-32 pb-24 px-4 md:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-mono text-accent">[Φ-Changelog]</span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent to-transparent" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight mb-3">
            What we shipped
            <span className="italic font-serif text-accent"> this week.</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
            Every release, fix, and milestone — from "first deploy" to "first
            paying customer." No marketing-speak. Just the work.
          </p>
        </div>

        {/* Timeline */}
        <ol className="relative border-l border-border ml-3 space-y-12">
          {changelog.map((entry, i) => (
            <li key={entry.date} className="pl-8 md:pl-10 relative">
              <span
                className="absolute -left-[7px] top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-background"
                style={{
                  background: entry.color,
                  boxShadow: `0 0 16px ${entry.color}`,
                }}
              />
              <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                <time
                  dateTime={entry.date}
                  className="text-xs font-mono text-muted-foreground"
                >
                  {entry.date}
                </time>
                <span
                  className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{
                    color: entry.color,
                    background: `${entry.color}15`,
                    border: `1px solid ${entry.color}40`,
                  }}
                >
                  {entry.tag}
                </span>
                <h2 className="font-display text-xl md:text-2xl font-semibold">
                  {entry.title}
                </h2>
              </div>
              {entry.subtitle && (
                <p className="text-sm text-muted-foreground italic mb-3">
                  {entry.subtitle}
                </p>
              )}
              <ul className="space-y-1.5 text-sm md:text-[15px] leading-relaxed text-foreground/85">
                {entry.bullets.map((b, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: entry.color }}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {entry.stats && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                  {Object.entries(entry.stats).map(([k, v]) => (
                    <div
                      key={k}
                      className="px-3 py-2 rounded-md bg-text-primary/[0.03] border border-border-glass"
                    >
                      <div className="text-muted-foreground uppercase tracking-wider text-[10px]">
                        {k}
                      </div>
                      <div className="text-foreground font-semibold mt-0.5">
                        {v}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>

        {/* Footer note */}
        <div className="mt-20 pt-10 border-t border-border text-xs text-muted-foreground text-center font-mono">
          <p>Last ship: {changelog[0].date} · {changelog.length} entries ·</p>
          <p className="mt-1">
            <a
              href="/rss.xml"
              className="hover:text-foreground transition-colors"
            >
              RSS
            </a>
            {" · "}
            <a
              href="https://x.com/relativclips"
              className="hover:text-foreground transition-colors"
            >
              @relativclips
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
