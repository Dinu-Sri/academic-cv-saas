import type { WebsiteSnapshotModel } from "./snapshot-builder";
import { getActivePublishedSnapshot } from "./snapshot-builder";
import type { WebsitePageKey } from "./constants";
import { WEBSITE_PAGE_KEYS } from "./constants";
import { sanitizePublicWebsiteModel } from "./security";

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

  const model = sanitizePublicWebsiteModel(raw);

  return {
    website: result.website,
    snapshot: result.snapshot,
    model
  };
}

export function resolvePublicPage(segments?: string[]): WebsitePageKey | "not_found" {
  if (!segments || segments.length === 0) return "home";
  if (segments.length > 1) return "not_found";
  const key = segments[0] as WebsitePageKey;
  if ((WEBSITE_PAGE_KEYS as readonly string[]).includes(key)) return key;
  return "not_found";
}

export function pageIsEnabled(model: WebsiteSnapshotModel, page: WebsitePageKey) {
  if (page === "home") return true;
  return model.pages.some((entry) => entry.key === page);
}
