import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/account",
          "/admin",
          "/brands/dashboard",
          "/brands/campaigns",
          "/clippers/dashboard",
          "/clippers/clips",
          "/clippers/campaigns",
          "/creators/dashboard",
          "/(auth)/",
        ],
      },
    ],
    sitemap: "https://relativclips.com/sitemap.xml",
  };
}
