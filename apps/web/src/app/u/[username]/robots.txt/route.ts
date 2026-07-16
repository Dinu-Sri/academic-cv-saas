import { NextResponse } from "next/server";
import { loadPublishedSite } from "@/lib/website/public-site";
import { absoluteUrl } from "@/lib/website/seo";

type Params = { params: Promise<{ username: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { username } = await params;
  const site = await loadPublishedSite(username);
  if (!site) {
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  const indexable = site.website.searchIndexingEnabled !== false;
  const body = indexable
    ? `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl(`/u/${username}/sitemap.xml`)}\n`
    : `User-agent: *\nDisallow: /\n`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
