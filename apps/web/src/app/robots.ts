import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/content/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/settings", "/billing"]
    },
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
