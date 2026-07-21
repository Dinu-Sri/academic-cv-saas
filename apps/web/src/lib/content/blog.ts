import fs from "node:fs";
import path from "node:path";
import { asString, asStringArray, splitFrontmatter } from "@/lib/content/frontmatter";
import { estimateReadingMinutes, renderMarkdown, type TocItem } from "@/lib/content/markdown";
import { contentPath } from "@/lib/content/paths";

export type BlogPostMeta = {
  title: string;
  slug: string;
  description: string;
  author: string;
  date: string;
  category: string;
  tags: string[];
  featuredImage: string;
  readingTime: number;
};

export type BlogPost = BlogPostMeta & {
  bodyHtml: string;
  bodyRaw: string;
  toc: TocItem[];
};

export type PaginatedPosts = {
  posts: BlogPostMeta[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

const POSTS_PER_PAGE = 12;

let cache: BlogPost[] | null = null;

function blogDir(): string {
  return contentPath("blog");
}

function parsePostFile(filepath: string): BlogPost | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filepath, "utf8");
  } catch {
    return null;
  }

  const { data, body } = splitFrontmatter(raw);
  const title = asString(data.title);
  let slug = asString(data.slug) || path.basename(filepath, ".md");
  slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!title || !slug) return null;

  const date = asString(data.date);
  const { html, toc } = renderMarkdown(body);

  return {
    title,
    slug,
    description: asString(data.description),
    author: asString(data.author, "CVScholar Team"),
    date,
    category: asString(data.category),
    tags: asStringArray(data.tags),
    featuredImage: asString(data.featured_image ?? data.featuredImage),
    readingTime: estimateReadingMinutes(body),
    bodyHtml: html,
    bodyRaw: body,
    toc
  };
}

function isPublished(post: BlogPost, today = new Date().toISOString().slice(0, 10)): boolean {
  if (!post.date) return true;
  return post.date <= today;
}

export function getAllPosts(options?: { includeBody?: boolean }): BlogPost[] {
  if (cache) {
    return options?.includeBody === false
      ? cache.map(toMetaAsPost)
      : cache;
  }

  const dir = blogDir();
  if (!fs.existsSync(dir)) {
    cache = [];
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  const posts: BlogPost[] = [];
  for (const file of files) {
    const post = parsePostFile(path.join(dir, file));
    if (post && isPublished(post)) posts.push(post);
  }

  posts.sort((a, b) => b.date.localeCompare(a.date));
  cache = posts;
  return posts;
}

function toMetaAsPost(post: BlogPost): BlogPost {
  return {
    ...post,
    bodyHtml: "",
    bodyRaw: "",
    toc: []
  };
}

export function getPostMetaList(): BlogPostMeta[] {
  return getAllPosts().map(
    ({ title, slug, description, author, date, category, tags, featuredImage, readingTime }) => ({
      title,
      slug,
      description,
      author,
      date,
      category,
      tags,
      featuredImage,
      readingTime
    })
  );
}

export function getPostBySlug(slug: string): BlogPost | null {
  const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return getAllPosts().find((p) => p.slug === clean) ?? null;
}

export function getPostsByCategory(category: string): BlogPostMeta[] {
  const needle = category.toLowerCase().trim();
  return getPostMetaList().filter((p) => p.category.toLowerCase() === needle);
}

export function getPostsByTag(tag: string): BlogPostMeta[] {
  const needle = tag.toLowerCase().trim();
  return getPostMetaList().filter((p) => p.tags.some((t) => t.toLowerCase() === needle));
}

export function searchPosts(query: string): BlogPostMeta[] {
  const q = query.toLowerCase().trim();
  if (!q) return getPostMetaList();
  return getAllPosts()
    .filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.bodyRaw.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    )
    .map(({ title, slug, description, author, date, category, tags, featuredImage, readingTime }) => ({
      title,
      slug,
      description,
      author,
      date,
      category,
      tags,
      featuredImage,
      readingTime
    }));
}

export function getCategories(): Record<string, number> {
  const cats: Record<string, number> = {};
  for (const post of getPostMetaList()) {
    if (!post.category) continue;
    cats[post.category] = (cats[post.category] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(cats).sort(([a], [b]) => a.localeCompare(b)));
}

export function getTags(): Record<string, number> {
  const tags: Record<string, number> = {};
  for (const post of getPostMetaList()) {
    for (const tag of post.tags) {
      tags[tag] = (tags[tag] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(tags).sort(([a], [b]) => a.localeCompare(b)));
}

export function paginatePosts(posts: BlogPostMeta[], page = 1, perPage = POSTS_PER_PAGE): PaginatedPosts {
  const total = posts.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const offset = (safePage - 1) * perPage;
  return {
    posts: posts.slice(offset, offset + perPage),
    page: safePage,
    perPage,
    total,
    totalPages
  };
}

export function getRelatedPosts(current: BlogPost, limit = 3): BlogPostMeta[] {
  const related: BlogPostMeta[] = [];
  const all = getPostMetaList();

  if (current.category) {
    for (const p of all) {
      if (p.slug === current.slug) continue;
      if (p.category.toLowerCase() === current.category.toLowerCase()) {
        related.push(p);
        if (related.length >= limit) return related;
      }
    }
  }

  for (const p of all) {
    if (p.slug === current.slug) continue;
    if (related.some((r) => r.slug === p.slug)) continue;
    related.push(p);
    if (related.length >= limit) break;
  }

  return related;
}

export function categoryPath(category: string): string {
  return `/blog/category/${encodeURIComponent(category.toLowerCase())}`;
}

export function tagPath(tag: string): string {
  return `/blog/tag/${encodeURIComponent(tag.toLowerCase())}`;
}

export function formatPostDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}
