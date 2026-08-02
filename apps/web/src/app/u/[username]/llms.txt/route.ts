import { NextResponse } from "next/server";
import { loadPublishedSite } from "@/lib/website/public-site";
import { websitePublicOrigin, websitePublicPageUrl, websitePublicSitemapUrl } from "@/lib/website/public-url";
import type { WebsitePageKey } from "@/lib/website/constants";

type Params = { params: Promise<{ username: string }> };

/** Scholar-site /llms.txt — brief, public research profile overview for AI crawlers. */
export async function GET(_request: Request, { params }: Params) {
  const { username } = await params;
  const site = await loadPublishedSite(username);
  if (!site || site.website.searchIndexingEnabled === false) {
    return new NextResponse("Not found", { status: 404 });
  }

  const name = site.model.identity.displayName || username;
  const origin = websitePublicOrigin(username);
  const pages = site.model.pages
    .map((page) => {
      const key = (page.key as WebsitePageKey) || "home";
      const url = websitePublicPageUrl(username, key);
      return `- [${page.label}](${url})`;
    })
    .join("\n");

  const body = [
    `# ${name}`,
    "",
    `> Academic website for ${name}${site.model.identity.headline ? `, ${site.model.identity.headline}` : ""}${
      site.model.identity.affiliation ? ` at ${site.model.identity.affiliation}` : ""
    }.`,
    "",
    site.model.summary ? site.model.summary.slice(0, 600) : "",
    "",
    "## Pages",
    "",
    pages || `- [Home](${origin})`,
    "",
    "## Optional",
    "",
    `- [Sitemap](${websitePublicSitemapUrl(username)})`,
    `- Hosted with CVScholar: https://cvscholar.com`,
    ""
  ]
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
    .join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
