import { WEBSITE_PAGE_KEYS, WEBSITE_TEMPLATE_KEY } from "./constants";

export function defaultEnabledPages() {
  return Object.fromEntries(WEBSITE_PAGE_KEYS.map((key) => [key, true])) as Record<(typeof WEBSITE_PAGE_KEYS)[number], boolean>;
}

export function defaultNavigation() {
  return [...WEBSITE_PAGE_KEYS];
}

export function defaultFieldVisibility() {
  return {
    showEmail: false,
    showPhone: false,
    showLocation: false,
    showReferences: false,
    showLinkedIn: true,
    showOrcid: true,
    showGoogleScholar: true,
    showCvDownload: false
  };
}

export function defaultSectionVisibility() {
  return {
    researchInterests: true,
    researchExperience: true,
    education: true,
    experience: true,
    academicAppointments: true,
    teaching: true,
    supervision: true,
    publications: true,
    projects: true,
    grants: true,
    awards: true,
    memberships: true,
    conferences: true,
    patents: true,
    invitedTalks: true,
    academicService: true,
    editorial: true,
    certifications: true,
    skills: false,
    languages: false
  };
}

export function defaultAppearance() {
  return {
    templateKey: WEBSITE_TEMPLATE_KEY,
    accent: "mineral-blue",
    profileImageAssetId: null as string | null,
    showProfileImage: true
  };
}

export function defaultSeo() {
  return {
    titleOverride: "",
    descriptionOverride: "",
    searchIndexingEnabled: true,
    socialImageAssetId: null as string | null
  };
}

export function defaultPageContent() {
  return {
    homeIntro: "",
    researchNarrative: "",
    journeyNarrative: "",
    contributionsNarrative: "",
    contactIntro: ""
  };
}

export function defaultFeaturedContent() {
  return {
    featuredPublicationIds: [] as string[],
    featuredProjectIds: [] as string[],
    featuredTeachingIds: [] as string[],
    featuredEntryIds: [] as string[]
  };
}
