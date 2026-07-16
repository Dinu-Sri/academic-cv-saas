import { NextResponse } from "next/server";
import { loadPublishedSite } from "@/lib/website/public-site";
import { absoluteUrl } from "@/lib/website/seo";

type Params = { params: Promise<{ username: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { username } = await params;
  const site = await loadPublishedSite(username);
  if (!site || site.website.searchIndexingEnabled === false) {
    return new NextResponse("Not found", { status: 404 });
  }

  const urls = site.model.pages
    .map((page) => {
      const loc = absoluteUrl(page.href.startsWith("/u/") ? page.href : `/u/${username}${page.href === "/" ? "" : page.href}`);
      return `  <url><loc>${escapeXml(loc)}</loc><changefreq>weekly</changefreq></url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
