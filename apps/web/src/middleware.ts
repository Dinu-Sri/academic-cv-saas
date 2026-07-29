import { NextResponse, type NextRequest } from "next/server";

const GUEST_COOKIE = "cvscholar_guest";
const GUEST_TTL_SECONDS = 14 * 24 * 60 * 60;

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
  "portal",
  "sites"
]);

export async function middleware(request: NextRequest) {
  const hostHeader = request.headers.get("host") || "";
  const host = hostHeader.split(":")[0].toLowerCase();
  const rootDomain = (
    process.env.NEXT_PUBLIC_WEBSITE_ROOT_DOMAIN ||
    process.env.CVSCHOLAR_WEBSITE_ROOT_DOMAIN ||
    "cvscholar.com"
  ).toLowerCase();
  const subdomainEnabled = process.env.CVSCHOLAR_WEBSITE_SUBDOMAIN_ENABLED !== "0";
  const customDomainEnabled = process.env.CVSCHOLAR_CUSTOM_DOMAIN_ENABLED !== "0";
  const pathname = request.nextUrl.pathname;

  // Never rewrite API/static asset requests into /u/* (contact form, auth, assets).
  const isPassthroughPath =
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    pathname === "/cvscholar-logo.svg" ||
    pathname === "/favicon.webp" ||
    pathname === "/favicon.ico";

  // Scholar subdomain: username.cvscholar.com/* → internal /u/username/*
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
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-cvscholar-site-username", subdomain);
      requestHeaders.set("x-cvscholar-site-mode", "subdomain");
      return NextResponse.rewrite(url, {
        request: { headers: requestHeaders }
      });
    }
  }

  // Custom domain: example.edu → lookup username via Node API, rewrite to /u/{username}
  if (
    customDomainEnabled &&
    !isPassthroughPath &&
    !isLocalDevHost(host) &&
    host !== rootDomain &&
    host !== `www.${rootDomain}` &&
    !host.endsWith(`.${rootDomain}`)
  ) {
    const username = await lookupCustomDomainUsername(request, host);
    if (username) {
      const url = request.nextUrl.clone();
      const suffix = pathname === "/" ? "" : pathname;
      url.pathname = `/u/${username}${suffix}`;
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-cvscholar-site-username", username);
      requestHeaders.set("x-cvscholar-site-mode", "custom-domain");
      requestHeaders.set("x-cvscholar-custom-host", host);
      return NextResponse.rewrite(url, {
        request: { headers: requestHeaders }
      });
    }
  }

  // Prefer real subdomains: redirect path URLs on the app host to username.rootDomain
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

  const response = NextResponse.next();

  // Ensure anonymous visitors have a durable guest trial cookie (DB row is created on first use).
  if (!isPassthroughPath && !request.cookies.get(GUEST_COOKIE)?.value) {
    const token = cryptoRandomToken();
    response.cookies.set(GUEST_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GUEST_TTL_SECONDS
    });
  }

  return response;
}

async function lookupCustomDomainUsername(request: NextRequest, host: string): Promise<string | null> {
  try {
    const appBase = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.BETTER_AUTH_URL ||
      request.nextUrl.origin
    ).replace(/\/$/, "");
    const lookupUrl = `${appBase}/api/public/domain-lookup?h=${encodeURIComponent(host)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(lookupUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      // Edge: avoid next cache issues for host routing
      cache: "no-store"
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { found?: boolean; username?: string };
    if (data.found && data.username) return data.username.toLowerCase();
    return null;
  } catch {
    return null;
  }
}

function cryptoRandomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
  matcher: ["/((?!_next/static|_next/image|cvscholar-logo.svg|favicon.webp|assets).*)"]
};
