/** Absolute site origin for metadata, JSON-LD, and sitemaps. */
export function getSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.APP_URL ||
    "https://cvscholar.com";
  return raw.replace(/\/$/, "");
}

export function absoluteUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getSiteOrigin()}${path}`;
}
