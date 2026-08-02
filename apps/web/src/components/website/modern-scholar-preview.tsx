import { SiteIrRenderer } from "@/components/website/site-ir-renderer";
import type { WebsiteComposition } from "@/lib/website/composition-types";
import type { SiteIR } from "@/lib/website/site-engine";
import { buildSiteIR, DEFAULT_SITE_THEME_ID } from "@/lib/website/site-engine";
import type { LegalPageKey } from "@/lib/website/legal-content";

type PublicEntry = { id: string; sectionKey: string; data: Record<string, string> };

/**
 * Public/preview model. Prefer `siteIr` (Site Composition Engine).
 * Legacy fields retained for snapshot compatibility and builder.
 */
export type ModernScholarModel = {
  publicUrl: string;
  username?: string;
  identity: {
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
  summary: string;
  pages: { key: string; label: string; href: string }[];
  content: {
    research?: string;
    journey?: string;
    contributions?: string;
    contactIntro: string;
    about?: string;
    teaching?: string;
  };
  sections: Record<string, PublicEntry[]>;
  composition?: WebsiteComposition;
  /** Frozen or live Site IR from the composition engine. */
  siteIr?: SiteIR;
  contactFormEnabled: boolean;
  cvDownloadUrl?: string;
  showPlatformBranding?: boolean;
  seo?: { title?: string; description?: string };
};

/** @deprecated Use ScholarPagesModel alias, retained for snapshot compatibility. */
export type ScholarPagesModel = ModernScholarModel;

type Props = {
  model: ModernScholarModel;
  mode?: "preview" | "public";
  activePage?: string;
  contactSlot?: React.ReactNode;
  legalPage?: LegalPageKey;
};

/**
 * Entry point for Scholar Pages. Always renders via Site IR + theme pack.
 * Draft: IR rebuilt live. Published: IR frozen inside snapshot model.
 */
export function ModernScholarPreview({ model, mode = "preview", activePage, contactSlot, legalPage }: Props) {
  const ir = model.siteIr || rebuildIrFromLegacyModel(model);
  const activeRoute = legalPage || activePage || "home";

  const mergedIdentity = {
    ...ir.identity,
    ...model.identity,
    summary: model.identity.summary || model.summary || ir.identity.summary,
    // Prefer model photo (snapshot/sanitize) then frozen IR photo.
    ...(model.identity.photoUrl || ir.identity.photoUrl
      ? { photoUrl: model.identity.photoUrl || ir.identity.photoUrl }
      : {})
  };

  // Apply live branding override (plan entitlements) onto IR chrome.
  // Also re-sync photo into identity_hero blocks so sanitizer/snapshot drift cannot hide it.
  const resolvedIr: SiteIR = syncPhotoIntoHeroBlocks({
    ...ir,
    chrome: {
      ...ir.chrome,
      showPlatformBranding: model.showPlatformBranding !== false,
      cvHref: model.cvDownloadUrl || ir.chrome.cvHref
    },
    identity: mergedIdentity
  });

  return (
    <SiteIrRenderer
      ir={resolvedIr}
      mode={mode}
      activeRoute={activeRoute}
      contactSlot={contactSlot}
      stackAllContent={mode === "preview" && !legalPage}
    />
  );
}

/** Keep hero blocks + chrome identity aligned with the latest photoUrl. */
function syncPhotoIntoHeroBlocks(ir: SiteIR): SiteIR {
  const photoUrl = ir.identity.photoUrl?.trim() || undefined;
  return {
    ...ir,
    identity: photoUrl ? { ...ir.identity, photoUrl } : { ...ir.identity, photoUrl: undefined },
    routes: ir.routes.map((route) => ({
      ...route,
      blocks: route.blocks.map((block) => {
        if (block.type !== "identity_hero") return block;
        const identity = {
          ...block.props.identity,
          ...(photoUrl ? { photoUrl } : {})
        };
        if (!photoUrl) {
          const withoutPhoto = { ...identity };
          delete withoutPhoto.photoUrl;
          const hasDetails = Boolean(
            withoutPhoto.location ||
              withoutPhoto.email ||
              withoutPhoto.orcidUrl ||
              withoutPhoto.googleScholarUrl ||
              withoutPhoto.linkedinUrl
          );
          return {
            ...block,
            props: {
              ...block.props,
              identity: withoutPhoto,
              heroMode:
                block.props.heroMode === "with_photo"
                  ? hasDetails
                    ? "details_panel"
                    : "identity_only"
                  : block.props.heroMode
            }
          };
        }
        return {
          ...block,
          props: {
            ...block.props,
            identity,
            heroMode: "with_photo" as const
          }
        };
      })
    }))
  };
}

/** Backward path for older snapshots that predate siteIr. */
function rebuildIrFromLegacyModel(model: ModernScholarModel): SiteIR {
  const composition = model.composition || {
    mode: "sparse" as const,
    pages: [],
    categories: {
      research: emptyCat("research"),
      journey: emptyCat("journey"),
      contributions: emptyCat("contributions")
    },
    homeModules: [],
    navigation: model.pages.map((p) => p.key).filter(Boolean) as WebsiteComposition["navigation"]
  };

  return buildSiteIR({
    username: model.username || "site",
    publicUrl: model.publicUrl,
    status: "draft",
    identity: {
      displayName: model.identity.displayName,
      headline: model.identity.headline,
      affiliation: model.identity.affiliation,
      location: model.identity.location,
      email: model.identity.email,
      orcidUrl: model.identity.orcidUrl,
      googleScholarUrl: model.identity.googleScholarUrl,
      linkedinUrl: model.identity.linkedinUrl,
      summary: model.summary,
      ...(model.identity.photoUrl ? { photoUrl: model.identity.photoUrl } : {})
    },
    summary: model.summary,
    sections: model.sections,
    composition,
    pages: model.pages,
    content: {
      research: model.content.research,
      journey: model.content.journey,
      contributions: model.content.contributions,
      contactIntro: model.content.contactIntro || ""
    },
    contactFormEnabled: model.contactFormEnabled,
    cvDownloadUrl: model.cvDownloadUrl,
    showPlatformBranding: model.showPlatformBranding !== false,
    searchIndexingEnabled: true,
    seo: {
      title: model.seo?.title || model.identity.displayName,
      description: model.seo?.description || model.summary
    },
    themeId: DEFAULT_SITE_THEME_ID
  });
}

function emptyCat(key: "research" | "journey" | "contributions") {
  return {
    key,
    label: key,
    description: "",
    narrative: "",
    score: 0,
    strength: "empty" as const,
    reason: "empty" as const,
    modules: []
  };
}
