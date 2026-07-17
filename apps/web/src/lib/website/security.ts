import type { WebsiteSnapshotModel } from "./snapshot-builder";

type SnapshotSections = WebsiteSnapshotModel["sections"];
type SectionEntry = SnapshotSections[keyof SnapshotSections][number];

/**
 * Public snapshot safety: never expose private identity fields unless explicitly enabled
 * in the stored snapshot fieldVisibility. Also strip unknown sensitive keys.
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

  const identity = {
    displayName: model.identity.displayName || "",
    headline: model.identity.headline || "",
    affiliation: model.identity.affiliation || "",
    location: visibility.showLocation ? model.identity.location || "" : "",
    email: visibility.showEmail ? model.identity.email || "" : "",
    orcidUrl: visibility.showOrcid ? model.identity.orcidUrl || "" : "",
    googleScholarUrl: visibility.showGoogleScholar ? model.identity.googleScholarUrl || "" : "",
    linkedinUrl: visibility.showLinkedIn ? model.identity.linkedinUrl || "" : ""
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

  return {
    ...model,
    cvDownloadUrl: visibility.showCvDownload ? model.cvDownloadUrl || "" : "",
    identity,
    sections: cleanSections,
    fieldVisibility: visibility
  };
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
