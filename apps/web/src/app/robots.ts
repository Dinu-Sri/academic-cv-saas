import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteOrigin } from "@/lib/content/site-url";

/**
 * Product-host robots.txt (legacy parity + rewrite private routes).
 * Scholar public sites serve their own robots at /u/{username}/robots.txt (and custom hosts).
 */
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
        allow: ["/", "/llms.txt", "/sitemap.xml", "/blog", "/pricing", "/privacy", "/terms"],
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
          "/website/preview",
          "/m/",
          "/files/"
        ]
      }
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    ...(host ? { host } : {})
  };
}
