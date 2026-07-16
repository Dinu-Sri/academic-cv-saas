import type { WebsiteSnapshotModel } from "./snapshot-builder";
import { getActivePublishedSnapshot } from "./snapshot-builder";
import type { WebsitePageKey } from "./constants";
import { WEBSITE_PAGE_KEYS } from "./constants";
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

  const model = normalizePublicModel(sanitizePublicWebsiteModel(raw), result.website.username);

  return {
    website: result.website,
    snapshot: result.snapshot,
    model
  };
}

/** Ensure snapshots always expose subdomain public URLs and relative nav paths. */
function normalizePublicModel(model: WebsiteSnapshotModel, username: string): WebsiteSnapshotModel {
  return {
    ...model,
    publicUrl: websitePublicOrigin(username),
    pages: (model.pages || []).map((page) => ({
      ...page,
      href: websitePublicPagePath((page.key as WebsitePageKey) || "home")
    }))
  };
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
