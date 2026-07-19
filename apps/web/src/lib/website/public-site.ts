import { getEntitlementsForWorkspace } from "@/lib/billing/entitlements";
import type { WebsiteSnapshotModel } from "./snapshot-builder";
import { getActivePublishedSnapshot } from "./snapshot-builder";
import type { WebsitePageKey } from "./constants";
import { LEGACY_WEBSITE_PAGE_REDIRECTS, WEBSITE_PAGE_KEYS } from "./constants";
import { isLegalPageKey, type LegalPageKey } from "./legal-content";
import { sanitizePublicWebsiteModel } from "./security";
import { websitePublicOrigin, websitePublicPagePath } from "./public-url";

export async function loadPublishedSite(username: string) {
  const result = await getActivePublishedSnapshot(username);
  if (!result) return null;

  // Blocked sites are not publicly available.
  if ("blockedAt" in result.website && result.website.blockedAt) {
    return null;
  }

  const raw = result.snapshot.snapshotJson as unknown as WebsiteSnapshotModel;
  if (!raw || typeof raw !== "object" || !raw.identity) {
    return null;
  }

  const entitlements = await getEntitlementsForWorkspace(result.website.workspaceId);
  const model = normalizePublicModel(sanitizePublicWebsiteModel(raw), result.website.username, {
    showPlatformBranding: entitlements.showPlatformBranding,
    canEnablePublicCvDownload: entitlements.canEnablePublicCvDownload
  });

  return {
    website: result.website,
    snapshot: result.snapshot,
    model,
    entitlements
  };
}

/** Ensure snapshots always expose subdomain public URLs and relative nav paths. */
function normalizePublicModel(
  model: WebsiteSnapshotModel,
  username: string,
  options: { showPlatformBranding: boolean; canEnablePublicCvDownload: boolean }
): WebsiteSnapshotModel {
  const normalizedPages = (model.pages || []).map((page) => {
    const key = LEGACY_WEBSITE_PAGE_REDIRECTS[page.key as keyof typeof LEGACY_WEBSITE_PAGE_REDIRECTS] || page.key;
    return { ...page, key, href: websitePublicPagePath((key as WebsitePageKey) || "home") };
  });
  const allowCv = options.canEnablePublicCvDownload && Boolean(model.fieldVisibility?.showCvDownload);
  return {
    ...model,
    publicUrl: websitePublicOrigin(username),
    showPlatformBranding: options.showPlatformBranding,
    cvDownloadUrl: allowCv ? model.cvDownloadUrl || `/api/public-sites/${encodeURIComponent(username)}/cv` : "",
    pages: normalizedPages.filter((page, index) => normalizedPages.findIndex((candidate) => candidate.key === page.key) === index),
    content: {
      ...model.content,
      journey:
        model.content.journey ||
        (model.content as typeof model.content & { about?: string; teaching?: string }).about ||
        (model.content as typeof model.content & { teaching?: string }).teaching ||
        "",
      contributions: model.content.contributions || ""
    }
  };
}

export function legacyPublicPageTarget(segments?: string[]) {
  if (!segments || segments.length !== 1) return null;
  return LEGACY_WEBSITE_PAGE_REDIRECTS[segments[0] as keyof typeof LEGACY_WEBSITE_PAGE_REDIRECTS] || null;
}

export type ResolvedPublicPage = WebsitePageKey | LegalPageKey | "not_found";

export function resolvePublicPage(segments?: string[]): ResolvedPublicPage {
  if (!segments || segments.length === 0) return "home";
  if (segments.length > 1) return "not_found";
  const key = segments[0];
  if ((WEBSITE_PAGE_KEYS as readonly string[]).includes(key)) return key as WebsitePageKey;
  if (isLegalPageKey(key)) return key;
  return "not_found";
}

export function pageIsEnabled(model: WebsiteSnapshotModel, page: WebsitePageKey | LegalPageKey) {
  if (page === "home") return true;
  if (isLegalPageKey(page)) return true;
  return model.pages.some((entry) => entry.key === page);
}

export function isContentPage(page: ResolvedPublicPage): page is WebsitePageKey {
  return page !== "not_found" && !isLegalPageKey(page);
}
