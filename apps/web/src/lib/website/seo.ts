import type { Metadata } from "next";
import type { WebsitePageKey } from "./constants";
import { WEBSITE_PAGE_LABELS, WEBSITE_ROOT_DOMAIN } from "./constants";
import type { WebsiteSnapshotModel } from "./snapshot-builder";

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
  const canonicalPath = page === "home" ? `/u/${username}` : `/u/${username}/${page}`;
  const canonical = absoluteUrl(canonicalPath);

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
  const url = absoluteUrl(`/u/${username}`);
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

export function absoluteUrl(path: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || `https://${WEBSITE_ROOT_DOMAIN}`).replace(/\/+$/, "");
  return `${appUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
