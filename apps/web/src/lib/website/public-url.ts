import type { WebsitePageKey } from "./constants";
import { WEBSITE_ROOT_DOMAIN, websiteFeatureEnabled } from "./constants";

/** True when public scholar sites are served on username.{rootDomain}. */
export function websiteSubdomainEnabled() {
  return websiteFeatureEnabled() && process.env.CVSCHOLAR_WEBSITE_SUBDOMAIN_ENABLED !== "0";
}

/** Apex/root used for scholar sites (e.g. cvscholar.com). Not the app host. */
export function websiteRootDomain() {
  return (
    process.env.NEXT_PUBLIC_WEBSITE_ROOT_DOMAIN ||
    process.env.CVSCHOLAR_WEBSITE_ROOT_DOMAIN ||
    WEBSITE_ROOT_DOMAIN ||
    "cvscholar.com"
  )
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

/** Public origin for a scholar site: https://{username}.{rootDomain} */
export function websitePublicOrigin(username: string) {
  const clean = username.trim().toLowerCase();
  return `https://${clean}.${websiteRootDomain()}`;
}

/** Absolute public URL for a page on the scholar subdomain. */
export function websitePublicPageUrl(username: string, page: WebsitePageKey | "home" = "home") {
  const origin = websitePublicOrigin(username);
  if (!page || page === "home") return origin;
  return `${origin}/${page}`;
}

/** Relative path on the scholar subdomain (used in nav after rewrite). */
export function websitePublicPagePath(page: WebsitePageKey | "home" = "home") {
  if (!page || page === "home") return "/";
  return `/${page}`;
}

/** Internal Next.js path used after middleware rewrite (not for public marketing). */
export function websiteInternalPath(username: string, page: WebsitePageKey | "home" | string = "home") {
  const clean = username.trim().toLowerCase();
  if (!page || page === "home" || page === "/") return `/u/${clean}`;
  const segment = String(page).replace(/^\/+/, "");
  return `/u/${clean}/${segment}`;
}

export function websitePublicSitemapUrl(username: string) {
  return `${websitePublicOrigin(username)}/sitemap.xml`;
}

export function websitePublicRobotsUrl(username: string) {
  return `${websitePublicOrigin(username)}/robots.txt`;
}

/**
 * Hosts that must never be treated as scholar usernames.
 * Includes app/staging hosts so rewrite.cvscholar.com is not rewritten as a site.
 */
export function isPlatformWebsiteHost(host: string, rootDomain = websiteRootDomain()) {
  const normalized = host.split(":")[0].toLowerCase();
  if (!normalized || normalized === rootDomain || normalized === `www.${rootDomain}`) return true;

  if (!normalized.endsWith(`.${rootDomain}`)) {
    // Non-root hosts (localhost, rewrite staging FQDN not under root) are platform.
    return true;
  }

  const subdomain = normalized.slice(0, -(rootDomain.length + 1));
  if (!subdomain || subdomain.includes(".")) return true;

  return PLATFORM_HOST_PREFIXES.has(subdomain);
}

export function extractScholarUsernameFromHost(host: string, rootDomain = websiteRootDomain()) {
  const normalized = host.split(":")[0].toLowerCase();
  if (!normalized.endsWith(`.${rootDomain}`)) return null;
  if (normalized === rootDomain || normalized === `www.${rootDomain}`) return null;

  const subdomain = normalized.slice(0, -(rootDomain.length + 1));
  if (!subdomain || subdomain.includes(".") || PLATFORM_HOST_PREFIXES.has(subdomain)) return null;
  return subdomain;
}

const PLATFORM_HOST_PREFIXES = new Set([
  "www",
  "app",
  "api",
  "admin",
  "rewrite",
  "staging",
  "public",
  "cdn",
  "mail",
  "status",
  "docs",
  "blog",
  "auth",
  "login",
  "dashboard",
  "portal"
]);
