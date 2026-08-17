/** Cookie: user chose full AppShell on a phone. */
export const MOBILE_MODE_COOKIE = "cvscholar_mobile_mode";

export type MobileModePreference = "minimal" | "full";

/** Power product routes that are unusable on a narrow phone UI. */
export const MOBILE_POWER_PATH_PREFIXES = [
  "/profile",
  "/cv",
  "/website",
  "/publications",
  "/settings",
  "/support",
  "/billing",
  "/admin"
] as const;

/** Paths that stay available on phones without forcing /m. */
export const MOBILE_ALLOWED_PREFIXES = [
  "/m",
  "/api",
  "/blog",
  "/privacy",
  "/terms",
  "/cookie-policy",
  "/cookies",
  "/refund-policy",
  "/pricing",
  "/methodology",
  "/invite",
  "/reset-password",
  "/s/",
  "/u/",
  "/_next",
  "/assets"
] as const;

export function isMobileFlowEnabled(): boolean {
  // Prefer public flag so client MobileViewportGate can honor disable.
  const raw = (
    process.env.NEXT_PUBLIC_CVSCHOLAR_MOBILE_FLOW_ENABLED ||
    process.env.CVSCHOLAR_MOBILE_FLOW_ENABLED ||
    "1"
  )
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

/**
 * Phone-class user agents only (not tablets).
 * Mirrors legacy Auth::deviceType() phone branch.
 */
export function isPhoneUserAgent(userAgent: string): boolean {
  const ua = userAgent || "";
  if (!ua) return false;
  // iPad / Android tablets — treat as desktop per product decision
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) && !/Mobile/i.test(ua)) return false;
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return false;
  return /Android.*Mobile|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Windows Phone|Mobi/i.test(
    ua
  );
}

export function isPowerProductPath(pathname: string): boolean {
  if (pathname === "/") return false;
  for (const prefix of MOBILE_POWER_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function isMobileShellPath(pathname: string): boolean {
  return pathname === "/m" || pathname.startsWith("/m/");
}

export function shouldForceMobileMinimal(pathname: string, userAgent: string, mode: string | undefined): boolean {
  if (!isMobileFlowEnabled()) return false;
  if (mode === "full") return false;
  if (!isPhoneUserAgent(userAgent)) return false;
  if (isMobileShellPath(pathname)) return false;
  // Marketing home is allowed, but first-time product intent still lands on /m via client gate.
  return isPowerProductPath(pathname);
}
