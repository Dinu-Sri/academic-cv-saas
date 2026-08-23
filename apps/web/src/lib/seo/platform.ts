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
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": input.type || "WebPage",
    name: input.title,
    description: input.description,
    url: input.url,
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    isPartOf: {
      "@type": "WebSite",
      name: PLATFORM_NAME,
      url: getSiteOrigin()
    },
    publisher: {
      "@type": "Organization",
      name: ORG_NAME,
      logo: {
        "@type": "ImageObject",
        url: platformLogoUrl()
      }
    }
  };
}

export function breadcrumbListJsonLd(items: Array<{ name: string; url?: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {})
    }))
  };
}

export function collectionPageJsonLd(input: {
  title: string;
  description: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
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

export function blogPostingJsonLd(input: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    url: input.url,
    datePublished: input.datePublished,
    dateModified: input.dateModified || input.datePublished,
    author: {
      "@type": "Organization",
      name: input.author || ORG_NAME
    },
    publisher: {
      "@type": "Organization",
      name: ORG_NAME,
      logo: {
        "@type": "ImageObject",
        url: platformLogoUrl()
      }
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.url
    },
    ...(input.image ? { image: input.image } : { image: platformLogoUrl() })
  };
}

export function faqPageJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer
      }
    }))
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
    `${PLATFORM_NAME} is built by ${ORG_NAME}. The platform targets academic professionals who need a comprehensive curriculum vitae rather than an industry resume, plus an optional academic website generated from the same profile. An academic CV has no page limit and grows throughout a scholarly career, covering publications, teaching, grants, awards, and professional service.`,
    "",
    "Key features:",
    "",
    "- Academic CV editor with real LaTeX PDF output (Computer Modern Unicode)",
    "- ORCID and Google Scholar publication import",
    "- DOI auto-fill for publication metadata",
    "- Free academic website from your CV (subdomain)",
    "- Custom domains on Scholar Annual",
    "- AI-assisted CV building and section guidance",
    "- Field-specific academic sections (publications, teaching, grants, awards, service)",
    "",
    "## Product Pages",
    "",
    `- [Home](${base}/): Landing page for academic CVs and websites`,
    `- [Pricing](${base}/pricing): Free, PDF Pass, and Scholar Annual plans`,
    `- [Blog](${base}/blog): Full blog archive with search and category filtering`,
    `- [Academic website](${base}/website): Claim a free researcher website address`,
    `- [Privacy Policy](${base}/privacy): Data handling practices and GDPR information`,
    `- [Terms of Use](${base}/terms): Service terms and acceptable use policy`,
    `- [Cookie Policy](${base}/cookie-policy): Cookie practices`,
    `- [Refund Policy](${base}/refund-policy): Refund, cancellation, and billing adjustment policy`,
    `- [Methodology: time to first CV](${base}/methodology/time-to-first-cv): How public impact metrics are measured`,
    "",
    "## Blog Articles",
    "",
    blogLines.length ? blogLines.join("\n") : `- See the full archive at ${base}/blog`,
    "",
    "## Optional",
    "",
    `- [Sitemap](${base}/sitemap.xml): XML sitemap listing all indexable pages`,
    `- [Robots](${base}/robots.txt): Crawler rules for the product site`,
    `- [Blog Archive](${base}/blog): Full blog index with search and category filtering`,
    ""
  ].join("\n");
}
