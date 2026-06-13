import type { MetadataRoute } from "next";

const BASE = "https://relativclips.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/account",
          "/brands/dashboard",
          "/clippers/dashboard",
          "/creators/dashboard",
          "/brands/campaigns",
          "/brands/campaigns/*",
          "/clippers/campaigns",
          "/clippers/clips",
          "/clippers/clips/*",
          "/plans",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
