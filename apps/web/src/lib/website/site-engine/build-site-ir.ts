import { getLegalPage, type LegalPageKey } from "../legal-content";
import { buildHomeHighlights, buildHomeMetrics, resolveHomeBodyModules } from "../home-highlights";
import type { WebsiteContentModule, WebsiteSectionEntry } from "../composition-types";
import { presentationForSection } from "./presentation";
import {
  DEFAULT_SITE_THEME_ID,
  SITE_IR_VERSION,
  SITE_POLICY_VERSION,
  type SiteBlock,
  type SiteEngineInput,
  type SiteIR,
  type SiteRoute,
  type SiteSectionModule
} from "./types";

/**
 * Deterministic compiler: composition + content → Site IR.
 * No CSS, no React — pure JSON plan for the theme renderer.
 */
export function buildSiteIR(input: SiteEngineInput): SiteIR {
  const themeId = input.themeId || DEFAULT_SITE_THEME_ID;
  const composition = input.composition;
  const sectionsAsPublic = input.sections as Record<string, WebsiteSectionEntry[] | undefined>;

  const metrics = buildHomeMetrics(sectionsAsPublic);
  const highlights = buildHomeHighlights(sectionsAsPublic);
  const homeModules = resolveHomeBodyModules(sectionsAsPublic, composition).map(toSiteModule);

  const firstDestination = input.pages.find((p) => p.key !== "home" && p.key !== "contact");
  const contactPage = input.pages.find((p) => p.key === "contact");

  const hasDetails = Boolean(
    input.identity.location ||
      input.identity.email ||
      input.identity.orcidUrl ||
      input.identity.googleScholarUrl ||
      input.identity.linkedinUrl ||
      input.identity.photoUrl
  );

  const heroMode = input.identity.photoUrl
    ? ("with_photo" as const)
    : hasDetails
      ? ("details_panel" as const)
      : ("identity_only" as const);

  const secondaryCtas: { label: string; href: string }[] = [];
  if (input.cvDownloadUrl) {
    secondaryCtas.push({ label: "Download CV", href: input.cvDownloadUrl });
  }
  if (contactPage && firstDestination) {
    secondaryCtas.push({ label: "Contact", href: contactPage.href });
  }

  const homeBlocks: SiteBlock[] = [];

  homeBlocks.push({
    type: "identity_hero",
    id: "home-hero",
    props: {
      identity: input.identity,
      heroMode,
      primaryCta: firstDestination
        ? { label: `Explore ${firstDestination.label.toLowerCase()}`, href: firstDestination.href }
        : contactPage
          ? { label: "Contact", href: contactPage.href }
          : undefined,
      secondaryCtas,
      cvHref: input.cvDownloadUrl
    }
  });

  if (heroMode === "details_panel" || heroMode === "with_photo") {
    const links = [
      input.identity.orcidUrl ? { label: "ORCID", href: input.identity.orcidUrl } : null,
      input.identity.googleScholarUrl ? { label: "Google Scholar", href: input.identity.googleScholarUrl } : null,
      input.identity.linkedinUrl ? { label: "LinkedIn", href: input.identity.linkedinUrl } : null
    ].filter((x): x is { label: string; href: string } => Boolean(x));

    if (input.identity.location || input.identity.email || links.length) {
      homeBlocks.push({
        type: "details_panel",
        id: "home-details",
        props: {
          location: input.identity.location || undefined,
          email: input.identity.email || undefined,
          links
        }
      });
    }
  }

  if (metrics.length) {
    homeBlocks.push({
      type: "metric_band",
      id: "home-metrics",
      props: { items: metrics }
    });
  }

  if (highlights.length) {
    homeBlocks.push({
      type: "highlight_list",
      id: "home-highlights",
      props: { items: highlights }
    });
  }

  homeModules.forEach((module, index) => {
    homeBlocks.push({
      type: "section_module",
      id: `home-module-${module.key}`,
      props: {
        module,
        headingLevel: index === 0 && composition.mode === "sparse" ? "h1" : "h2"
      }
    });
  });

  if (composition.mode === "sparse" && contactPage) {
    homeBlocks.push({
      type: "sparse_contact_cta",
      id: "home-contact-cta",
      props: {
        intro: input.content.contactIntro || "For teaching, collaboration, or academic enquiries.",
        href: contactPage.href
      }
    });
  }

  const routes: SiteRoute[] = [
    {
      key: "home",
      path: "/",
      label: "Home",
      blocks: homeBlocks
    }
  ];

  for (const page of composition.pages) {
    const nav = input.pages.find((p) => p.key === page.key);
    const blocks: SiteBlock[] = [];
    page.modules.forEach((module, index) => {
      blocks.push({
        type: "section_module",
        id: `${page.key}-${module.key}`,
        props: {
          module: toSiteModule(module),
          headingLevel: index === 0 && !page.narrative ? "h1" : "h2"
        }
      });
    });
    routes.push({
      key: page.key,
      path: nav?.href || `/${page.key}`,
      label: page.label,
      blocks
    });
  }

  if (input.contactFormEnabled && contactPage) {
    routes.push({
      key: "contact",
      path: contactPage.href,
      label: contactPage.label,
      blocks: [
        {
          type: "contact_page",
          id: "contact-main",
          props: {
            intro:
              input.content.contactIntro ||
              "For research collaboration, supervision, invited talks, or general academic enquiries.",
            identity: {
              displayName: input.identity.displayName,
              affiliation: input.identity.affiliation,
              location: input.identity.location,
              email: input.identity.email
            },
            formEnabled: true
          }
        }
      ]
    });
  }

  for (const legalKey of ["privacy", "terms", "cookies"] as LegalPageKey[]) {
    const doc = getLegalPage(legalKey);
    routes.push({
      key: legalKey,
      path: `/${legalKey === "cookies" ? "cookies" : legalKey}`,
      label: doc.title,
      blocks: [
        {
          type: "legal_doc",
          id: `legal-${legalKey}`,
          props: {
            pageKey: legalKey,
            title: doc.title,
            updated: doc.updated,
            paragraphs: doc.paragraphs
          }
        }
      ]
    });
  }

  return {
    irVersion: SITE_IR_VERSION,
    policyVersion: SITE_POLICY_VERSION,
    themeId,
    mode: composition.mode,
    identity: input.identity,
    chrome: {
      brandName: input.identity.displayName,
      brandSub: input.identity.headline || input.identity.affiliation || undefined,
      nav: input.pages,
      cvHref: input.cvDownloadUrl,
      showPlatformBranding: input.showPlatformBranding,
      footer: {
        displayName: input.identity.displayName,
        affiliation: input.identity.affiliation || undefined,
        publicUrl: input.publicUrl,
        links: input.pages.filter((p) => p.key !== "home")
      }
    },
    routes,
    composition,
    seo: input.seo,
    meta: {
      username: input.username,
      publicUrl: input.publicUrl,
      contactFormEnabled: input.contactFormEnabled,
      searchIndexingEnabled: input.searchIndexingEnabled,
      generatedAt: new Date().toISOString()
    }
  };
}

function toSiteModule(module: WebsiteContentModule): SiteSectionModule {
  return {
    key: module.key,
    label: module.label,
    category: module.category,
    entries: module.entries.map((entry) => ({
      id: entry.id,
      data: entry.data
    })),
    presentation: presentationForSection(module.key)
  };
}

/** Resolve a route from IR for public/preview rendering. */
export function getSiteRoute(ir: SiteIR, routeKey: string): SiteRoute | undefined {
  return ir.routes.find((route) => route.key === routeKey);
}
