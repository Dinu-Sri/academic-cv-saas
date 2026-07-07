import crypto from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { calculateProfileCompleteness } from "@/lib/profile-editor";
import { personalFields, profileSections, sectionDefinitionByKey } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";

export type CvImportDraft = {
  personal: Record<string, string>;
  sections: Record<string, Record<string, string>[]>;
  unmapped: string[];
  warnings: string[];
};

export type CvImportReview = {
  sectionsFound: { key: string; title: string; count: number }[];
  newItems: number;
  skippedDuplicates: number;
  conflicts: { field: string; label: string; current: string; incoming: string }[];
  fillablePersonalFields: { field: string; label: string; incoming: string }[];
  unmappedCount: number;
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
  research_interests: "research_interests",
  research_experience: "research_experience",
  conferences: "conferences",
  conference_presentations: "conferences",
  professional_memberships: "memberships",
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
  supervision: "supervision",
  patents: "patents",
  invited_talks: "invited_talks",
  academic_service: "academic_service",
  editorial: "editorial",
  certifications: "certifications",
  skills: "skills"
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

export async function buildCvImportReview(profileId: string, rawDraft: unknown): Promise<CvImportReview> {
  const draft = normalizeImportDraft(rawDraft);
  const [profile, entries] = await Promise.all([
    prisma.academicProfile.findUniqueOrThrow({ where: { id: profileId } }),
    prisma.profileSectionEntry.findMany({ where: { profileId } })
  ]);

  return reviewAgainstExisting(profile as unknown as Record<string, unknown>, entries, draft);
}

export async function applyCvImportJob(jobId: string, profileId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.cvImportJob.findFirst({
      where: {
        id: jobId,
        profileId,
        status: "ready",
        appliedAt: null
      }
    });

    if (!job) {
      throw new Error("Import job is not ready to apply.");
    }

    const draft = normalizeImportDraft(job.draftJson);
    const [profile, sections, existingEntries] = await Promise.all([
      tx.academicProfile.findUniqueOrThrow({ where: { id: profileId } }),
      tx.profileSection.findMany({ where: { profileId }, include: { entries: true } }),
      tx.profileSectionEntry.findMany({ where: { profileId } })
    ]);
    const review = reviewAgainstExisting(profile as unknown as Record<string, unknown>, existingEntries, draft);
    const personalUpdates: Record<string, string> = {};

    for (const item of review.fillablePersonalFields) {
      personalUpdates[item.field] = item.incoming;
    }

    if (Object.keys(personalUpdates).length > 0) {
      await tx.academicProfile.update({
        where: { id: profileId },
        data: personalUpdates
      });
    }

    let addedEntries = 0;
    const sectionsByKey = new Map(sections.map((section) => [section.key, section]));

    for (const [sectionKey, importedEntries] of Object.entries(draft.sections)) {
      const definition = sectionDefinitionByKey(sectionKey);
      if (!definition || importedEntries.length === 0) continue;

      const section =
        sectionsByKey.get(sectionKey) ??
        (await tx.profileSection.create({
          data: {
            profileId,
            key: sectionKey,
            title: definition.title,
            sectionOrder: definition.sectionOrder,
            isVisible: true
          },
          include: { entries: true }
        }));

      if (!section.isVisible) {
        await tx.profileSection.update({
          where: { id: section.id },
          data: { isVisible: true }
        });
      }

      const existingFingerprints = new Set(
        (await tx.profileSectionEntry.findMany({ where: { profileId, sectionKey } })).map((entry) =>
          fingerprintEntry(sectionKey, entry.data as Record<string, unknown>)
        )
      );
      let nextOrder = section.entries.length + 1;

      for (const entry of importedEntries) {
        const fingerprint = fingerprintEntry(sectionKey, entry);
        if (existingFingerprints.has(fingerprint)) continue;

        await tx.profileSectionEntry.create({
          data: {
            profileId,
            sectionId: section.id,
            sectionKey,
            entryOrder: nextOrder,
            data: entry as Prisma.InputJsonObject,
            source: "old_cv_import"
          }
        });
        nextOrder += 1;
        addedEntries += 1;
        existingFingerprints.add(fingerprint);
      }
    }

    const mergeResult = {
      addedEntries,
      filledPersonalFields: review.fillablePersonalFields.length,
      skippedDuplicates: review.skippedDuplicates,
      conflicts: review.conflicts.length,
      unmappedCount: review.unmappedCount
    };

    await tx.cvImportJob.update({
      where: { id: job.id },
      data: {
        status: "applied",
        stage: "applied",
        message: "Imported CV data applied.",
        mergeResult,
        appliedAt: new Date()
      }
    });

    return mergeResult;
  });

  await refreshCompletenessAfterImport(profileId);
  return result;
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

