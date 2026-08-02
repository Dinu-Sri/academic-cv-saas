import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/content/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/settings",
          "/settings/",
          "/billing",
          "/billing/",
          "/profile",
          "/profile/",
          "/cv",
          "/cv/",
          "/publications",
          "/publications/",
          "/support",
          "/support/",
          "/invite/",
          "/website/preview"
        ]
      }
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, "")
  };
}

// Note: /llms.txt is served separately and linked from marketing crawlers via llmstxt.org convention.
