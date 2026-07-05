export const profileSections = [
  {
    key: "research_interests",
    title: "Research Interests",
    summaryLabel: "Short research focus",
    itemsLabel: "Research interests"
  },
  {
    key: "education",
    title: "Education",
    summaryLabel: "Education summary",
    itemsLabel: "Degrees"
  },
  {
    key: "experience",
    title: "Experience",
    summaryLabel: "Experience summary",
    itemsLabel: "Academic or professional roles"
  },
  {
    key: "publications",
    title: "Publications",
    summaryLabel: "Publication summary",
    itemsLabel: "Selected publications"
  },
  {
    key: "projects",
    title: "Projects",
    summaryLabel: "Project summary",
    itemsLabel: "Projects"
  },
  {
    key: "teaching",
    title: "Teaching",
    summaryLabel: "Teaching summary",
    itemsLabel: "Courses or teaching roles"
  },
  {
    key: "awards",
    title: "Awards",
    summaryLabel: "Awards summary",
    itemsLabel: "Awards and honors"
  },
  {
    key: "grants",
    title: "Grants",
    summaryLabel: "Grant summary",
    itemsLabel: "Grants"
  },
  {
    key: "conferences",
    title: "Conferences",
    summaryLabel: "Conference summary",
    itemsLabel: "Conference activity"
  },
  {
    key: "supervision",
    title: "Supervision",
    summaryLabel: "Supervision summary",
    itemsLabel: "Supervision"
  },
  {
    key: "memberships",
    title: "Memberships",
    summaryLabel: "Membership summary",
    itemsLabel: "Memberships"
  },
  {
    key: "languages",
    title: "Languages",
    summaryLabel: "Language summary",
    itemsLabel: "Languages"
  },
  {
    key: "references",
    title: "References",
    summaryLabel: "Reference note",
    itemsLabel: "References"
  }
] as const;

export type ProfileSectionKey = (typeof profileSections)[number]["key"];

export function linesToItems(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function itemsToLines(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.filter((item): item is string => typeof item === "string").join("\n");
}
