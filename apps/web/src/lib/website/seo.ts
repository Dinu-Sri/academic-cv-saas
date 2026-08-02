import type { Metadata } from "next";
import type { WebsitePageKey } from "./constants";
import { WEBSITE_PAGE_LABELS } from "./constants";
import type { WebsiteSnapshotModel } from "./snapshot-builder";
import {
  websitePublicOrigin,
  websitePublicPageUrl,
  websitePublicSitemapUrl
} from "./public-url";
import { profileImagePublicUrl } from "./profile-image-constants";

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
  const description =
    model.seo?.description || model.summary || `${model.identity.displayName} academic website.`;
  const canonical = websitePublicPageUrl(username, page);
  const photo =
    model.identity.photoUrl ||
    (model.config?.appearance?.profileImageAssetId
      ? profileImagePublicUrl(username, model.config.appearance.profileImageAssetId.slice(0, 8))
      : undefined);
  const images = photo ? [{ url: photo, alt: model.identity.displayName || username }] : undefined;

  return {
    title,
    description,
    authors: model.identity.displayName ? [{ name: model.identity.displayName }] : undefined,
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "profile",
      siteName: model.identity.displayName || "Academic website",
      locale: "en_US",
      images,
      ...(model.identity.displayName
        ? {
            firstName: model.identity.displayName.split(/\s+/)[0],
            lastName: model.identity.displayName.split(/\s+/).slice(1).join(" ") || undefined,
            username
          }
        : {})
    },
    twitter: {
      card: photo ? "summary_large_image" : "summary",
      title,
      description,
      images: photo ? [photo] : undefined
    }
  };
}

export function buildJsonLd(model: WebsiteSnapshotModel, username: string) {
  const url = websitePublicOrigin(username);
  const photo =
    model.identity.photoUrl ||
    (model.config?.appearance?.profileImageAssetId
      ? profileImagePublicUrl(username, model.config.appearance.profileImageAssetId.slice(0, 8))
      : undefined);

  const person = {
    "@type": "Person",
    "@id": `${url}#person`,
    name: model.identity.displayName,
    jobTitle: model.identity.headline || undefined,
    image: photo || undefined,
    affiliation: model.identity.affiliation
      ? {
          "@type": "Organization",
          name: model.identity.affiliation
        }
      : undefined,
    url,
    sameAs: [model.identity.orcidUrl, model.identity.googleScholarUrl, model.identity.linkedinUrl].filter(Boolean),
    email: model.identity.email || undefined,
    worksFor: model.identity.affiliation
      ? {
          "@type": "Organization",
          name: model.identity.affiliation
        }
      : undefined
  };

  const profilePage = {
    "@type": "ProfilePage",
    "@id": `${url}#profilepage`,
    name: model.seo?.title || `${model.identity.displayName} Academic Website`,
    description: model.seo?.description || model.summary,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: model.identity.displayName || username,
      url
    },
    mainEntity: { "@id": `${url}#person` },
    about: { "@id": `${url}#person` }
  };

  const publications = (model.sections.publications || []).slice(0, 25).map((entry, index) => ({
    "@type": "ScholarlyArticle",
    "@id": `${url}#pub-${index + 1}`,
    name: entry.data.title || "Publication",
    author: entry.data.authors
      ? String(entry.data.authors)
          .split(/,|;| and /i)
          .map((name) => ({ "@type": "Person", name: name.trim() }))
          .filter((a) => a.name)
      : [{ "@type": "Person", name: model.identity.displayName }],
    datePublished: entry.data.year || undefined,
    isPartOf: entry.data.venue
      ? {
          "@type": "Periodical",
          name: entry.data.venue
        }
      : undefined,
    identifier: entry.data.doi
      ? {
          "@type": "PropertyValue",
          propertyID: "DOI",
          value: entry.data.doi
        }
      : undefined,
    url: entry.data.url || undefined
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [person, profilePage, ...publications]
  };
}

/** @deprecated Use websitePublicPageUrl / websitePublicOrigin */
export function absoluteUrl(path: string) {
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
