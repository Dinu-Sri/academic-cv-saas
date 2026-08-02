import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ModernScholarPreview } from "@/components/website/modern-scholar-preview";
import { PublicContactForm } from "@/components/website/public-contact-form";
import { recordWebsitePageView } from "@/lib/website/analytics";
import { isLegalPageKey, LEGAL_PAGE_LABELS } from "@/lib/website/legal-content";
import { isContentPage, legacyPublicPageTarget, loadPublishedSite, pageIsEnabled, resolvePublicPage } from "@/lib/website/public-site";
import { buildJsonLd, buildPublicPageMetadata } from "@/lib/website/seo";
import { captureWebsiteException } from "@/lib/sentry";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ username: string; segments?: string[] }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username, segments } = await params;
  const site = await loadPublishedSite(username);
  if (!site) {
    return { title: "Website not found", robots: { index: false, follow: false } };
  }

  const page = resolvePublicPage(segments);
  if (page === "not_found" || !pageIsEnabled(site.model, page)) {
    return { title: "Page not found", robots: { index: false, follow: false } };
  }

  if (isLegalPageKey(page)) {
    const name = site.model.identity.displayName || site.website.username;
    return {
      title: `${LEGAL_PAGE_LABELS[page]} · ${name}`,
      description: `${LEGAL_PAGE_LABELS[page]} information for this CVScholar-hosted academic website.`,
      robots: { index: false, follow: true }
    };
  }

  return buildPublicPageMetadata({
    model: site.model,
    username: site.website.username,
    page,
    indexable: site.website.searchIndexingEnabled !== false
  });
}

export default async function PublicWebsitePage({ params }: Params) {
  const { username, segments } = await params;
  const legacyTarget = legacyPublicPageTarget(segments);
  if (legacyTarget) redirect(`/${legacyTarget}`);
  const site = await loadPublishedSite(username);
  if (!site) notFound();

  const page = resolvePublicPage(segments);
  if (page === "not_found" || !pageIsEnabled(site.model, page)) {
    notFound();
  }

  const pagePath = page === "home" ? "/" : `/${page}`;
  await recordWebsitePageView(site.website.id, pagePath).catch(async (error) => {
    await captureWebsiteException(error, { tags: { area: "analytics" } });
  });

  const jsonLd = buildJsonLd(site.model, site.website.username);
  const legalPage = isLegalPageKey(page) ? page : undefined;
  const contentPage = isContentPage(page) ? page : undefined;

  return (
    <div className="website-public-standalone">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ModernScholarPreview
        model={site.model}
        mode="public"
        activePage={contentPage}
        legalPage={legalPage}
        contactSlot={
          contentPage === "contact" && site.model.contactFormEnabled ? (
            <PublicContactForm username={site.website.username} />
          ) : null
        }
      />
    </div>
  );
}
