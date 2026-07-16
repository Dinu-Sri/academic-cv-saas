import type { Prisma, User } from "@/generated/prisma/client";
import { ensureProfileEditorData } from "@/lib/profile-editor";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import { websiteFeatureEnabled, WEBSITE_ROOT_DOMAIN, WEBSITE_TEMPLATE_KEY } from "./constants";
import { buildWebsitePreviewModel, parseWebsiteConfig } from "./data-builder";
import {
  defaultAppearance,
  defaultEnabledPages,
  defaultFeaturedContent,
  defaultFieldVisibility,
  defaultNavigation,
  defaultPageContent,
  defaultSectionVisibility,
  defaultSeo
} from "./defaults";
import { assessWebsiteReadiness } from "./readiness";
import type { UpdateWebsiteDraftInput } from "./schemas";
import { checkWebsiteUsernameAvailability, normalizeWebsiteUsername, validateWebsiteUsernameFormat } from "./username";

export async function getWebsiteWorkspaceForUser(user: Pick<User, "id" | "name" | "email">) {
  if (!websiteFeatureEnabled()) {
    return { enabled: false as const, reason: "Website feature is disabled." };
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(user);
  await ensureProfileEditorData(profile.id);

  const [website, entries, cvDocuments] = await Promise.all([
    prisma.academicWebsite.findUnique({ where: { profileId: profile.id } }),
    prisma.profileSectionEntry.findMany({
      where: { profileId: profile.id, archivedAt: null },
      orderBy: { entryOrder: "asc" },
      select: { id: true, sectionKey: true, data: true }
    }),
    prisma.cvDocument.findMany({
      where: { profileId: profile.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, templateKey: true, updatedAt: true }
    })
  ]);

  const sectionCounts = countSections(entries);
  const readiness = assessWebsiteReadiness(profile, sectionCounts);
  const serializedCvDocuments = cvDocuments.map((document) => ({
    id: document.id,
    title: document.title,
    templateKey: document.templateKey,
    updatedAt: document.updatedAt.toISOString()
  }));

  if (!website) {
    return {
      enabled: true as const,
      state: "not_created" as const,
      workspaceId: workspace.id,
      profile: serializeProfile(profile),
      readiness,
      rootDomain: WEBSITE_ROOT_DOMAIN,
      cvDocuments: serializedCvDocuments
    };
  }

  const config = parseWebsiteConfig(website);
  const preview = buildWebsitePreviewModel({
    website,
    profile,
    entries: entries.map((entry) => ({
      id: entry.id,
      sectionKey: entry.sectionKey,
      data: (entry.data ?? {}) as Record<string, string>
    }))
  });

  return {
    enabled: true as const,
    state: website.status === "published" ? ("published" as const) : ("draft_ready" as const),
    workspaceId: workspace.id,
    profile: serializeProfile(profile),
    readiness,
    rootDomain: WEBSITE_ROOT_DOMAIN,
    cvDocuments: serializedCvDocuments,
    website: serializeWebsite(website),
    config,
    preview
  };
}

export async function createWebsiteDraftForUser(user: Pick<User, "id" | "name" | "email">, usernameInput: string) {
  if (!websiteFeatureEnabled()) throw new Error("Website feature is disabled.");

  const { workspace, profile } = await getOrCreateWorkspaceForUser(user);
  const existing = await prisma.academicWebsite.findUnique({ where: { profileId: profile.id } });
  if (existing) {
    return existing;
  }

  const availability = await checkWebsiteUsernameAvailability(usernameInput);
  if (!availability.valid || !availability.available) {
    const error = new Error(availability.reason === "taken" ? "That website address is already taken." : "That website address is not valid.");
    (error as Error & { status?: number; payload?: unknown }).status = availability.reason === "taken" ? 409 : 422;
    (error as Error & { status?: number; payload?: unknown }).payload = availability;
    throw error;
  }

  const username = availability.normalized;
  try {
    return await prisma.academicWebsite.create({
      data: {
        workspaceId: workspace.id,
        profileId: profile.id,
        username,
        status: "draft",
        templateKey: WEBSITE_TEMPLATE_KEY,
        headlineOverride: profile.headline || "",
        pageContentJson: defaultPageContent() as unknown as Prisma.InputJsonValue,
        enabledPagesJson: defaultEnabledPages() as unknown as Prisma.InputJsonValue,
        navigationJson: defaultNavigation() as unknown as Prisma.InputJsonValue,
        sectionVisibilityJson: defaultSectionVisibility() as unknown as Prisma.InputJsonValue,
        fieldVisibilityJson: defaultFieldVisibility() as unknown as Prisma.InputJsonValue,
        featuredContentJson: defaultFeaturedContent() as unknown as Prisma.InputJsonValue,
        appearanceJson: defaultAppearance() as unknown as Prisma.InputJsonValue,
        seoJson: defaultSeo() as unknown as Prisma.InputJsonValue,
        draftSourceVersion: profile.version,
        version: 1,
        revisions: {
          create: {
            workspaceId: workspace.id,
            profileId: profile.id,
            action: "create_draft",
            targetField: "username",
            beforeJson: {},
            afterJson: { username },
            createdBy: user.id
          }
        }
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const conflict = new Error("That website address was just claimed. Please choose another.");
      (conflict as Error & { status?: number }).status = 409;
      throw conflict;
    }
    throw error;
  }
}

export async function updateWebsiteDraftForUser(
  user: Pick<User, "id" | "name" | "email">,
  input: UpdateWebsiteDraftInput
) {
  if (!websiteFeatureEnabled()) throw new Error("Website feature is disabled.");

  const { workspace, profile } = await getOrCreateWorkspaceForUser(user);
  const website = await prisma.academicWebsite.findUnique({ where: { profileId: profile.id } });
  if (!website || website.workspaceId !== workspace.id) {
    throw Object.assign(new Error("Website draft not found."), { status: 404 });
  }
  if (website.version !== input.expectedVersion) {
    throw Object.assign(new Error("This website draft changed elsewhere. Refresh and try again."), { status: 409 });
  }

  const current = parseWebsiteConfig(website);
  const nextPageContent = { ...current.pageContent, ...(input.pageContent ?? {}) };
  const nextEnabledPages = { ...current.enabledPages, ...(input.enabledPages ?? {}) };
  const nextNavigation = input.navigation ?? current.navigation;
  const nextSectionVisibility = { ...current.sectionVisibility, ...(input.sectionVisibility ?? {}) };
  const nextFieldVisibility = { ...current.fieldVisibility, ...(input.fieldVisibility ?? {}) };
  const nextFeatured = { ...current.featuredContent, ...(input.featuredContent ?? {}) };
  const nextAppearance = { ...current.appearance, ...(input.appearance ?? {}) };
  const nextSeo = { ...current.seo, ...(input.seo ?? {}) };

  if (input.sourceCvDocumentId) {
    const document = await prisma.cvDocument.findFirst({
      where: { id: input.sourceCvDocumentId, profileId: profile.id },
      select: { id: true }
    });
    if (!document) {
      throw Object.assign(new Error("Selected CV document was not found."), { status: 422 });
    }
  }

  const updated = await prisma.academicWebsite.update({
    where: { id: website.id },
    data: {
      headlineOverride: input.headlineOverride ?? website.headlineOverride,
      pageContentJson: nextPageContent as unknown as Prisma.InputJsonValue,
      enabledPagesJson: nextEnabledPages as unknown as Prisma.InputJsonValue,
      navigationJson: nextNavigation as unknown as Prisma.InputJsonValue,
      sectionVisibilityJson: nextSectionVisibility as unknown as Prisma.InputJsonValue,
      fieldVisibilityJson: nextFieldVisibility as unknown as Prisma.InputJsonValue,
      featuredContentJson: nextFeatured as unknown as Prisma.InputJsonValue,
      appearanceJson: nextAppearance as unknown as Prisma.InputJsonValue,
      seoJson: nextSeo as unknown as Prisma.InputJsonValue,
      sourceCvDocumentId: input.sourceCvDocumentId === undefined ? website.sourceCvDocumentId : input.sourceCvDocumentId,
      contactFormEnabled: input.contactFormEnabled ?? website.contactFormEnabled,
      searchIndexingEnabled: input.searchIndexingEnabled ?? website.searchIndexingEnabled,
      version: { increment: 1 },
      draftSourceVersion: profile.version,
      revisions: {
        create: {
          workspaceId: workspace.id,
          profileId: profile.id,
          action: "update_draft",
          targetField: "draft",
          beforeJson: { version: website.version },
          afterJson: { version: website.version + 1 },
          createdBy: user.id
        }
      }
    }
  });

  return updated;
}

export async function getWebsitePreviewForUser(user: Pick<User, "id" | "name" | "email">) {
  const payload = await getWebsiteWorkspaceForUser(user);
  if (!payload.enabled || payload.state === "not_created" || !("preview" in payload)) {
    throw Object.assign(new Error("Create a website draft before previewing."), { status: 404 });
  }
  return payload.preview;
}

export function websitePublicHostHint(username: string) {
  const normalized = normalizeWebsiteUsername(username);
  const format = validateWebsiteUsernameFormat(normalized);
  if (!format.valid) return null;
  return `${normalized}.${WEBSITE_ROOT_DOMAIN}`;
}

function serializeWebsite(website: {
  id: string;
  username: string;
  status: string;
  templateKey: string;
  headlineOverride: string;
  sourceCvDocumentId: string | null;
  version: number;
  contactFormEnabled: boolean;
  searchIndexingEnabled: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  return {
    id: website.id,
    username: website.username,
    status: website.status,
    templateKey: website.templateKey,
    headlineOverride: website.headlineOverride,
    sourceCvDocumentId: website.sourceCvDocumentId,
    version: website.version,
    contactFormEnabled: website.contactFormEnabled,
    searchIndexingEnabled: website.searchIndexingEnabled,
    publicUrl: `https://${website.username}.${WEBSITE_ROOT_DOMAIN}`,
    publishedAt: website.publishedAt?.toISOString() ?? null,
    updatedAt: website.updatedAt.toISOString(),
    createdAt: website.createdAt.toISOString()
  };
}

function serializeProfile(profile: {
  id: string;
  displayName: string;
  headline: string;
  affiliation: string;
  location: string;
  email: string;
  websiteUrl: string;
  googleScholarUrl: string;
  orcidUrl: string;
  linkedinUrl: string;
  bio: string;
  researchSummary: string;
  completeness: number;
  version: number;
}) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    headline: profile.headline,
    affiliation: profile.affiliation,
    location: profile.location,
    email: profile.email,
    websiteUrl: profile.websiteUrl,
    googleScholarUrl: profile.googleScholarUrl,
    orcidUrl: profile.orcidUrl,
    linkedinUrl: profile.linkedinUrl,
    bio: profile.bio,
    researchSummary: profile.researchSummary,
    completeness: profile.completeness,
    version: profile.version
  };
}

function countSections(entries: { sectionKey: string }[]) {
  const counts = {
    publications: 0,
    education: 0,
    experience: 0,
    teaching: 0
  };
  for (const entry of entries) {
    if (entry.sectionKey in counts) {
      counts[entry.sectionKey as keyof typeof counts] += 1;
    }
  }
  return counts;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002");
}
