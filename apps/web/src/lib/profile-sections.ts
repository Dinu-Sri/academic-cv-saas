export type ProfileFieldType = "text" | "email" | "url" | "textarea" | "select";

export type ProfileFieldDefinition = {
  name: string;
  label: string;
  type: ProfileFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export type ProfileSectionDefinition = {
  key: string;
  title: string;
  shortTitle: string;
  description: string;
  addLabel: string;
  summaryField: string;
  sectionOrder: number;
  fields: ProfileFieldDefinition[];
};

export const personalFields: ProfileFieldDefinition[] = [
  { name: "displayName", label: "Name", type: "text", required: true },
  { name: "headline", label: "Academic Title", type: "text", placeholder: "Senior Lecturer, Researcher, PhD Candidate" },
  { name: "affiliation", label: "University / Institution", type: "text" },
  { name: "location", label: "Location", type: "text" },
  { name: "email", label: "Email", type: "email" },
  { name: "websiteUrl", label: "Website", type: "url" },
  { name: "googleScholarUrl", label: "Google Scholar", type: "url" },
  { name: "orcidUrl", label: "ORCID", type: "url" },
  { name: "linkedinUrl", label: "LinkedIn", type: "url" },
  { name: "bio", label: "Short Bio", type: "textarea" },
  { name: "researchSummary", label: "Research Summary", type: "textarea" }
];

export const profileSections = [
  {
    key: "research_interests",
    title: "Research Interests",
    shortTitle: "Research",
    description: "Main research areas visitors and CV readers should see first.",
    addLabel: "Add interest",
    summaryField: "interest",
    sectionOrder: 10,
    fields: [
      { name: "interest", label: "Research Interest", type: "text", required: true },
      { name: "details", label: "Details", type: "textarea" }
    ]
  },
  {
    key: "education",
    title: "Education",
    shortTitle: "Education",
    description: "Degrees, qualifications, and academic training.",
    addLabel: "Add education",
    summaryField: "degree",
    sectionOrder: 20,
    fields: [
      { name: "degree", label: "Degree / Qualification", type: "text", required: true },
      { name: "institution", label: "Institution", type: "text", required: true },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text", placeholder: "Present" },
      { name: "details", label: "Details", type: "textarea" }
    ]
  },
  {
    key: "experience",
    title: "Appointments",
    shortTitle: "Appointments",
    description: "Academic, research, clinical, or professional roles.",
    addLabel: "Add role",
    summaryField: "position",
    sectionOrder: 30,
    fields: [
      { name: "position", label: "Position", type: "text", required: true },
      { name: "organization", label: "Organization", type: "text", required: true },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text", placeholder: "Present" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "publications",
    title: "Publications",
    shortTitle: "Publications",
    description: "Selected publications, articles, books, and conference papers.",
    addLabel: "Add publication",
    summaryField: "title",
    sectionOrder: 40,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "authors", label: "Authors", type: "textarea" },
      { name: "venue", label: "Journal / Venue", type: "text" },
      { name: "year", label: "Year", type: "text" },
      { name: "doi", label: "DOI", type: "text" },
      { name: "url", label: "URL", type: "url" }
    ]
  },
  {
    key: "projects",
    title: "Projects",
    shortTitle: "Projects",
    description: "Research projects, collaborations, and applied work.",
    addLabel: "Add project",
    summaryField: "title",
    sectionOrder: 50,
    fields: [
      { name: "title", label: "Project Title", type: "text", required: true },
      { name: "role", label: "Role", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "teaching",
    title: "Teaching",
    shortTitle: "Teaching",
    description: "Courses, modules, lectures, workshops, and teaching roles.",
    addLabel: "Add teaching",
    summaryField: "course",
    sectionOrder: 60,
    fields: [
      { name: "course", label: "Course / Activity", type: "text", required: true },
      { name: "institution", label: "Institution", type: "text" },
      { name: "year", label: "Year", type: "text" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "awards",
    title: "Awards",
    shortTitle: "Awards",
    description: "Awards, honors, scholarships, and recognitions.",
    addLabel: "Add award",
    summaryField: "title",
    sectionOrder: 70,
    fields: [
      { name: "title", label: "Award", type: "text", required: true },
      { name: "issuer", label: "Issuer", type: "text" },
      { name: "year", label: "Year", type: "text" },
      { name: "details", label: "Details", type: "textarea" }
    ]
  },
  {
    key: "grants",
    title: "Grants",
    shortTitle: "Grants",
    description: "Funded grants, fellowships, and sponsored projects.",
    addLabel: "Add grant",
    summaryField: "title",
    sectionOrder: 80,
    fields: [
      { name: "title", label: "Grant Title", type: "text", required: true },
      { name: "funder", label: "Funder", type: "text" },
      { name: "amount", label: "Amount", type: "text" },
      { name: "year", label: "Year", type: "text" },
      { name: "role", label: "Role", type: "text" }
    ]
  },
  {
    key: "conferences",
    title: "Conferences",
    shortTitle: "Conferences",
    description: "Conference talks, presentations, invited lectures, and posters.",
    addLabel: "Add conference",
    summaryField: "title",
    sectionOrder: 90,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "event", label: "Event", type: "text" },
      { name: "location", label: "Location", type: "text" },
      { name: "year", label: "Year", type: "text" },
      { name: "type", label: "Type", type: "select", options: ["Presentation", "Poster", "Invited talk", "Workshop"] }
    ]
  },
  {
    key: "supervision",
    title: "Supervision",
    shortTitle: "Supervision",
    description: "Student supervision and mentoring activities.",
    addLabel: "Add supervision",
    summaryField: "student",
    sectionOrder: 100,
    fields: [
      { name: "student", label: "Student / Group", type: "text", required: true },
      { name: "level", label: "Level", type: "text", placeholder: "PhD, MSc, Undergraduate" },
      { name: "topic", label: "Topic", type: "text" },
      { name: "year", label: "Year", type: "text" }
    ]
  },
  {
    key: "memberships",
    title: "Memberships",
    shortTitle: "Memberships",
    description: "Professional memberships and academic service roles.",
    addLabel: "Add membership",
    summaryField: "organization",
    sectionOrder: 110,
    fields: [
      { name: "organization", label: "Organization", type: "text", required: true },
      { name: "role", label: "Role / Membership Type", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text" }
    ]
  },
  {
    key: "languages",
    title: "Languages",
    shortTitle: "Languages",
    description: "Languages and proficiency levels.",
    addLabel: "Add language",
    summaryField: "language",
    sectionOrder: 120,
    fields: [
      { name: "language", label: "Language", type: "text", required: true },
      { name: "proficiency", label: "Proficiency", type: "select", options: ["Native", "Fluent", "Professional", "Intermediate", "Basic"] }
    ]
  },
  {
    key: "references",
    title: "References",
    shortTitle: "References",
    description: "Reference contacts or a note such as available on request.",
    addLabel: "Add reference",
    summaryField: "name",
    sectionOrder: 130,
    fields: [
      { name: "name", label: "Name / Note", type: "text", required: true },
      { name: "title", label: "Title", type: "text" },
      { name: "institution", label: "Institution", type: "text" },
      { name: "email", label: "Email", type: "email" }
    ]
  }
] as const satisfies readonly ProfileSectionDefinition[];

export type ProfileSectionKey = (typeof profileSections)[number]["key"];

export function sectionDefinitionByKey(key: string) {
  return profileSections.find((section) => section.key === key);
}

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

export function entrySummary(sectionKey: string, data: Record<string, unknown>) {
  const definition = sectionDefinitionByKey(sectionKey);
  const preferred = definition?.summaryField ? data[definition.summaryField] : "";

  if (typeof preferred === "string" && preferred.trim()) {
    return preferred.trim();
  }

  for (const field of definition?.fields ?? []) {
    const value = data[field.name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "New entry";
}
