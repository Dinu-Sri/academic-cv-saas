import { z } from "zod";
import type { User } from "@/generated/prisma/client";
import { linesToItems, profileSections } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  headline: z.string().trim().max(200),
  affiliation: z.string().trim().max(200),
  location: z.string().trim().max(160),
  email: z.email().or(z.literal("")),
  websiteUrl: z.url().or(z.literal("")),
  googleScholarUrl: z.url().or(z.literal("")),
  orcidUrl: z.url().or(z.literal("")),
  linkedinUrl: z.url().or(z.literal("")),
  bio: z.string().trim().max(3000),
  researchSummary: z.string().trim().max(3000)
});

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function calculateCompleteness(data: z.infer<typeof profileSchema>, sectionData: { summary: string; items: string[] }[]) {
  const basicFields = [
    data.displayName,
    data.headline,
    data.affiliation,
    data.email,
    data.bio,
    data.researchSummary
  ];
  const basicScore = basicFields.filter(Boolean).length;
  const sectionScore = sectionData.filter((section) => section.summary || section.items.length > 0).length;
  const total = basicFields.length + profileSections.length;

  return Math.round(((basicScore + sectionScore) / total) * 100);
}

export async function saveProfileForUser(user: Pick<User, "id" | "name" | "email">, formData: FormData) {
  const { profile } = await getOrCreateWorkspaceForUser(user);
  const data = profileSchema.parse({
    displayName: getString(formData, "displayName"),
    headline: getString(formData, "headline"),
    affiliation: getString(formData, "affiliation"),
    location: getString(formData, "location"),
    email: getString(formData, "email"),
    websiteUrl: getString(formData, "websiteUrl"),
    googleScholarUrl: getString(formData, "googleScholarUrl"),
    orcidUrl: getString(formData, "orcidUrl"),
    linkedinUrl: getString(formData, "linkedinUrl"),
    bio: getString(formData, "bio"),
    researchSummary: getString(formData, "researchSummary")
  });

  const sectionData = profileSections.map((section) => ({
    ...section,
    summary: getString(formData, `${section.key}Summary`),
    items: linesToItems(getString(formData, `${section.key}Items`))
  }));
  const completeness = calculateCompleteness(data, sectionData);

  await prisma.$transaction([
    prisma.academicProfile.update({
      where: { id: profile.id },
      data: {
        ...data,
        completeness
      }
    }),
    ...sectionData.map((section) =>
      prisma.profileSection.upsert({
        where: {
          profileId_key: {
            profileId: profile.id,
            key: section.key
          }
        },
        update: {
          title: section.title,
          summary: section.summary,
          items: section.items
        },
        create: {
          profileId: profile.id,
          key: section.key,
          title: section.title,
          summary: section.summary,
          items: section.items,
          isVisible: section.defaultVisible
        }
      })
    )
  ]);

  return { completeness };
}
