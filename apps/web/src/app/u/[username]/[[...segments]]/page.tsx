import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModernScholarPreview } from "@/components/website/modern-scholar-preview";
import { loadPublishedSite, pageIsEnabled, resolvePublicPage } from "@/lib/website/public-site";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ username: string; segments?: string[] }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username, segments } = await params;
  const site = await loadPublishedSite(username);
  if (!site) {
    return {
      title: "Website not found",
      robots: { index: false, follow: false }
    };
  }

  const page = resolvePublicPage(segments);
  if (page === "not_found" || !pageIsEnabled(site.model, page)) {
    return {
      title: "Page not found",
      robots: { index: false, follow: false }
    };
  }

  const title = site.model.seo?.title || `${site.model.identity.displayName} | Academic Website`;
  const description = site.model.seo?.description || site.model.summary;
  const indexable = site.website.searchIndexingEnabled !== false;

  return {
    title: page === "home" ? title : `${page[0]?.toUpperCase()}${page.slice(1)} · ${site.model.identity.displayName}`,
    description,
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    alternates: {
      canonical: page === "home" ? `/u/${site.website.username}` : `/u/${site.website.username}/${page}`
    }
  };
}

export default async function PublicWebsitePage({ params }: Params) {
  const { username, segments } = await params;
  const site = await loadPublishedSite(username);
  if (!site) notFound();

  const page = resolvePublicPage(segments);
  if (page === "not_found" || !pageIsEnabled(site.model, page)) {
    notFound();
  }

  return (
    <div className="website-public-standalone">
      <ModernScholarPreview model={site.model} mode="public" activePage={page} />
    </div>
  );
}
