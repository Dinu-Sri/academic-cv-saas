import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogCard } from "@/components/marketing/blog-card";
import { ProductFooter } from "@/components/marketing/product-footer";
import { getPostsByTag, getTags, paginatePosts } from "@/lib/content/blog";
import { absoluteUrl } from "@/lib/content/site-url";

type PageProps = {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
};

function resolveTagName(param: string): string | null {
  const needle = decodeURIComponent(param).toLowerCase();
  const tags = getTags();
  for (const name of Object.keys(tags)) {
    if (name.toLowerCase() === needle) return name;
  }
  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const name = resolveTagName(tag);
  if (!name) return { title: "Tag not found | CVScholar Blog" };
  return {
    title: `${name} — Academic CV Blog | CVScholar`,
    description: `Guides tagged “${name}” on CVScholar.`,
    alternates: { canonical: absoluteUrl(`/blog/tag/${encodeURIComponent(name.toLowerCase())}`) }
  };
}

export default async function BlogTagPage({ params, searchParams }: PageProps) {
  const { tag } = await params;
  const name = resolveTagName(tag);
  if (!name) notFound();

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const posts = getPostsByTag(name);
  const paginated = paginatePosts(posts, page);

  return (
    <div className="marketing-page blog-archive">
      <header className="marketing-page-header blog-archive-header">
        <nav className="marketing-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/blog">Blog</Link>
          <span aria-hidden="true">/</span>
          <span>#{name}</span>
        </nav>
        <h1>Tag: {name}</h1>
        <p className="marketing-lead">
          {paginated.total} guide{paginated.total === 1 ? "" : "s"} with this tag.
        </p>
      </header>

      <div className="blog-card-grid">
        {paginated.posts.map((post) => (
          <BlogCard key={post.slug} post={post} />
        ))}
      </div>

      {paginated.totalPages > 1 ? (
        <nav className="blog-pagination" aria-label="Pagination">
          {paginated.page > 1 ? (
            <Link
              href={`/blog/tag/${encodeURIComponent(name.toLowerCase())}?page=${paginated.page - 1}`}
              className="secondary-action compact-action"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {paginated.page} of {paginated.totalPages}
          </span>
          {paginated.page < paginated.totalPages ? (
            <Link
              href={`/blog/tag/${encodeURIComponent(name.toLowerCase())}?page=${paginated.page + 1}`}
              className="secondary-action compact-action"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <p className="blog-back">
        <Link href="/blog">← All blog posts</Link>
      </p>
      <ProductFooter />
    </div>
  );
}