function reviewAgainstExisting(
  profile: Record<string, unknown>,
  entries: { sectionKey: string; data: unknown }[],
  draft: CvImportDraft
): CvImportReview {
  const fillablePersonalFields: CvImportReview["fillablePersonalFields"] = [];
  const conflicts: CvImportReview["conflicts"] = [];
  const skippedPersonal = { count: 0 };

  for (const [field, incoming] of Object.entries(draft.personal)) {
    const definition = personalFields.find((item) => item.name === field);
    const current = cleanText(profile[field]);
    if (!incoming) continue;
    if (!current) {
      fillablePersonalFields.push({ field, label: definition?.label ?? field, incoming });
      continue;
    }
    if (normalizeComparable(current) === normalizeComparable(incoming)) {
      skippedPersonal.count += 1;
      continue;
    }
    conflicts.push({ field, label: definition?.label ?? field, current, incoming });
  }

  const existingBySection = new Map<string, Set<string>>();
  for (const entry of entries) {
    const set = existingBySection.get(entry.sectionKey) ?? new Set<string>();
    set.add(fingerprintEntry(entry.sectionKey, entry.data as Record<string, unknown>));
    existingBySection.set(entry.sectionKey, set);
  }

  let newItems = 0;
  let skippedDuplicates = skippedPersonal.count;
  const sectionsFound: CvImportReview["sectionsFound"] = [];

  for (const [sectionKey, importedEntries] of Object.entries(draft.sections)) {
    const definition = sectionDefinitionByKey(sectionKey);
    if (!definition || importedEntries.length === 0) continue;

    sectionsFound.push({ key: sectionKey, title: definition.title, count: importedEntries.length });
    const existing = existingBySection.get(sectionKey) ?? new Set<string>();

    for (const entry of importedEntries) {
      const fingerprint = fingerprintEntry(sectionKey, entry);
      if (existing.has(fingerprint)) {
        skippedDuplicates += 1;
      } else {
        newItems += 1;
      }
    }
  }

  return {
    sectionsFound,
    newItems,
    skippedDuplicates,
    conflicts,
    fillablePersonalFields,
    unmappedCount: draft.unmapped.length,
    warnings: draft.warnings
  };
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

function fingerprintEntry(sectionKey: string, data: Record<string, unknown>) {
  const definition = sectionDefinitionByKey(sectionKey);
  const priorityFields = {
    publications: ["title", "doi", "year"],
    education: ["degree", "institution", "year_end"],
    experience: ["position", "organization", "year_start"],
    references: ["name", "email", "institution"],
    grants: ["title", "agency", "grant_number"],
    awards: ["title", "organization", "year"],
    declaration: ["statement"],
    languages: ["language", "proficiency"]
  }[sectionKey] ?? [definition?.summaryField ?? "title"];

  const text = priorityFields
    .map((field) => cleanText(data[field]))
    .filter(Boolean)
    .join("|") || Object.values(data).map((value) => cleanText(value)).filter(Boolean).join("|");

  return crypto.createHash("sha256").update(`${sectionKey}:${normalizeComparable(text)}`).digest("hex");
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

async function refreshCompletenessAfterImport(profileId: string) {
  const [profile, sections] = await Promise.all([
    prisma.academicProfile.findUniqueOrThrow({ where: { id: profileId } }),
    prisma.profileSection.findMany({ where: { profileId }, include: { entries: true } })
  ]);
  const completeness = calculateProfileCompleteness(
    profile as unknown as Record<string, unknown>,
    sections.map((section) => ({
      isVisible: section.isVisible,
      entries: section.entries.map((entry) => ({ data: asObject(entry.data) }))
    }))
  );
  await prisma.academicProfile.update({ where: { id: profileId }, data: { completeness } });
}
