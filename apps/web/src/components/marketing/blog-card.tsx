import Link from "next/link";
import type { BlogPostMeta } from "@/lib/content/blog";
import { categoryPath, formatPostDate } from "@/lib/content/blog";

export function BlogCard({ post }: { post: BlogPostMeta }) {
  return (
    <article className="blog-card">
      <div className="blog-card-meta">
        {post.category ? (
          <Link href={categoryPath(post.category)} className="blog-chip">
            {post.category}
          </Link>
        ) : null}
        <time dateTime={post.date}>{formatPostDate(post.date)}</time>
        <span>{post.readingTime} min read</span>
      </div>
      <h2>
        <Link href={`/blog/${post.slug}`}>{post.title}</Link>
      </h2>
      {post.description ? <p>{post.description}</p> : null}
      <Link href={`/blog/${post.slug}`} className="blog-card-more">
        Read guide →
      </Link>
    </article>
  );
}
