import { isBrevoContactSyncEnabled } from "@/lib/email/config";
import { syncBrevoContact } from "@/lib/email/brevo";
import type { ContactSyncInput } from "@/lib/email/types";

/**
 * Sync a user into the email provider contact list (Brevo today).
 * Safe to call fire-and-forget from auth/settings hooks.
 */
export async function syncMarketingContact(input: ContactSyncInput) {
  if (!isBrevoContactSyncEnabled()) {
    return { ok: false as const, reason: "sync_disabled" as const };
  }
  return syncBrevoContact(input);
}

/** Convenience for new account creation → Users list (+ marketing if opted in). */
export async function syncUserContactOnSignup(input: {
  email: string;
  name?: string | null;
  marketingOptIn?: boolean;
}) {
  return syncMarketingContact({
    email: input.email,
    name: input.name,
    marketingOptIn: Boolean(input.marketingOptIn),
    isRegisteredUser: true,
    attributes: {
      SOURCE: "cvscholar_signup"
    }
  });
}
