import type { AcademicCategoryKey } from "./composition-types";

export type WebsiteSectionDefinition = {
  key: string;
  label: string;
  category: AcademicCategoryKey;
  visibilityKey: string;
  anchor?: boolean;
  fields: string[];
};

export const WEBSITE_SECTION_REGISTRY: WebsiteSectionDefinition[] = [
  {
    key: "research_interests",
    label: "Research themes",
    category: "research",
    visibilityKey: "researchInterests",
    fields: ["interest", "title", "description"]
  },
  {
    key: "research_experience",
    label: "Research experience",
    category: "research",
    visibilityKey: "researchExperience",
    fields: ["title", "role", "institution", "years", "description"]
  },
  {
    key: "publications",
    label: "Publications",
    category: "research",
    visibilityKey: "publications",
    anchor: true,
    fields: ["title", "authors", "year", "venue", "doi", "url"]
  },
  {
    key: "projects",
    label: "Projects",
    category: "research",
    visibilityKey: "projects",
    anchor: true,
    fields: ["title", "role", "year", "funder", "description"]
  },
  {
    key: "grants",
    label: "Grants and funding",
    category: "research",
    visibilityKey: "grants",
    fields: ["title", "funder", "amount", "year", "role"]
  },
  {
    key: "patents",
    label: "Patents and innovation",
    category: "research",
    visibilityKey: "patents",
    fields: ["title", "number", "year", "status", "inventors"]
  },
  {
    key: "academic_appointments",
    label: "Academic appointments",
    category: "journey",
    visibilityKey: "academicAppointments",
    anchor: true,
    fields: ["title", "institution", "years", "location"]
  },
  {
    key: "experience",
    label: "Professional experience",
    category: "journey",
    visibilityKey: "experience",
    anchor: true,
    fields: ["title", "organization", "years", "location", "description"]
  },
  {
    key: "education",
    label: "Education",
    category: "journey",
    visibilityKey: "education",
    anchor: true,
    fields: ["degree", "institution", "year", "field"]
  },
  {
    key: "teaching",
    label: "Teaching",
    category: "journey",
    visibilityKey: "teaching",
    anchor: true,
    fields: ["course", "role", "institution", "year", "description"]
  },
  {
    key: "supervision",
    label: "Supervision and mentorship",
    category: "journey",
    visibilityKey: "supervision",
    fields: ["student", "topic", "level", "year", "status"]
  },
  {
    key: "certifications",
    label: "Professional development",
    category: "journey",
    visibilityKey: "certifications",
    fields: ["name", "issuer", "year", "credential"]
  },
  {
    key: "skills",
    label: "Skills and methods",
    category: "journey",
    visibilityKey: "skills",
    fields: ["name", "skill", "level", "description"]
  },
  {
    key: "languages",
    label: "Languages",
    category: "journey",
    visibilityKey: "languages",
    fields: ["language", "level", "proficiency"]
  },
  {
    key: "academic_service",
    label: "Academic service",
    category: "contributions",
    visibilityKey: "academicService",
    fields: ["role", "organization", "year", "description"]
  },
  {
    key: "editorial",
    label: "Editorial and reviewing",
    category: "contributions",
    visibilityKey: "editorial",
    fields: ["role", "journal", "years", "description"]
  },
  {
    key: "invited_talks",
    label: "Invited talks",
    category: "contributions",
    visibilityKey: "invitedTalks",
    fields: ["title", "event", "year", "location"]
  },
  {
    key: "conferences",
    label: "Conferences",
    category: "contributions",
    visibilityKey: "conferences",
    fields: ["title", "conference", "year", "location", "role"]
  },
  {
    key: "memberships",
    label: "Professional memberships",
    category: "contributions",
    visibilityKey: "memberships",
    fields: ["organization", "role", "years", "status"]
  },
  {
    key: "awards",
    label: "Awards and recognition",
    category: "contributions",
    visibilityKey: "awards",
    fields: ["title", "issuer", "year", "description"]
  }
];

export const WEBSITE_SECTION_BY_KEY = new Map(WEBSITE_SECTION_REGISTRY.map((section) => [section.key, section]));

export const ACADEMIC_CATEGORY_META = {
  research: {
    label: "Research",
    description: "Ideas, projects, funding, publications, and research outputs."
  },
  journey: {
    label: "Academic Journey",
    description: "Appointments, education, teaching, supervision, and professional development."
  },
  contributions: {
    label: "Contributions",
    description: "Service, editorial work, talks, memberships, and recognition."
  }
} satisfies Record<AcademicCategoryKey, { label: string; description: string }>;
