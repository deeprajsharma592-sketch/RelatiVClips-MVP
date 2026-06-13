/**
 * Changelog entries — newest first.
 *
 * Each entry is one milestone, ship, or notable fix. Colors are
 * picked to encode severity/joy: emerald = launch, fuchsia = feature,
 * violet = polish, ocean = infra, coral = fix.
 */

export type ChangelogEntry = {
  date: string; // ISO YYYY-MM-DD
  tag: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  stats?: Record<string, string>;
  color: string;
};

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-06-13",
    tag: "TIER 2",
    color: "#10B981",
    title: "Marketplace launch — 3-sided loop live",
    subtitle: "Brands create campaigns, clippers claim, submit, get paid.",
    bullets: [
      "Campaigns CRUD with Pydantic validation (CPM $1–$1K, budget $10–$100K, 1–100 slots)",
      "Clipper claim/unclaim with 7-day auto-deadline",
      "Clip submit → brand approve → view-verification bot → paid transition",
      "6 new frontend pages: /brands/campaigns (list/new/[id]), /clippers/campaigns, /clippers/clips, /clippers/clips/new",
      "13/13 marketplace E2E tests pass against real DB",
      "Live preview on campaign-create form (auto-computes reach, per-clip pay, slots)",
      "View-verification cron (5-min tick) — clips grow ~5K-30K views/day organically",
    ],
    stats: {
      "Routes": "32",
      "API": "48 paths",
      "E2E": "13/13",
      "Cron": "5-min",
    },
  },
  {
    date: "2026-06-13",
    tag: "TIER 1",
    color: "#D946EF",
    title: "Real users, real data, real auth",
    bullets: [
      "Full email/password flow: signup, login, forgot, reset, verify",
      "Forced TOS acceptance on signup (legal hygiene)",
      "Middleware: anon → /signup?next=… (307), dashboards protected",
      "Smart post-auth redirect: clipper to /clippers/dashboard, brand to /brands/campaigns",
      "Real user overlay on 3 dashboards — no more mock data",
      "Stripe checkout wired (needs test keys to flip /plans live)",
      "Resend verification banner on /account when is_verified=false",
    ],
    stats: {
      "Dashboards": "3 live",
      "Auth flows": "5",
      "Screenshots": "16",
    },
  },
  {
    date: "2026-06-12",
    tag: "PRODUCT",
    color: "#8B5CF6",
    title: "Premium SaaS redesign",
    bullets: [
      "Cream glass + sun-fuchsia-violet gradient system",
      "12 numbered sections with sticky scroll-progress rail",
      "Editorial Instrument Serif italic accents in every hero",
      "30+ drifting math glyphs as background texture",
      "Custom cursor, magnetic buttons, scroll-driven motion",
      "Brand spell: RelatiV (V) in logos, 'relativ' in URLs",
    ],
  },
  {
    date: "2026-06-10",
    tag: "INFRA",
    color: "#0EA5E9",
    title: "Cloudflare tunnel + Hetzner deploy",
    bullets: [
      "Hetzner CPX32 (fsn1) backend, 91.98.144.72",
      "Cloudflared trycloudflare.com tunnel (replaces direct IP)",
      "Postgres 16, Redis 7, FastAPI on Uvicorn",
      "Dockerized, non-root user, healthcheck, CPU-only PyTorch",
    ],
  },
  {
    date: "2026-06-09",
    tag: "MVP",
    color: "#FB7185",
    title: "Day 1 — pipeline end-to-end",
    bullets: [
      "YouTube → captions → transcript_fetcher → hooks → ICL prompt → Claude",
      "Taste-based scoring (lexical signals, energy peaks)",
      "10 short-form clips per video in ~5 min",
      "Viral title + caption + 10s duration auto-generated",
    ],
    stats: {
      "Tests": "107",
      "Pipeline": "1 URL → 10 clips",
    },
  },
];
