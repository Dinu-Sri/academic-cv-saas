export const WEBSITE_TEMPLATE_KEY = "modern-scholar";
export const WEBSITE_ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_WEBSITE_ROOT_DOMAIN ||
  process.env.CVSCHOLAR_WEBSITE_ROOT_DOMAIN ||
  "cvscholar.com";

export const WEBSITE_PAGE_KEYS = [
  "home",
  "about",
  "research",
  "publications",
  "teaching",
  "cv",
  "contact"
] as const;

export type WebsitePageKey = (typeof WEBSITE_PAGE_KEYS)[number];

export const WEBSITE_PAGE_LABELS: Record<WebsitePageKey, string> = {
  home: "Home",
  about: "About",
  research: "Research",
  publications: "Publications",
  teaching: "Teaching",
  cv: "CV",
  contact: "Contact"
};

export const RESERVED_WEBSITE_USERNAMES = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "blog",
  "cdn",
  "contact",
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
