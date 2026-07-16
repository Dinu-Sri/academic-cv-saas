import { NextResponse } from "next/server";
import { loadPublishedSite } from "@/lib/website/public-site";
import { websitePublicOrigin, websitePublicPageUrl } from "@/lib/website/public-url";
import type { WebsitePageKey } from "@/lib/website/constants";

type Params = { params: Promise<{ username: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { username } = await params;
  const site = await loadPublishedSite(username);
  if (!site || site.website.searchIndexingEnabled === false) {
    return new NextResponse("Not found", { status: 404 });
  }

  const urls = site.model.pages
    .map((page) => {
      const loc = websitePublicPageUrl(username, (page.key as WebsitePageKey) || "home");
      return `  <url><loc>${escapeXml(loc)}</loc><changefreq>weekly</changefreq></url>`;
    })
    .join("\n");

  // Always include home origin even if pages list is empty.
  const home = escapeXml(websitePublicOrigin(username));
  const bodyUrls = urls || `  <url><loc>${home}</loc><changefreq>weekly</changefreq></url>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${bodyUrls}\n</urlset>`;
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
