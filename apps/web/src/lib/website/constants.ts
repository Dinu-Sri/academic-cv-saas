/** Scholar Pages design system (legacy alias: modern-scholar). */
export const WEBSITE_TEMPLATE_KEY = "scholar-pages";
export const WEBSITE_TEMPLATE_LEGACY_KEYS = ["modern-scholar", "scholar-pages"] as const;
export const WEBSITE_ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_WEBSITE_ROOT_DOMAIN ||
  process.env.CVSCHOLAR_WEBSITE_ROOT_DOMAIN ||
  "cvscholar.com";

export const WEBSITE_PAGE_KEYS = [
  "home",
  "research",
  "journey",
  "contributions",
  "contact"
] as const;

export type WebsitePageKey = (typeof WEBSITE_PAGE_KEYS)[number];

export const WEBSITE_PAGE_LABELS: Record<WebsitePageKey, string> = {
  home: "Home",
  research: "Research",
  journey: "Academic Journey",
  contributions: "Contributions",
  contact: "Contact"
};

export const LEGACY_WEBSITE_PAGE_REDIRECTS = {
  about: "journey",
  publications: "research",
  teaching: "journey",
  cv: "journey"
} as const satisfies Record<string, WebsitePageKey>;

export const RESERVED_WEBSITE_USERNAMES = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "blog",
  "cdn",
  "contact",
  "cookies",
  "dashboard",
  "docs",
  "files",
  "help",
  "home",
  "login",
  "logout",
  "mail",
  "marketing",
  "media",
  "mobile",
  "pricing",
  "privacy",
  "profile",
  "public",
  "register",
  "rewrite",
  "robots",
  "root",
  "s",
  "settings",
  "sitemap",
  "static",
  "status",
  "support",
  "templates",
  "terms",
  "u",
  "website",
  "www",
  "cvscholar",
  "assets",
  "static",
  "edge",
  "preview",
  "staging",
  "test",
  "null",
  "undefined"
]);

export function websiteFeatureEnabled() {
  return process.env.CVSCHOLAR_WEBSITE_ENABLED !== "0";
}

export function websitePublishEnabled() {
  return websiteFeatureEnabled() && process.env.CVSCHOLAR_WEBSITE_PUBLISH_ENABLED !== "0";
}

/** @deprecated Prefer websitePublicOrigin / websitePublicPageUrl from public-url.ts */
export function websitePublicBasePath(username: string) {
  return `https://${username}.${WEBSITE_ROOT_DOMAIN}`;
}

export function websiteSubdomainModeEnabled() {
  return websiteFeatureEnabled() && process.env.CVSCHOLAR_WEBSITE_SUBDOMAIN_ENABLED !== "0";
}
