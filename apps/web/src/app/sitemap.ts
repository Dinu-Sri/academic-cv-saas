import type { MetadataRoute } from "next";
import { getCategories, getPostMetaList, getTags, categoryPath, tagPath } from "@/lib/content/blog";
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
      url: absoluteUrl("/pricing"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9
    },
    {
      url: absoluteUrl("/website"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85
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
      priority: 0.55
    },
    ...LEGAL_NAV.map((item) => ({
      url: absoluteUrl(item.href),
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.35
    }))
  ];

  const posts: MetadataRoute.Sitemap = getPostMetaList().map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: post.date ? new Date(`${post.date}T00:00:00Z`) : now,
    changeFrequency: "monthly" as const,
    priority: 0.7
  }));

  const categories: MetadataRoute.Sitemap = Object.keys(getCategories()).map((category) => ({
    url: absoluteUrl(categoryPath(category)),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.5
  }));

  const tags: MetadataRoute.Sitemap = Object.keys(getTags())
    .slice(0, 80)
    .map((tag) => ({
      url: absoluteUrl(tagPath(tag)),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.4
    }));

  return [...staticRoutes, ...posts, ...categories, ...tags];
}
