/**
 * Meta Pixel + Conversions API configuration (env-driven).
 * Never hardcode pixel IDs or tokens.
 */

function envFlag(name: string, defaultOn = false): boolean {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (!raw) return defaultOn;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function envString(name: string): string {
  return (process.env[name] || "").trim();
}

/** Hard kill switch + public pixel id required for any Meta traffic. */
export function isMetaTrackingEnabled(): boolean {
  if (!envFlag("META_TRACKING_ENABLED", false)) return false;
  return Boolean(getMetaPixelId());
}

export function getMetaPixelId(): string {
  return envString("NEXT_PUBLIC_META_PIXEL_ID") || envString("META_PIXEL_ID");
}

export function getMetaCapiPixelId(): string {
  return envString("META_CAPI_PIXEL_ID") || getMetaPixelId();
}

export function getMetaCapiAccessToken(): string {
  return envString("META_CAPI_ACCESS_TOKEN");
}

export function getMetaCapiTestEventCode(): string {
  return envString("META_CAPI_TEST_EVENT_CODE");
}

/** Server CAPI needs token + dataset id. */
export function isMetaCapiEnabled(): boolean {
  return isMetaTrackingEnabled() && Boolean(getMetaCapiAccessToken() && getMetaCapiPixelId());
}

/**
 * Hashed email / external_id for Event Match Quality.
 * Still requires per-user marketing cookie consent at call sites.
 */
export function isMetaAdvancedMatchingEnabled(): boolean {
  if (!isMetaTrackingEnabled()) return false;
  // Default on when tracking is on; set META_ADVANCED_MATCHING_ENABLED=0 to disable.
  return envFlag("META_ADVANCED_MATCHING_ENABLED", true);
}

/** Soft lead values for non-purchase optimization events (USD). */
export const META_SOFT_VALUES = {
  completeRegistration: 2,
  startTrial: 3,
  websitePublished: 5,
  cvGenerated: 3
} as const;

export const META_CURRENCY = "USD" as const;

/** Graph API version for CAPI. */
export const META_GRAPH_API_VERSION = "v21.0";
