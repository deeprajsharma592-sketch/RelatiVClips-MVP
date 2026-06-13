import type { MetadataRoute } from "next";

const BASE = "https://relativclips.com";

// All public, indexable routes on the site. Authed and dynamic
// routes (dashboards, /account, /api/*) are excluded.
const PUBLIC_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/services", priority: 0.9, changeFrequency: "monthly" },
  { path: "/campaigns", priority: 0.9, changeFrequency: "weekly" },
  { path: "/clippers", priority: 0.9, changeFrequency: "weekly" },
  { path: "/brands", priority: 0.9, changeFrequency: "weekly" },
  { path: "/plans", priority: 0.8, changeFrequency: "monthly" },
  { path: "/changelog", priority: 0.6, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/press", priority: 0.5, changeFrequency: "monthly" },
  { path: "/yc", priority: 0.7, changeFrequency: "monthly" },
  { path: "/login", priority: 0.3, changeFrequency: "yearly" },
  { path: "/signup", priority: 0.5, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
