import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteOrigin } from "@/lib/content/site-url";

export default function robots(): MetadataRoute.Robots {
  let host: string | undefined;
  try {
    host = new URL(getSiteOrigin()).host;
  } catch {
    host = undefined;
  }

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
    ...(host ? { host } : {})
  };
}

// Note: /llms.txt is served separately and linked from marketing crawlers via llmstxt.org convention.
