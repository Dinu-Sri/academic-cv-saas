import type { Metadata } from "next";
import { absoluteUrl, getSiteOrigin } from "@/lib/content/site-url";
import { getPlanCatalog } from "@/lib/billing/plans";

export const PLATFORM_NAME = "CVScholar";
export const ORG_NAME = "Clossyan Technologies (Pvt) Ltd";
export const ORG_EMAIL = "info@clossyan.com";

export const PLATFORM_DEFAULT_DESCRIPTION =
  "The academic CV builder for researchers, professors, and PhD students. Real LaTeX PDFs, ORCID and Google Scholar import, and free academic websites from your CV.";

export function platformLogoUrl() {
  return absoluteUrl("/cvscholar-logo.svg");
}

export function defaultOpenGraph(input?: {
  title?: string;
  description?: string;
  url?: string;
  type?: "website" | "article" | "profile";
  images?: string[];
}): NonNullable<Metadata["openGraph"]> {
  const title = input?.title || PLATFORM_NAME;
  const description = input?.description || PLATFORM_DEFAULT_DESCRIPTION;
  const url = input?.url || getSiteOrigin();
  const images = (input?.images?.length ? input.images : [platformLogoUrl()]).map((url) => ({
    url,
    alt: title
  }));

  return {
    type: input?.type || "website",
    locale: "en_US",
    siteName: PLATFORM_NAME,
    title,
    description,
    url,
    images
  };
}

export function defaultTwitter(input?: {
  title?: string;
  description?: string;
  images?: string[];
}): NonNullable<Metadata["twitter"]> {
  return {
    card: "summary_large_image",
    title: input?.title || PLATFORM_NAME,
    description: input?.description || PLATFORM_DEFAULT_DESCRIPTION,
    images: input?.images?.length ? input.images : [platformLogoUrl()]
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORG_NAME,
    alternateName: PLATFORM_NAME,
    url: getSiteOrigin(),
    logo: platformLogoUrl(),
    email: ORG_EMAIL,
    contactPoint: {
      "@type": "ContactPoint",
      email: ORG_EMAIL,
      contactType: "customer service"
    },
    sameAs: ["https://www.facebook.com/cvschlar"].filter(Boolean)
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: PLATFORM_NAME,
    url: getSiteOrigin(),
    description: PLATFORM_DEFAULT_DESCRIPTION,
    publisher: {
      "@type": "Organization",
      name: ORG_NAME,
      url: getSiteOrigin()
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${getSiteOrigin()}/blog?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

export function softwareApplicationJsonLd() {
  const plans = getPlanCatalog();
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: PLATFORM_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: getSiteOrigin(),
    description: PLATFORM_DEFAULT_DESCRIPTION,
    offers: plans.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      price: String(plan.priceUsd),
      priceCurrency: "USD",
      description: plan.tagline
    }))
  };
}

export function webPageJsonLd(input: {
  title: string;
  description: string;
  url: string;
  type?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": input.type || "WebPage",
    name: input.title,
    description: input.description,
    url: input.url,
    isPartOf: {
      "@type": "WebSite",
      name: PLATFORM_NAME,
      url: getSiteOrigin()
    },
    publisher: {
      "@type": "Organization",
      name: ORG_NAME
    }
  };
}

/** Serialize one or more schema objects as a single @graph document. */
export function jsonLdGraphScript(schemas: Record<string, unknown>[]) {
  const graph = {
    "@context": "https://schema.org",
    "@graph": schemas.map((schema) => {
      const next = { ...schema };
      delete next["@context"];
      return next;
    })
  };
  return JSON.stringify(graph);
}

export function buildPlatformLlmsTxt(blogLines: string[]) {
  const base = getSiteOrigin();
  return [
    `# ${PLATFORM_NAME}`,
    "",
    `> ${PLATFORM_DEFAULT_DESCRIPTION}`,
    "",
    `${PLATFORM_NAME} is built by ${ORG_NAME}. The platform targets academic professionals who need a comprehensive curriculum vitae rather than an industry resume, plus an optional academic website generated from the same profile.`,
    "",
    "Key features:",
    "",
    "- Academic CV editor with LaTeX PDF output",
    "- ORCID and Google Scholar publication import",
    "- Free academic website from your CV (subdomain)",
    "- Custom domains on Scholar Annual",
    "- AI-assisted CV building and section guidance",
    "",
    "## Product Pages",
    "",
    `- [Home](${base}/): Landing page for academic CVs and websites`,
    `- [Pricing](${base}/pricing): Free, PDF Pass, and Scholar Annual plans`,
    `- [Blog](${base}/blog): Guides for academic CVs and careers`,
    `- [Academic website](${base}/website): Claim a free researcher website address`,
    `- [Privacy Policy](${base}/privacy): Data handling practices`,
    `- [Terms of Use](${base}/terms): Service terms`,
    `- [Cookie Policy](${base}/cookie-policy): Cookie practices`,
    `- [Refund Policy](${base}/refund-policy): Refunds and billing adjustments`,
    `- [Methodology: time to first CV](${base}/methodology/time-to-first-cv): How public impact metrics are measured`,
    "",
    "## Blog Articles",
    "",
    blogLines.length ? blogLines.join("\n") : "- See the full archive at /blog",
    "",
    "## Optional",
    "",
    `- [Sitemap](${base}/sitemap.xml): XML sitemap of indexable marketing pages`,
    `- [Robots](${base}/robots.txt): Crawler rules for the product site`,
    ""
  ].join("\n");
}
