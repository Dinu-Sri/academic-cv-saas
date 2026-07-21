import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogCard } from "@/components/marketing/blog-card";
import { MarkdownProse } from "@/components/marketing/markdown-prose";
import { ProductFooter } from "@/components/marketing/product-footer";
import {
  categoryPath,
  formatPostDate,
  getAllPosts,
  getPostBySlug,
  getRelatedPosts,
  tagPath
} from "@/lib/content/blog";
import { absoluteUrl, getSiteOrigin } from "@/lib/content/site-url";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Post not found | CVScholar" };

  const url = absoluteUrl(`/blog/${post.slug}`);
  return {
    title: `${post.title} | CVScholar Blog`,
    description: post.description || post.title,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description || post.title,
      url,
      type: "article",
      publishedTime: post.date || undefined,
      authors: post.author ? [post.author] : undefined,
      tags: post.tags
    }
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post, 3);
  const url = absoluteUrl(`/blog/${post.slug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      "@type": "Organization",
      name: post.author || "CVScholar Team"
    },
    publisher: {
      "@type": "Organization",
      name: "CVScholar",
      url: getSiteOrigin()
    },
    mainEntityOfPage: url,
    url
  };

  return (
    <div className="marketing-page blog-post-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="marketing-page-header">
        <nav className="marketing-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/blog">Blog</Link>
          <span aria-hidden="true">/</span>
          <span>{post.title}</span>
        </nav>
        {post.category ? (
          <Link href={categoryPath(post.category)} className="blog-chip">
            {post.category}
          </Link>
        ) : null}
        <h1>{post.title}</h1>
        <p className="blog-post-meta">
          <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          <span>·</span>
          <span>{post.readingTime} min read</span>
          {post.author ? (
            <>
              <span>·</span>
              <span>{post.author}</span>
            </>
          ) : null}
        </p>
        {post.description ? <p className="marketing-lead">{post.description}</p> : null}
      </header>

      <div className="blog-post-layout">
        <article className="blog-post-body">
          <MarkdownProse html={post.bodyHtml} />
        </article>

        {post.toc.length > 0 ? (
          <aside className="blog-toc" aria-label="On this page">
            <h2>On this page</h2>
            <ul>
              {post.toc.map((item) => (
                <li key={item.id} className={`toc-level-${item.level}`}>
                  <a href={`#${item.id}`}>{item.text}</a>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>

      {post.tags.length > 0 ? (
        <div className="blog-post-tags">
          <span>Tags:</span>
          {post.tags.map((tag) => (
            <Link key={tag} href={tagPath(tag)} className="blog-chip">
              {tag}
            </Link>
          ))}
        </div>
      ) : null}

      {related.length > 0 ? (
        <section className="blog-related">
          <h2>Related guides</h2>
          <div className="blog-card-grid">
            {related.map((item) => (
              <BlogCard key={item.slug} post={item} />
            ))}
          </div>
        </section>
      ) : null}

      <p className="blog-back">
        <Link href="/blog">← All blog posts</Link>
      </p>

      <ProductFooter />
    </div>
  );
}
