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

type Counts = {
  publications: number;
  education: number;
  experience: number;
  teaching: number;
};

export function assessWebsiteReadiness(profile: ProfileLike, counts: Counts): WebsiteReadiness {
  const items: WebsiteReadinessItem[] = [
    item("displayName", "Full name", "required", Boolean(profile.displayName.trim()), "Add your public name."),
    item("headline", "Academic title", "required", Boolean(profile.headline.trim()), "Add your academic title or role."),
    item("affiliation", "Institution", "required", Boolean(profile.affiliation.trim()), "Add your university or institution."),
    item(
      "summary",
      "Short bio or research summary",
      "required",
      Boolean(profile.bio.trim() || profile.researchSummary.trim()),
      "Add a short bio or research summary."
    ),
    item("education", "Education", "recommended", counts.education > 0, "Add at least one education entry."),
    item("publications", "Publications", "recommended", counts.publications > 0, "Add publications to enrich your public site."),
    item("experience", "Experience", "recommended", counts.experience > 0, "Add academic or professional experience."),
    item("teaching", "Teaching", "optional", counts.teaching > 0, "Add teaching entries if relevant."),
    item(
      "links",
      "Public research links",
      "optional",
      Boolean(profile.orcidUrl.trim() || profile.googleScholarUrl.trim()),
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
