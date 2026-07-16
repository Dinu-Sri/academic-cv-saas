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
  "blog"
]);

export function middleware(request: NextRequest) {
  const hostHeader = request.headers.get("host") || "";
  const host = hostHeader.split(":")[0].toLowerCase();
  const rootDomain = (process.env.NEXT_PUBLIC_WEBSITE_ROOT_DOMAIN || process.env.CVSCHOLAR_WEBSITE_ROOT_DOMAIN || "cvscholar.com").toLowerCase();

  // Path-based public sites already under /u/*
  if (request.nextUrl.pathname.startsWith("/u/")) {
    return NextResponse.next();
  }

  // username.cvscholar.com -> /u/username/...
  if (host.endsWith(`.${rootDomain}`) && host !== rootDomain && host !== `www.${rootDomain}`) {
    const subdomain = host.slice(0, -(rootDomain.length + 1));
    if (!subdomain || subdomain.includes(".") || PLATFORM_HOST_PREFIXES.has(subdomain)) {
      return NextResponse.next();
    }

    const url = request.nextUrl.clone();
    const suffix = request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname;
    url.pathname = `/u/${subdomain}${suffix}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.webp|assets|api).*)"]
};
