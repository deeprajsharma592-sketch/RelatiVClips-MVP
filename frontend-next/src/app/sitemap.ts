import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://relativclips.com";
  const now = new Date();

  // Public routes
  const publicRoutes: MetadataRoute.Sitemap = [
    "",
    "/campaigns",
    "/pricing",
    "/about",
    "/contact",
    "/brands",
    "/creators",
    "/clippers",
    "/clippers/apply",
    "/blog",
    "/changelog",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1.0 : 0.7,
  }));

  return publicRoutes;
}
