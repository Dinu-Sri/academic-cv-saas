import type { Prisma } from "@/generated/prisma/client";
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
import {
  appearanceSchema,
  enabledPagesSchema,
  featuredContentSchema,
  fieldVisibilitySchema,
  navigationSchema,
  pageContentSchema,
  sectionVisibilitySchema,
  seoSchema
} from "./schemas";
import { WEBSITE_PAGE_LABELS, WEBSITE_ROOT_DOMAIN, type WebsitePageKey } from "./constants";

type WebsiteRecord = {
  username: string;
  status: string;
  templateKey: string;
  headlineOverride: string;
  pageContentJson: Prisma.JsonValue;
  enabledPagesJson: Prisma.JsonValue;
  navigationJson: Prisma.JsonValue;
  sectionVisibilityJson: Prisma.JsonValue;
  fieldVisibilityJson: Prisma.JsonValue;
  featuredContentJson: Prisma.JsonValue;
  appearanceJson: Prisma.JsonValue;
  seoJson: Prisma.JsonValue;
  contactFormEnabled: boolean;
  searchIndexingEnabled: boolean;
};

type ProfileRecord = {
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
};

type SectionEntry = {
  id: string;
  sectionKey: string;
  data: Record<string, string>;
};

export function parseWebsiteConfig(website: WebsiteRecord) {
  return {
    pageContent: pageContentSchema.parse({ ...defaultPageContent(), ...(asObject(website.pageContentJson) ?? {}) }),
    enabledPages: enabledPagesSchema.parse({ ...defaultEnabledPages(), ...(asObject(website.enabledPagesJson) ?? {}) }),
    navigation: navigationSchema.parse(Array.isArray(website.navigationJson) && website.navigationJson.length ? website.navigationJson : defaultNavigation()),
    sectionVisibility: sectionVisibilitySchema.parse({ ...defaultSectionVisibility(), ...(asObject(website.sectionVisibilityJson) ?? {}) }),
    fieldVisibility: fieldVisibilitySchema.parse({ ...defaultFieldVisibility(), ...(asObject(website.fieldVisibilityJson) ?? {}) }),
    featuredContent: featuredContentSchema.parse({ ...defaultFeaturedContent(), ...(asObject(website.featuredContentJson) ?? {}) }),
    appearance: appearanceSchema.parse({ ...defaultAppearance(), ...(asObject(website.appearanceJson) ?? {}) }),
    seo: seoSchema.parse({ ...defaultSeo(), ...(asObject(website.seoJson) ?? {}) })
  };
}

export function buildWebsitePreviewModel({
  website,
  profile,
  entries
}: {
  website: WebsiteRecord;
  profile: ProfileRecord;
  entries: SectionEntry[];
}) {
  const config = parseWebsiteConfig(website);
  const bySection = groupEntries(entries);
  const displayName = profile.displayName || "Academic Profile";
  const headline = website.headlineOverride.trim() || profile.headline || profile.affiliation || "Academic website";
  const summary = config.pageContent.homeIntro.trim() || profile.researchSummary.trim() || profile.bio.trim();

  const pages = config.navigation
    .filter((key) => config.enabledPages[key] !== false)
    .filter((key) => pageHasContent(key, { profile, bySection, summary, contactEnabled: website.contactFormEnabled }))
    .map((key) => ({
      key,
      label: WEBSITE_PAGE_LABELS[key],
      href: key === "home" ? "/" : `/${key}`
    }));

  return {
    templateKey: website.templateKey || "modern-scholar",
    username: website.username,
    publicUrl: `https://${website.username}.${WEBSITE_ROOT_DOMAIN}`,
    status: website.status,
    identity: {
      displayName,
      headline,
      affiliation: profile.affiliation,
      location: config.fieldVisibility.showLocation ? profile.location : "",
      email: config.fieldVisibility.showEmail ? profile.email : "",
      orcidUrl: config.fieldVisibility.showOrcid ? profile.orcidUrl : "",
      googleScholarUrl: config.fieldVisibility.showGoogleScholar ? profile.googleScholarUrl : "",
      linkedinUrl: config.fieldVisibility.showLinkedIn ? profile.linkedinUrl : ""
    },
    summary,
    pages,
    content: {
      about: config.pageContent.aboutNarrative || profile.bio,
      research: config.pageContent.researchNarrative || profile.researchSummary,
      teaching: config.pageContent.teachingNarrative,
      contactIntro: config.pageContent.contactIntro
    },
    sections: {
      education: config.sectionVisibility.education ? bySection.education ?? [] : [],
      experience: config.sectionVisibility.experience ? bySection.experience ?? [] : [],
      teaching: config.sectionVisibility.teaching ? bySection.teaching ?? [] : [],
      publications: config.sectionVisibility.publications ? bySection.publications ?? [] : [],
      projects: config.sectionVisibility.projects ? bySection.projects ?? [] : [],
      grants: config.sectionVisibility.grants ? bySection.grants ?? [] : [],
      awards: config.sectionVisibility.awards ? bySection.awards ?? [] : [],
      memberships: config.sectionVisibility.memberships ? bySection.memberships ?? [] : [],
      conferences: config.sectionVisibility.conferences ? bySection.conferences ?? [] : [],
      supervision: config.sectionVisibility.supervision ? bySection.supervision ?? [] : []
    },
    fieldVisibility: config.fieldVisibility,
    contactFormEnabled: website.contactFormEnabled,
    searchIndexingEnabled: website.searchIndexingEnabled && config.seo.searchIndexingEnabled,
    seo: {
      title: config.seo.titleOverride || `${displayName} | Academic Website`,
      description: config.seo.descriptionOverride || summary.slice(0, 300) || `${displayName} academic website on CVScholar.`
    },
    config
  };
}

function pageHasContent(
  key: WebsitePageKey,
  context: {
    profile: ProfileRecord;
    bySection: Record<string, SectionEntry[]>;
    summary: string;
    contactEnabled: boolean;
  }
) {
  if (key === "home") return true;
  if (key === "about") return Boolean(context.profile.bio.trim() || context.summary);
  if (key === "research") return Boolean(context.profile.researchSummary.trim() || (context.bySection.projects?.length ?? 0) > 0 || (context.bySection.grants?.length ?? 0) > 0);
  if (key === "publications") return (context.bySection.publications?.length ?? 0) > 0;
  if (key === "teaching") return (context.bySection.teaching?.length ?? 0) > 0;
  if (key === "cv") return true;
  if (key === "contact") return context.contactEnabled;
  return true;
}

function groupEntries(entries: SectionEntry[]) {
  const groups: Record<string, SectionEntry[]> = {};
  for (const entry of entries) {
    if (!groups[entry.sectionKey]) groups[entry.sectionKey] = [];
    groups[entry.sectionKey].push(entry);
  }
  return groups;
}

function asObject(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
