import type { Metadata } from "next";
import type { WebsitePageKey } from "./constants";
import { WEBSITE_PAGE_LABELS } from "./constants";
import type { WebsiteSnapshotModel } from "./snapshot-builder";
import { websitePublicOrigin, websitePublicPageUrl, websitePublicSitemapUrl } from "./public-url";

export function buildPublicPageMetadata({
  model,
  username,
  page,
  indexable
}: {
  model: WebsiteSnapshotModel;
  username: string;
  page: WebsitePageKey;
  indexable: boolean;
}): Metadata {
  const baseTitle = model.seo?.title || `${model.identity.displayName} | Academic Website`;
  const pageLabel = WEBSITE_PAGE_LABELS[page];
  const title = page === "home" ? baseTitle : `${pageLabel} · ${model.identity.displayName || username}`;
  const description = model.seo?.description || model.summary || `${model.identity.displayName} academic website.`;
  const canonical = websitePublicPageUrl(username, page);

  return {
    title,
    description,
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "profile",
      siteName: "CVScholar"
    }
  };
}

export function buildJsonLd(model: WebsiteSnapshotModel, username: string) {
  const url = websitePublicOrigin(username);
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: model.identity.displayName,
    jobTitle: model.identity.headline || undefined,
    affiliation: model.identity.affiliation
      ? {
          "@type": "Organization",
          name: model.identity.affiliation
        }
      : undefined,
    url,
    sameAs: [model.identity.orcidUrl, model.identity.googleScholarUrl, model.identity.linkedinUrl].filter(Boolean),
    email: model.identity.email || undefined
  };

  const profilePage = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: model.seo?.title || `${model.identity.displayName} Academic Website`,
    description: model.seo?.description || model.summary,
    url,
    mainEntity: {
      "@type": "Person",
      name: model.identity.displayName
    }
  };

  const publications = (model.sections.publications || []).slice(0, 20).map((entry) => ({
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    name: entry.data.title || "Publication",
    author: entry.data.authors || model.identity.displayName,
    datePublished: entry.data.year || undefined,
    isPartOf: entry.data.venue || undefined,
    identifier: entry.data.doi || undefined,
    url: entry.data.url || undefined
  }));

  return [person, profilePage, ...publications];
}

/** @deprecated Use websitePublicPageUrl / websitePublicOrigin */
export function absoluteUrl(path: string) {
  // Legacy helper: if path is /u/user/..., convert to subdomain URL.
  const match = path.match(/^\/u\/([^/]+)(\/.*)?$/);
  if (match) {
    const username = match[1];
    const rest = (match[2] || "").replace(/^\//, "");
    if (!rest || rest === "home") return websitePublicOrigin(username);
    return `${websitePublicOrigin(username)}/${rest}`;
  }
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

export function publicSitemapUrl(username: string) {
  return websitePublicSitemapUrl(username);
}
