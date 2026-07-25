import type { WebsitePageKey } from "../constants";
import type { AcademicCategoryKey, WebsiteComposition } from "../composition-types";

/** Bump when IR shape breaks consumers. */
export const SITE_IR_VERSION = 1 as const;

/** Bump when qualify/merge/highlight policy changes. */
export const SITE_POLICY_VERSION = 1 as const;

/** Default theme; more themes can register later. */
export const DEFAULT_SITE_THEME_ID = "paper-academic-v1" as const;

export type SiteThemeId = typeof DEFAULT_SITE_THEME_ID | (string & {});

export type SiteMode = "sparse" | "developing" | "rich";

export type SiteBlockType =
  | "identity_hero"
  | "details_panel"
  | "metric_band"
  | "highlight_list"
  | "section_module"
  | "sparse_contact_cta"
  | "contact_page"
  | "legal_doc";

export type SiteMetricItem = { label: string; value: number };

export type SiteHighlightItem = {
  label: string;
  title: string;
  meta: string;
  sectionKey: string;
  entryId: string;
};

export type SiteSectionEntry = {
  id: string;
  data: Record<string, string>;
};

export type SiteSectionModule = {
  key: string;
  label: string;
  category: AcademicCategoryKey;
  entries: SiteSectionEntry[];
  /** presentation enum — renderer chooses layout */
  presentation: "publication_list" | "row_list" | "chip_list" | "chip_and_rows";
};

export type SiteIdentity = {
  displayName: string;
  headline: string;
  affiliation: string;
  location: string;
  email: string;
  orcidUrl: string;
  googleScholarUrl: string;
  linkedinUrl: string;
  summary?: string;
  photoUrl?: string;
};

export type SiteNavItem = {
  key: WebsitePageKey | string;
  label: string;
  href: string;
};

/** Discriminated blocks — renderer may only draw these. */
export type SiteBlock =
  | {
      type: "identity_hero";
      id: string;
      props: {
        identity: SiteIdentity;
        heroMode: "details_panel" | "identity_only" | "with_photo";
        primaryCta?: { label: string; href: string };
        secondaryCtas: { label: string; href: string }[];
        cvHref?: string;
      };
    }
  | {
      type: "details_panel";
      id: string;
      props: {
        location?: string;
        email?: string;
        links: { label: string; href: string }[];
      };
    }
  | {
      type: "metric_band";
      id: string;
      props: { items: SiteMetricItem[] };
    }
  | {
      type: "highlight_list";
      id: string;
      props: { items: SiteHighlightItem[] };
    }
  | {
      type: "section_module";
      id: string;
      props: { module: SiteSectionModule; headingLevel: "h1" | "h2" };
    }
  | {
      type: "sparse_contact_cta";
      id: string;
      props: { intro: string; href: string };
    }
  | {
      type: "contact_page";
      id: string;
      props: {
        intro: string;
        identity: Pick<SiteIdentity, "displayName" | "affiliation" | "location" | "email">;
        formEnabled: boolean;
      };
    }
  | {
      type: "legal_doc";
      id: string;
      props: { pageKey: "privacy" | "terms" | "cookies"; title: string; updated: string; paragraphs: string[] };
    };

export type SiteRoute = {
  key: string;
  path: string;
  label: string;
  blocks: SiteBlock[];
};

export type SiteChrome = {
  brandName: string;
  brandSub?: string;
  nav: SiteNavItem[];
  cvHref?: string;
  showPlatformBranding: boolean;
  footer: {
    displayName: string;
    affiliation?: string;
    publicUrl: string;
    links: SiteNavItem[];
  };
};

/**
 * Stable intermediate representation.
 * Draft: rebuilt each preview. Published: frozen inside snapshot JSON.
 */
export type SiteIR = {
  irVersion: typeof SITE_IR_VERSION;
  policyVersion: typeof SITE_POLICY_VERSION;
  themeId: SiteThemeId;
  mode: SiteMode;
  identity: SiteIdentity;
  chrome: SiteChrome;
  routes: SiteRoute[];
  /** Full composition report for builder / debugging */
  composition: WebsiteComposition;
  seo: { title: string; description: string };
  meta: {
    username: string;
    publicUrl: string;
    contactFormEnabled: boolean;
    searchIndexingEnabled: boolean;
    generatedAt: string;
  };
};

export type SiteEngineInput = {
  username: string;
  publicUrl: string;
  status: string;
  identity: SiteIdentity;
  summary: string;
  sections: Record<string, SiteSectionEntry[]>;
  composition: WebsiteComposition;
  pages: SiteNavItem[];
  content: {
    research?: string;
    journey?: string;
    contributions?: string;
    contactIntro: string;
  };
  contactFormEnabled: boolean;
  cvDownloadUrl?: string;
  showPlatformBranding: boolean;
  searchIndexingEnabled: boolean;
  seo: { title: string; description: string };
  themeId?: SiteThemeId;
};
