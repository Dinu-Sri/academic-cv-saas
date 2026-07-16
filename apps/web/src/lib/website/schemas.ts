import { z } from "zod";
import { WEBSITE_PAGE_KEYS } from "./constants";

export const websitePageKeySchema = z.enum(WEBSITE_PAGE_KEYS);

export const enabledPagesSchema = z.record(websitePageKeySchema, z.boolean());
export const navigationSchema = z.array(websitePageKeySchema).min(1).max(12);

export const fieldVisibilitySchema = z.object({
  showEmail: z.boolean().default(false),
  showPhone: z.boolean().default(false),
  showLocation: z.boolean().default(false),
  showReferences: z.boolean().default(false),
  showLinkedIn: z.boolean().default(true),
  showOrcid: z.boolean().default(true),
  showGoogleScholar: z.boolean().default(true)
});

export const sectionVisibilitySchema = z.object({
  researchInterests: z.boolean().default(true),
  education: z.boolean().default(true),
  experience: z.boolean().default(true),
  teaching: z.boolean().default(true),
  supervision: z.boolean().default(true),
  publications: z.boolean().default(true),
  projects: z.boolean().default(true),
  grants: z.boolean().default(true),
  awards: z.boolean().default(true),
  memberships: z.boolean().default(true),
  conferences: z.boolean().default(true),
  skills: z.boolean().default(false),
  languages: z.boolean().default(false)
});

export const appearanceSchema = z.object({
  templateKey: z.string().default("modern-scholar"),
  accent: z.string().default("academic-blue"),
  profileImageAssetId: z.string().nullable().optional(),
  showProfileImage: z.boolean().default(true)
});

export const seoSchema = z.object({
  titleOverride: z.string().max(160).default(""),
  descriptionOverride: z.string().max(320).default(""),
  searchIndexingEnabled: z.boolean().default(true),
  socialImageAssetId: z.string().nullable().optional()
});

export const pageContentSchema = z.object({
  homeIntro: z.string().max(4000).default(""),
  aboutNarrative: z.string().max(8000).default(""),
  researchNarrative: z.string().max(8000).default(""),
  teachingNarrative: z.string().max(8000).default(""),
  contactIntro: z.string().max(2000).default("")
});

export const featuredContentSchema = z.object({
  featuredPublicationIds: z.array(z.string()).max(20).default([]),
  featuredProjectIds: z.array(z.string()).max(20).default([]),
  featuredTeachingIds: z.array(z.string()).max(20).default([])
});

export const createWebsiteSchema = z.object({
  username: z.string().min(1).max(80)
});

export const updateWebsiteDraftSchema = z.object({
  expectedVersion: z.number().int().positive(),
  headlineOverride: z.string().max(240).optional(),
  pageContent: pageContentSchema.partial().optional(),
  enabledPages: enabledPagesSchema.optional(),
  navigation: navigationSchema.optional(),
  sectionVisibility: sectionVisibilitySchema.partial().optional(),
  fieldVisibility: fieldVisibilitySchema.partial().optional(),
  featuredContent: featuredContentSchema.partial().optional(),
  appearance: appearanceSchema.partial().optional(),
  seo: seoSchema.partial().optional(),
  sourceCvDocumentId: z.string().nullable().optional(),
  contactFormEnabled: z.boolean().optional(),
  searchIndexingEnabled: z.boolean().optional()
});

export type UpdateWebsiteDraftInput = z.infer<typeof updateWebsiteDraftSchema>;
