export type WebsiteReadinessItem = {
  key: string;
  label: string;
  category: "required" | "recommended" | "optional";
  status: "complete" | "missing";
  message: string;
};

export type WebsiteReadiness = {
  score: number;
  canPublish: boolean;
  items: WebsiteReadinessItem[];
  missingRequired: string[];
};

type ProfileLike = {
  displayName: string;
  headline: string;
  affiliation: string;
  bio: string;
  researchSummary: string;
  email: string;
  orcidUrl: string;
  googleScholarUrl: string;
};

/** Counts used for readiness scoring and minimum body-content gate. */
export type WebsiteReadinessCounts = {
  publications: number;
  education: number;
  experience: number;
  teaching: number;
  /** Academic appointments (optional detail). */
  appointments?: number;
  projects?: number;
  /**
   * Total non-empty public CV section entries that can appear on the website.
   * If omitted, derived from known count fields.
   */
  bodyEntries?: number;
};

/**
 * Publish readiness.
 * Required floor matches minimum prototype: identity + at least one CV body section.
 * ORCID / publications / photo are never required.
 */
export function assessWebsiteReadiness(profile: ProfileLike, counts: WebsiteReadinessCounts): WebsiteReadiness {
  const bodyEntries =
    typeof counts.bodyEntries === "number"
      ? counts.bodyEntries
      : (counts.publications || 0) +
        (counts.education || 0) +
        (counts.experience || 0) +
        (counts.teaching || 0) +
        (counts.appointments || 0) +
        (counts.projects || 0);

  const items: WebsiteReadinessItem[] = [
    item("displayName", "Full name", "required", Boolean(profile.displayName?.trim()), "Add your public name."),
    item("headline", "Academic title", "required", Boolean(profile.headline?.trim()), "Add your academic title or role."),
    item("affiliation", "Institution", "required", Boolean(profile.affiliation?.trim()), "Add your university or institution."),
    item(
      "summary",
      "Summary or research overview",
      "required",
      Boolean(profile.bio?.trim() || profile.researchSummary?.trim()),
      "Add a concise academic summary or research overview."
    ),
    item(
      "bodyContent",
      "At least one CV section",
      "required",
      bodyEntries > 0,
      "Add education, teaching, experience, appointments, publications, or another CV section so the site has content."
    ),
    item("education", "Education", "recommended", counts.education > 0, "Add at least one education entry."),
    item("publications", "Publications", "recommended", counts.publications > 0, "Add publications to enrich your public site."),
    item("experience", "Experience", "recommended", counts.experience > 0 || (counts.appointments || 0) > 0, "Add academic or professional experience."),
    item("teaching", "Teaching", "optional", counts.teaching > 0, "Add teaching entries if relevant."),
    item(
      "links",
      "Public research links",
      "optional",
      Boolean(profile.orcidUrl?.trim() || profile.googleScholarUrl?.trim()),
      "Add ORCID or Google Scholar for stronger discovery."
    )
  ];

  const required = items.filter((entry) => entry.category === "required");
  const completeWeight = items.reduce((sum, entry) => sum + (entry.status === "complete" ? weight(entry.category) : 0), 0);
  const totalWeight = items.reduce((sum, entry) => sum + weight(entry.category), 0);
  const score = Math.round((completeWeight / totalWeight) * 100);
  const missingRequired = required.filter((entry) => entry.status === "missing").map((entry) => entry.label);

  return {
    score,
    canPublish: missingRequired.length === 0,
    items,
    missingRequired
  };
}

function item(
  key: string,
  label: string,
  category: WebsiteReadinessItem["category"],
  complete: boolean,
  message: string
): WebsiteReadinessItem {
  return {
    key,
    label,
    category,
    status: complete ? "complete" : "missing",
    message: complete ? "Ready" : message
  };
}

function weight(category: WebsiteReadinessItem["category"]) {
  if (category === "required") return 3;
  if (category === "recommended") return 2;
  return 1;
}

/** Count all entries that can appear on the public website (any section key). */
export function countWebsiteBodyEntries(entries: { sectionKey: string }[]): number {
  return entries.length;
}

export function buildReadinessCounts(entries: { sectionKey: string }[]): WebsiteReadinessCounts {
  const counts: WebsiteReadinessCounts = {
    publications: 0,
    education: 0,
    experience: 0,
    teaching: 0,
    appointments: 0,
    projects: 0,
    bodyEntries: entries.length
  };
  for (const entry of entries) {
    if (entry.sectionKey === "publications") counts.publications += 1;
    else if (entry.sectionKey === "education") counts.education += 1;
    else if (entry.sectionKey === "experience") counts.experience += 1;
    else if (entry.sectionKey === "teaching") counts.teaching += 1;
    else if (entry.sectionKey === "academic_appointments") counts.appointments = (counts.appointments || 0) + 1;
    else if (entry.sectionKey === "projects") counts.projects = (counts.projects || 0) + 1;
  }
  return counts;
}
