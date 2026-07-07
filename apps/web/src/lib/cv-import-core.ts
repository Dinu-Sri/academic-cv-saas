import crypto from "node:crypto";
import { personalFields, profileSections, sectionDefinitionByKey } from "./profile-sections";

export type CvImportDraft = {
  personal: Record<string, string>;
  sections: Record<string, Record<string, string>[]>;
  unmapped: string[];
  warnings: string[];
};

const personalFieldNames = new Set(personalFields.map((field) => field.name));
const sectionAliases: Record<string, string> = {
  academic_profile: "bio",
  profile: "bio",
  summary: "bio",
  appointments: "academic_appointments",
  work_experience: "experience",
  employment: "experience",
  research: "research_interests",
  professional_memberships: "memberships",
  conference_presentations: "conferences",
  memberships: "memberships",
  references: "references",
  declaration: "declaration",
  publications: "publications",
  grants: "grants",
  awards: "awards",
  teaching: "teaching",
  education: "education",
  languages: "languages",
  projects: "projects",
  conferences: "conferences",
  supervision: "supervision",
  patents: "patents",
  invited_talks: "invited_talks",
  academic_service: "academic_service",
  editorial: "editorial",
  certifications: "certifications",
  skills: "skills",
  research_interests: "research_interests",
  research_experience: "research_experience"
};

export function normalizeImportDraft(input: unknown): CvImportDraft {
  const source = asObject(input);
  const rawPersonal = asObject(source.personal ?? source.profile ?? source.personal_info);
  const sectionsSource = asObject(source.sections);
  const sections: Record<string, Record<string, string>[]> = {};
  const warnings = stringArray(source.warnings);
  const unmapped = stringArray(source.unmapped ?? source.unmapped_items);

  const personal: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawPersonal)) {
    const mappedKey = mapPersonalKey(key);
    if (!mappedKey || !personalFieldNames.has(mappedKey)) continue;
    const cleaned = cleanText(value);
    if (cleaned) personal[mappedKey] = cleaned;
  }

  if (!personal.bio) {
    const summary = cleanText(source.summary ?? source.profile_summary ?? rawPersonal.summary);
    if (summary) personal.bio = summary;
  }

  for (const [key, value] of Object.entries(sectionsSource)) {
    const sectionKey = mapSectionKey(key);
    if (!sectionKey) {
      if (Array.isArray(value)) {
        unmapped.push(...value.map((item) => cleanText(item)).filter(Boolean));
      }
      continue;
    }

    const entries = arrayFromUnknown(value)
      .map((item) => cleanSectionEntry(sectionKey, item))
      .filter((item) => Object.values(item).some(Boolean));

    if (entries.length > 0) {
      sections[sectionKey] = [...(sections[sectionKey] ?? []), ...entries].slice(0, 40);
    }
  }

  for (const section of profileSections) {
    const topLevel = source[section.key];
    if (topLevel && !sections[section.key]) {
      const entries = arrayFromUnknown(topLevel)
        .map((item) => cleanSectionEntry(section.key, item))
        .filter((item) => Object.values(item).some(Boolean));
      if (entries.length > 0) sections[section.key] = entries.slice(0, 40);
    }
  }

  return {
    personal,
    sections,
    unmapped: unmapped.slice(0, 30),
    warnings: warnings.slice(0, 30)
  };
}

export function summarizeDraft(rawDraft: unknown) {
  const draft = normalizeImportDraft(rawDraft);
  const sectionCounts = Object.fromEntries(Object.entries(draft.sections).map(([key, entries]) => [key, entries.length]));
  return {
    personalFields: Object.keys(draft.personal).length,
    sectionCounts,
    totalEntries: Object.values(sectionCounts).reduce((sum, count) => sum + count, 0),
    unmappedCount: draft.unmapped.length,
    warnings: draft.warnings
  };
}

export function fingerprintImportEntry(sectionKey: string, data: Record<string, unknown>) {
  const definition = sectionDefinitionByKey(sectionKey);
  const priorityFields =
    {
      publications: ["title", "doi", "year"],
      education: ["degree", "institution", "year_end"],
      experience: ["position", "organization", "year_start"],
      references: ["name", "email", "institution"],
      grants: ["title", "agency", "grant_number"],
      awards: ["title", "organization", "year"],
      declaration: ["statement"],
      languages: ["language", "proficiency"]
    }[sectionKey] ?? [definition?.summaryField ?? "title"];

  const text =
    priorityFields.map((field) => cleanText(data[field])).filter(Boolean).join("|") ||
    Object.values(data).map((value) => cleanText(value)).filter(Boolean).join("|");

  return crypto.createHash("sha256").update(`${sectionKey}:${normalizeComparable(text)}`).digest("hex");
}

export function normalizeImportComparable(value: string) {
  return normalizeComparable(value);
}

function cleanSectionEntry(sectionKey: string, value: unknown) {
  const input = asObject(value);
  const definition = sectionDefinitionByKey(sectionKey);
  const cleaned: Record<string, string> = {};

  for (const field of definition?.fields ?? []) {
    const aliases = fieldAliases(field.name);
    const raw = aliases.map((alias) => input[alias]).find((candidate) => cleanText(candidate));
    const defaultValue = "defaultValue" in field ? field.defaultValue : "";
    cleaned[field.name] = cleanText(raw) || defaultValue || "";
  }

  const firstText = cleanText(value);
  const summaryField = definition?.summaryField;
  if (summaryField && !cleaned[summaryField] && firstText) {
    cleaned[summaryField] = firstText;
  }

  return cleaned;
}

function mapPersonalKey(key: string) {
  const normalized = normalizeKey(key);
  const aliases: Record<string, string> = {
    name: "displayName",
    full_name: "displayName",
    display_name: "displayName",
    title: "headline",
    academic_title: "headline",
    headline: "headline",
    institution: "affiliation",
    university: "affiliation",
    affiliation: "affiliation",
    location: "location",
    email: "email",
    website: "websiteUrl",
    website_url: "websiteUrl",
    google_scholar: "googleScholarUrl",
    google_scholar_url: "googleScholarUrl",
    orcid: "orcidUrl",
    orcid_url: "orcidUrl",
    linkedin: "linkedinUrl",
    linkedin_url: "linkedinUrl",
    bio: "bio",
    short_bio: "bio",
    profile_summary: "bio",
    summary: "bio",
    research_summary: "bio"
  };
  return aliases[normalized] ?? key;
}

function mapSectionKey(key: string) {
  const normalized = normalizeKey(key);
  const aliased = sectionAliases[normalized] ?? normalized;
  return profileSections.some((section) => section.key === aliased) ? aliased : "";
}

function fieldAliases(field: string) {
  const normalized = normalizeKey(field);
  const extras: Record<string, string[]> = {
    degree: ["degree", "qualification", "program"],
    institution: ["institution", "university", "school", "organization"],
    organization: ["organization", "institution", "employer", "company"],
    title: ["title", "name", "publication_title", "award"],
    description: ["description", "details", "summary"],
    year_start: ["year_start", "start_year", "from", "start_date"],
    year_end: ["year_end", "end_year", "to", "end_date"],
    publication_type: ["publication_type", "type"],
    venue: ["venue", "journal", "conference"],
    statement: ["statement", "declaration"]
  };
  return [field, normalized, ...(extras[normalized] ?? [])];
}

function arrayFromUnknown(value: unknown) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  const text = cleanText(value);
  return text ? [text] : [];
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function cleanText(value: unknown) {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 3000);
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeComparable(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
