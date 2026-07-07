import type { User } from "@/generated/prisma/client";
import { entrySummary, personalFields, profileSections, sectionDefinitionByKey } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

type EntryData = Record<string, unknown>;

export function cleanEntryData(sectionKey: string, input: EntryData) {
  const definition = sectionDefinitionByKey(sectionKey);
  const cleaned: Record<string, string> = {};

  for (const field of definition?.fields ?? []) {
    const value = input[field.name];
    const defaultValue = "defaultValue" in field ? field.defaultValue : "";
    cleaned[field.name] = typeof value === "string" ? value.trim() : defaultValue ?? "";
  }

  return cleaned;
}

export function requiredEntryMissing(sectionKey: string, data: EntryData) {
  const definition = sectionDefinitionByKey(sectionKey);

  return (definition?.fields ?? [])
    .filter((field) => "required" in field && field.required)
    .filter((field) => {
      const value = data[field.name];
      return typeof value !== "string" || value.trim() === "";
    })
    .map((field) => field.label);
}

export function calculateProfileCompleteness(profile: EntryData, sections: { isVisible?: boolean; entries: { data: EntryData }[] }[]) {
  const personalScore = personalFields
    .filter((field) => ["displayName", "headline", "affiliation", "email", "bio", "researchSummary"].includes(field.name))
    .filter((field) => {
      const value = profile[field.name];
      return typeof value === "string" && value.trim() !== "";
    }).length;

  const visibleSections = sections.filter((section) => section.isVisible !== false);
  const sectionScore = visibleSections.filter((section) =>
    section.entries.some((entry) =>
      Object.values(entry.data).some((value) => typeof value === "string" && value.trim() !== "")
    )
  ).length;

  return Math.round(((personalScore + sectionScore) / (6 + visibleSections.length)) * 100);
}

export async function ensureProfileEditorData(profileId: string) {
  await ensureProfileSectionsHaveOrder(profileId);
  await migrateLegacyItemsToEntries(profileId);
}

async function ensureProfileSectionsHaveOrder(profileId: string) {
  await Promise.all(
    profileSections.map((section) =>
      prisma.profileSection.upsert({
        where: {
          profileId_key: {
            profileId,
            key: section.key
          }
        },
        update: {
          title: section.title,
          sectionOrder: section.sectionOrder
        },
        create: {
          profileId,
          key: section.key,
          title: section.title,
          sectionOrder: section.sectionOrder,
          isVisible: section.defaultVisible
        }
      })
    )
  );
}

async function migrateLegacyItemsToEntries(profileId: string) {
  const sections = await prisma.profileSection.findMany({
    where: { profileId },
    include: { entries: true }
  });

  for (const section of sections) {
    if (section.entries.length > 0 || !Array.isArray(section.items) || section.items.length === 0) {
      continue;
    }

    const definition = sectionDefinitionByKey(section.key);
    const summaryField = definition?.summaryField ?? "title";
    const entries = section.items
      .filter((item): item is string => typeof item === "string" && item.trim() !== "")
      .map((item, index) =>
        prisma.profileSectionEntry.create({
          data: {
            profileId,
            sectionId: section.id,
            sectionKey: section.key,
            entryOrder: index + 1,
            source: "legacy_items",
            data: cleanEntryData(section.key, { [summaryField]: item })
          }
        })
      );

    if (entries.length > 0) {
      await prisma.$transaction(entries);
    }
  }
}

export async function getProfileEditor(user: Pick<User, "id" | "name" | "email">) {
  const { workspace, profile } = await getOrCreateWorkspaceForUser(user);
  await ensureProfileEditorData(profile.id);

  const [freshProfile, sections, document, renderJob] = await Promise.all([
    prisma.academicProfile.findUniqueOrThrow({
      where: { id: profile.id }
    }),
    prisma.profileSection.findMany({
      where: { profileId: profile.id },
      include: {
        entries: {
          orderBy: { entryOrder: "asc" }
        }
      },
      orderBy: { sectionOrder: "asc" }
    }),
    prisma.cvDocument.findFirst({
      where: { profileId: profile.id },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.pdfRenderJob.findFirst({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return { workspace, profile: freshProfile, sections, document, renderJob };
}

export async function refreshCompleteness(profileId: string) {
  const [profile, sections] = await Promise.all([
    prisma.academicProfile.findUniqueOrThrow({ where: { id: profileId } }),
    prisma.profileSection.findMany({
      where: { profileId },
      include: { entries: true }
    })
  ]);

  const completeness = calculateProfileCompleteness(profile as unknown as EntryData, sections as { isVisible: boolean; entries: { data: EntryData }[] }[]);

  await prisma.academicProfile.update({
    where: { id: profileId },
    data: { completeness }
  });

  return completeness;
}

export async function buildCvSnapshot(profileId: string, visibleSectionKeys?: string[]) {
  const sectionFilter =
    visibleSectionKeys && visibleSectionKeys.length > 0
      ? { profileId, key: { in: visibleSectionKeys } }
      : { profileId, isVisible: true };

  const [profile, sections] = await Promise.all([
    prisma.academicProfile.findUniqueOrThrow({ where: { id: profileId } }),
    prisma.profileSection.findMany({
      where: sectionFilter,
      include: {
        entries: {
          where: { isVisible: true },
          orderBy: { entryOrder: "asc" }
        }
      },
      orderBy: { sectionOrder: "asc" }
    })
  ]);

  return {
    profile,
    sections: sections.map((section) => ({
      key: section.key,
      title: section.title,
      entries: section.entries.map((entry) => ({
        id: entry.id,
        summary: entrySummary(section.key, entry.data as EntryData),
        data: entry.data
      }))
    }))
  };
}

export function buildPreviewHtml(snapshot: Awaited<ReturnType<typeof buildCvSnapshot>>) {
  const profile = snapshot.profile;
  const sectionHtml = snapshot.sections
    .filter((section) => section.entries.length > 0)
    .map((section) => {
      const entries = section.entries
        .map((entry) => `<li><strong>${escapeHtml(entry.summary)}</strong>${entryDetail(entry.data as EntryData)}</li>`)
        .join("");

      return `<section><h2>${escapeHtml(section.title)}</h2><ul>${entries}</ul></section>`;
    })
    .join("");

  return [
    `<article class="cv-preview-document">`,
    `<header><h1>${escapeHtml(profile.displayName || "Academic CV")}</h1>`,
    `<p>${escapeHtml(profile.headline || profile.affiliation || "")}</p>`,
    `<small>${escapeHtml([profile.email, profile.location].filter(Boolean).join(" • "))}</small></header>`,
    profile.bio ? `<section><h2>Profile</h2><p>${escapeHtml(profile.bio)}</p></section>` : "",
    profile.researchSummary ? `<section><h2>Research Summary</h2><p>${escapeHtml(profile.researchSummary)}</p></section>` : "",
    sectionHtml || `<section><p>Add profile entries, then compile again to preview your CV.</p></section>`,
    `</article>`
  ].join("");
}

function entryDetail(data: EntryData) {
  const parts = Object.entries(data)
    .filter(([, value]) => typeof value === "string" && value.trim() !== "")
    .slice(1, 4)
    .map(([, value]) => escapeHtml(String(value)));

  return parts.length > 0 ? `<span>${parts.join(" · ")}</span>` : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
