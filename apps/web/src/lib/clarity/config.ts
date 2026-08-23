/**
 * Microsoft Clarity configuration (env-driven).
 * Observational analytics / session replay — not ads.
 */

function envFlag(name: string, defaultOn = false): boolean {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (!raw) return defaultOn;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function envString(name: string): string {
  return (process.env[name] || "").trim();
}

/** Project id from Clarity → Settings → Setup (e.g. vn6v6vl1eo). */
export function getClarityProjectId(): string {
  return envString("NEXT_PUBLIC_CLARITY_PROJECT_ID") || envString("CLARITY_PROJECT_ID");
}

/**
 * Hard kill switch + project id required.
 * Default off until Portainer sets CLARITY_ENABLED=1.
 */
export function isClarityEnabled(): boolean {
  if (!envFlag("CLARITY_ENABLED", false)) return false;
  return Boolean(getClarityProjectId());
}

/**
 * Include published scholar sites (subdomain / custom domain).
 * Default on — public pages are part of the observation goal.
 * Set CLARITY_PUBLIC_SITES_ENABLED=0 to limit Clarity to the main product host only.
 */
export function isClarityPublicSitesEnabled(): boolean {
  if (!isClarityEnabled()) return false;
  return envFlag("CLARITY_PUBLIC_SITES_ENABLED", true);
}
