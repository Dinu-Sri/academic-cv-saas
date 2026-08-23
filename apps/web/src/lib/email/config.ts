import type { EmailProviderName } from "@/lib/email/types";

function envFlag(name: string, defaultOn = false): boolean {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (!raw) return defaultOn;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function envString(name: string): string {
  return (process.env[name] || "").trim();
}

export function getEmailFromDefault(fallback = "CVScholar <noreply@cvscholar.com>"): string {
  return envString("EMAIL_FROM") || fallback;
}

export function getBrevoApiKey(): string {
  return envString("BREVO_API_KEY") || envString("SENDINBLUE_API_KEY");
}

export function getResendApiKey(): string {
  return envString("RESEND_API_KEY");
}

/** Optional Brevo list id for all registered users (contact sync). */
export function getBrevoAllUsersListId(): number | null {
  const raw = envString("BREVO_ALL_USERS_LIST_ID");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Brevo list id for marketing-opted-in subscribers. */
export function getBrevoMarketingListId(): number | null {
  const raw = envString("BREVO_MARKETING_LIST_ID");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/**
 * Resolve active transactional provider.
 * EMAIL_PROVIDER=brevo|resend|auto (default auto).
 * auto → Brevo if BREVO_API_KEY set, else Resend.
 */
export function resolveEmailProvider(): EmailProviderName | null {
  const forced = envString("EMAIL_PROVIDER").toLowerCase();
  if (forced === "brevo") return getBrevoApiKey() ? "brevo" : null;
  if (forced === "resend") return getResendApiKey() ? "resend" : null;

  if (getBrevoApiKey()) return "brevo";
  if (getResendApiKey()) return "resend";
  return null;
}

export function isEmailSendingConfigured(): boolean {
  return resolveEmailProvider() != null;
}

export function isBrevoContactSyncEnabled(): boolean {
  if (!getBrevoApiKey()) return false;
  // Default on when Brevo is the active provider (or always when key present).
  return envFlag("BREVO_CONTACT_SYNC_ENABLED", true);
}

/** Parse `Name <email@x.com>` or bare email into Brevo sender shape. */
export function parseFromAddress(from: string): { name?: string; email: string } {
  const trimmed = from.trim();
  const match = trimmed.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, "");
    const email = match[2].trim();
    return name ? { name, email } : { email };
  }
  return { email: trimmed };
}
