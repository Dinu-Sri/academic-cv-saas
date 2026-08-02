import { getPostMetaList } from "@/lib/content/blog";
import { absoluteUrl } from "@/lib/content/site-url";
import { buildPlatformLlmsTxt } from "@/lib/seo/platform";

/** /llms.txt — LLM-friendly site overview (llmstxt.org). */
export async function GET() {
  const posts = getPostMetaList().slice(0, 80);
  const blogLines = posts.map((post) => {
    const url = absoluteUrl(`/blog/${post.slug}`);
    return post.description ? `- [${post.title}](${url}): ${post.description}` : `- [${post.title}](${url})`;
  });

  const body = buildPlatformLlmsTxt(blogLines);
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
