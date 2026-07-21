import type { Metadata } from "next";
import Link from "next/link";
import { BlogCard } from "@/components/marketing/blog-card";
import { BlogSearchForm } from "@/components/marketing/blog-search-form";
import { ProductFooter } from "@/components/marketing/product-footer";
import {
  getCategories,
  getPostMetaList,
  getTags,
  paginatePosts,
  searchPosts,
  tagPath,
  categoryPath
} from "@/lib/content/blog";
import { absoluteUrl } from "@/lib/content/site-url";

export const metadata: Metadata = {
  title: "Academic CV Blog — Tips, Guides & Resources | CVScholar",
  description:
    "Expert guides on academic CVs, publication formatting, tenure applications, and career advice for researchers, professors, and PhD students.",
  alternates: { canonical: absoluteUrl("/blog") },
  openGraph: {
    title: "Academic CV Blog — CVScholar",
    description:
      "Expert guides on academic CVs, publication formatting, tenure applications, and career advice.",
    url: absoluteUrl("/blog"),
    type: "website"
  }
};

type PageProps = {
  searchParams: Promise<{ page?: string; q?: string }>;
};

export default async function BlogArchivePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = (params.q || "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const source = q ? searchPosts(q) : getPostMetaList();
  const paginated = paginatePosts(source, page);
  const categories = getCategories();
  const tags = getTags();

  return (
    <div className="marketing-page blog-archive">
      <header className="marketing-page-header">
        <nav className="marketing-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>Blog</span>
        </nav>
        <h1>Academic CV Blog</h1>
        <p className="marketing-lead">
          Practical guides for researchers, PhD students, and faculty — writing CVs, listing
          publications, and navigating academic applications.
        </p>
        <BlogSearchForm defaultQuery={q} />
      </header>

      <div className="blog-layout">
        <div className="blog-main">
          {q ? (
            <p className="blog-result-summary">
              {paginated.total} result{paginated.total === 1 ? "" : "s"} for <strong>{q}</strong>
              {" · "}
              <Link href="/blog">Clear search</Link>
            </p>
          ) : null}

          {paginated.posts.length === 0 ? (
            <p className="blog-empty">No posts found. Try a different search or browse categories.</p>
          ) : (
            <div className="blog-card-grid">
              {paginated.posts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          )}

          {paginated.totalPages > 1 ? (
            <nav className="blog-pagination" aria-label="Blog pagination">
              {paginated.page > 1 ? (
                <Link
                  href={
                    q
                      ? `/blog?q=${encodeURIComponent(q)}&page=${paginated.page - 1}`
                      : `/blog?page=${paginated.page - 1}`
                  }
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
                  href={
                    q
                      ? `/blog?q=${encodeURIComponent(q)}&page=${paginated.page + 1}`
                      : `/blog?page=${paginated.page + 1}`
                  }
                  className="secondary-action compact-action"
                >
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>

        <aside className="blog-sidebar" aria-label="Blog filters">
          <section>
            <h2>Categories</h2>
            <ul className="blog-filter-list">
              {Object.entries(categories).map(([name, count]) => (
                <li key={name}>
                  <Link href={categoryPath(name)}>
                    {name} <span>{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Popular tags</h2>
            <div className="blog-tag-cloud">
              {Object.entries(tags)
                .slice(0, 24)
                .map(([name, count]) => (
                  <Link key={name} href={tagPath(name)} className="blog-chip">
                    {name} ({count})
                  </Link>
                ))}
            </div>
          </section>
        </aside>
      </div>

      <ProductFooter />
    </div>
  );
}
