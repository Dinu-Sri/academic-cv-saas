import type { WebsiteSnapshotModel } from "./snapshot-builder";
import { buildSiteIR, DEFAULT_SITE_THEME_ID } from "./site-engine";

type SnapshotSections = WebsiteSnapshotModel["sections"];
type SectionEntry = SnapshotSections[keyof SnapshotSections][number];

/**
 * Public snapshot safety: never expose private identity fields unless explicitly enabled
 * in the stored snapshot fieldVisibility. Also strip unknown sensitive keys.
 * Rebuilds Site IR so frozen chrome/blocks respect visibility.
 */
export function sanitizePublicWebsiteModel(model: WebsiteSnapshotModel): WebsiteSnapshotModel {
  const visibility = model.fieldVisibility || {
    showEmail: false,
    showPhone: false,
    showLocation: false,
    showReferences: false,
    showLinkedIn: true,
    showOrcid: true,
    showGoogleScholar: true,
    showCvDownload: false
  };

  const photoUrl =
    typeof model.identity.photoUrl === "string" && model.identity.photoUrl.trim()
      ? model.identity.photoUrl.trim()
      : undefined;

  const identity = {
    displayName: model.identity.displayName || "",
    headline: model.identity.headline || "",
    affiliation: model.identity.affiliation || "",
    location: visibility.showLocation ? model.identity.location || "" : "",
    email: visibility.showEmail ? model.identity.email || "" : "",
    orcidUrl: visibility.showOrcid ? model.identity.orcidUrl || "" : "",
    googleScholarUrl: visibility.showGoogleScholar ? model.identity.googleScholarUrl || "" : "",
    linkedinUrl: visibility.showLinkedIn ? model.identity.linkedinUrl || "" : "",
    // Profile photos are intentional public appearance data — do not strip on sanitization.
    ...(photoUrl ? { photoUrl } : {})
  };

  const cleanSections = {} as SnapshotSections;
  for (const key of Object.keys(model.sections) as Array<keyof SnapshotSections>) {
    const entries = model.sections[key] || [];
    // Optional references section if present on older/legacy snapshot payloads.
    if (key === ("references" as keyof SnapshotSections) && !visibility.showReferences) {
      cleanSections[key] = [] as SnapshotSections[typeof key];
      continue;
    }
    cleanSections[key] = entries.map((entry: SectionEntry) => ({
      id: entry.id,
      sectionKey: entry.sectionKey,
      data: stripSensitiveEntryData(entry.data || {})
    })) as SnapshotSections[typeof key];
  }

  const cvDownloadUrl = visibility.showCvDownload ? model.cvDownloadUrl || "" : "";
  const next: WebsiteSnapshotModel = {
    ...model,
    cvDownloadUrl,
    identity,
    sections: cleanSections,
    fieldVisibility: visibility
  };

  // Re-compose IR from sanitized payload (visibility + stripped fields).
  if (model.composition && model.pages?.length) {
    next.siteIr = buildSiteIR({
      username: model.username || "site",
      publicUrl: model.publicUrl,
      status: model.status,
      identity: { ...identity, summary: model.summary },
      summary: model.summary,
      sections: cleanSections as Record<string, { id: string; data: Record<string, string> }[]>,
      composition: model.composition,
      pages: model.pages,
      content: {
        research: model.content?.research,
        journey: model.content?.journey,
        contributions: model.content?.contributions,
        contactIntro: model.content?.contactIntro || ""
      },
      contactFormEnabled: model.contactFormEnabled,
      cvDownloadUrl,
      showPlatformBranding: model.showPlatformBranding !== false,
      searchIndexingEnabled: Boolean(model.searchIndexingEnabled),
      seo: {
        title: model.seo?.title || identity.displayName,
        description: model.seo?.description || model.summary || ""
      },
      themeId: model.siteIr?.themeId || DEFAULT_SITE_THEME_ID
    });
  }

  return next;
}

function stripSensitiveEntryData(data: Record<string, string>) {
  const blocked = new Set([
    "phone",
    "mobile",
    "address",
    "home_address",
    "private_notes",
    "notes_private",
    "ssn",
    "passport",
    "national_id"
  ]);
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (blocked.has(key.toLowerCase())) continue;
    cleaned[key] = value;
  }
  return cleaned;
}
