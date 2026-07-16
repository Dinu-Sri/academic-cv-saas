/**
 * Host helpers shared by middleware, root layout, and client shell.
 * Pure functions only (no Prisma) so workers/CI can import safely.
 */

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

export function websiteRootDomainFromEnv() {
  return (
    process.env.NEXT_PUBLIC_WEBSITE_ROOT_DOMAIN ||
    process.env.CVSCHOLAR_WEBSITE_ROOT_DOMAIN ||
    "cvscholar.com"
  )
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

/** True when Host is a scholar public site: username.{rootDomain}. */
export function isScholarPublicHost(hostHeader: string, rootDomain = websiteRootDomainFromEnv()) {
  const host = (hostHeader || "").split(":")[0].toLowerCase();
  if (!host || !rootDomain) return false;
  if (host === rootDomain || host === `www.${rootDomain}`) return false;
  if (!host.endsWith(`.${rootDomain}`)) return false;

  const subdomain = host.slice(0, -(rootDomain.length + 1));
  if (!subdomain || subdomain.includes(".")) return false;
  if (PLATFORM_HOST_PREFIXES.has(subdomain)) return false;
  return true;
}

export function extractScholarUsernameFromHostHeader(hostHeader: string, rootDomain = websiteRootDomainFromEnv()) {
  if (!isScholarPublicHost(hostHeader, rootDomain)) return null;
  const host = hostHeader.split(":")[0].toLowerCase();
  return host.slice(0, -(rootDomain.length + 1));
}
