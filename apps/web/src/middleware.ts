import { NextResponse, type NextRequest } from "next/server";

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

export function middleware(request: NextRequest) {
  const hostHeader = request.headers.get("host") || "";
  const host = hostHeader.split(":")[0].toLowerCase();
  const rootDomain = (
    process.env.NEXT_PUBLIC_WEBSITE_ROOT_DOMAIN ||
    process.env.CVSCHOLAR_WEBSITE_ROOT_DOMAIN ||
    "cvscholar.com"
  ).toLowerCase();
  const subdomainEnabled = process.env.CVSCHOLAR_WEBSITE_SUBDOMAIN_ENABLED !== "0";
  const pathname = request.nextUrl.pathname;

  // Never rewrite API/static asset requests into /u/* (contact form, auth, assets).
  const isPassthroughPath =
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    pathname === "/favicon.webp" ||
    pathname === "/favicon.ico";

  // Scholar subdomain: username.cvscholar.com/* → internal /u/username/*
  // Public URLs stay on the subdomain; /u is only the Next.js route tree.
  if (
    !isPassthroughPath &&
    host.endsWith(`.${rootDomain}`) &&
    host !== rootDomain &&
    host !== `www.${rootDomain}`
  ) {
    const subdomain = host.slice(0, -(rootDomain.length + 1));
    if (subdomain && !subdomain.includes(".") && !PLATFORM_HOST_PREFIXES.has(subdomain)) {
      const url = request.nextUrl.clone();
      const suffix = pathname === "/" ? "" : pathname;
      url.pathname = `/u/${subdomain}${suffix}`;
      const response = NextResponse.rewrite(url);
      response.headers.set("x-cvscholar-site-username", subdomain);
      response.headers.set("x-cvscholar-site-mode", "subdomain");
      return response;
    }
  }

  // Prefer real subdomains: redirect path URLs on the app host to username.rootDomain
  // (skip local dev hosts where wildcard DNS is not available).
  if (
    subdomainEnabled &&
    pathname.startsWith("/u/") &&
    !isLocalDevHost(host) &&
    !host.endsWith(`.${rootDomain}`)
  ) {
    const parts = pathname.split("/").filter(Boolean); // ["u", username, ...rest]
    const username = parts[1];
    if (username && !PLATFORM_HOST_PREFIXES.has(username.toLowerCase())) {
      const rest = parts.slice(2).join("/");
      const target = new URL(`https://${username.toLowerCase()}.${rootDomain}${rest ? `/${rest}` : ""}`);
      target.search = request.nextUrl.search;
      return NextResponse.redirect(target, 308);
    }
  }

  return NextResponse.next();
}

function isLocalDevHost(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost")
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.webp|assets).*)"]
};
