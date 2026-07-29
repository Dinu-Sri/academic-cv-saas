import type { MetadataRoute } from "next";
import { getPostMetaList } from "@/lib/content/blog";
import { LEGAL_NAV } from "@/lib/content/legal";
import { absoluteUrl } from "@/lib/content/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: absoluteUrl("/blog"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9
    },
    {
      url: absoluteUrl("/methodology/time-to-first-cv"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6
    },
    ...LEGAL_NAV.map((item) => ({
      url: absoluteUrl(item.href),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.4
    }))
  ];

  const posts: MetadataRoute.Sitemap = getPostMetaList().map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: post.date ? new Date(`${post.date}T00:00:00Z`) : now,
    changeFrequency: "monthly" as const,
    priority: 0.7
  }));

  return [...staticRoutes, ...posts];
}
