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
import { WEBSITE_PAGE_KEYS, WEBSITE_PAGE_LABELS, WEBSITE_ROOT_DOMAIN, type WebsitePageKey } from "./constants";
import { composeAcademicWebsite } from "./composition-engine";
import { WEBSITE_SECTION_REGISTRY } from "./section-registry";

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
  sourceCvDocumentId?: string | null;
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
  const rawPageContent = asObject(website.pageContentJson) ?? {};
  const rawEnabledPages = asObject(website.enabledPagesJson) ?? {};
  return {
    pageContent: pageContentSchema.parse({
      ...defaultPageContent(),
      ...rawPageContent,
      journeyNarrative:
        stringValue(rawPageContent.journeyNarrative) ||
        stringValue(rawPageContent.aboutNarrative) ||
        stringValue(rawPageContent.teachingNarrative),
      contributionsNarrative: stringValue(rawPageContent.contributionsNarrative)
    }),
    enabledPages: enabledPagesSchema.parse(normalizeEnabledPages(rawEnabledPages)),
    navigation: navigationSchema.parse(normalizeNavigation(website.navigationJson)),
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

  const visibleEntries = WEBSITE_SECTION_REGISTRY.flatMap((definition) =>
    config.sectionVisibility[definition.visibilityKey as keyof typeof config.sectionVisibility] === false
      ? []
      : bySection[definition.key] ?? []
  );
  const featuredEntryIds = [
    ...config.featuredContent.featuredEntryIds,
    ...config.featuredContent.featuredPublicationIds,
    ...config.featuredContent.featuredProjectIds,
    ...config.featuredContent.featuredTeachingIds
  ];
  const composition = composeAcademicWebsite({
    entries: visibleEntries,
    narratives: {
      research: config.pageContent.researchNarrative || profile.researchSummary,
      journey: config.pageContent.journeyNarrative || profile.bio,
      contributions: config.pageContent.contributionsNarrative
    },
    sectionVisibility: config.sectionVisibility,
    enabledPages: config.enabledPages,
    featuredEntryIds,
    contactEnabled: website.contactFormEnabled
  });

  const pages = composition.navigation.map((key) => ({
      key,
      label: WEBSITE_PAGE_LABELS[key],
      href: key === "home" ? "/" : `/${key}`
    }));

  const sections = Object.fromEntries(
    WEBSITE_SECTION_REGISTRY.map((definition) => [
      definition.key,
      config.sectionVisibility[definition.visibilityKey as keyof typeof config.sectionVisibility] === false
        ? []
        : bySection[definition.key] ?? []
    ])
  );

  return {
    templateKey: website.templateKey || "scholar-pages",
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
      research: config.pageContent.researchNarrative || profile.researchSummary,
      journey: config.pageContent.journeyNarrative || profile.bio,
      contributions: config.pageContent.contributionsNarrative,
      contactIntro: config.pageContent.contactIntro
    },
    sections,
    composition,
    fieldVisibility: config.fieldVisibility,
    contactFormEnabled: website.contactFormEnabled,
    cvDownloadUrl:
      config.fieldVisibility.showCvDownload && website.sourceCvDocumentId
        ? `/api/public-sites/${encodeURIComponent(website.username)}/cv`
        : "",
    searchIndexingEnabled: website.searchIndexingEnabled && config.seo.searchIndexingEnabled,
    seo: {
      title: config.seo.titleOverride || `${displayName} | Academic Website`,
      description: config.seo.descriptionOverride || summary.slice(0, 300) || `${displayName} academic website on CVScholar.`
    },
    config
  };
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

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeEnabledPages(raw: Record<string, unknown>) {
  const defaults = defaultEnabledPages();
  const journeyLegacy = [raw.about, raw.teaching, raw.cv].some((value) => value !== false);
  const researchLegacy = raw.research !== false || raw.publications !== false;
  return {
    ...defaults,
    home: booleanValue(raw.home, true),
    research: booleanValue(raw.research, researchLegacy),
    journey: booleanValue(raw.journey, journeyLegacy),
    contributions: booleanValue(raw.contributions, true),
    contact: booleanValue(raw.contact, true)
  };
}

function normalizeNavigation(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return defaultNavigation();
  const aliases: Record<string, WebsitePageKey> = {
    home: "home",
    about: "journey",
    research: "research",
    publications: "research",
    teaching: "journey",
    cv: "journey",
    journey: "journey",
    contributions: "contributions",
    contact: "contact"
  };
  const normalized = value
    .map((key) => (typeof key === "string" ? aliases[key] : undefined))
    .filter((key): key is WebsitePageKey => Boolean(key));
  for (const key of WEBSITE_PAGE_KEYS) {
    if (!normalized.includes(key)) normalized.push(key);
  }
  return [...new Set(normalized)];
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
