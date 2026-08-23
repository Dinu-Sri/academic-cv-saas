import { syncBrevoContact } from "@/lib/email/brevo";
import { getBrevoApiKey, isBrevoContactSyncEnabled } from "@/lib/email/config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** Very light in-memory rate limit (per process). */
const recentByIp = new Map<string, { count: number; resetAt: number }>();

function allowIp(ip: string, max = 8, windowMs = 60 * 60 * 1000) {
  const key = ip || "unknown";
  const now = Date.now();
  const row = recentByIp.get(key);
  if (!row || row.resetAt < now) {
    recentByIp.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= max) return false;
  row.count += 1;
  return true;
}

export type GuestSubscribeInput = {
  email: string;
  source?: string;
  /** Honeypot — must be empty */
  company?: string;
  ip?: string;
};

/**
 * Guest / public marketing subscribe → Brevo marketing list.
 * Does not create a CVScholar account.
 */
export async function subscribeGuestToMarketing(input: GuestSubscribeInput) {
  if (!isBrevoContactSyncEnabled() || !getBrevoApiKey()) {
    return { ok: false as const, error: "Email list is not configured yet.", status: 503 };
  }

  if (input.company && String(input.company).trim()) {
    // Bot filled honeypot — pretend success.
    return { ok: true as const, already: false as const };
  }

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return { ok: false as const, error: "Enter a valid email address.", status: 400 };
  }

  if (!allowIp(input.ip || "")) {
    return { ok: false as const, error: "Too many attempts. Please try again later.", status: 429 };
  }

  const source = (input.source || "homepage_popup").trim().slice(0, 80) || "homepage_popup";
  // Marketing list only — do NOT add guests to CVScholar Users (accounts-only).
  const result = await syncBrevoContact({
    email,
    marketingOptIn: true,
    isRegisteredUser: false,
    attributes: {
      SOURCE: source,
      GUEST_SUBSCRIBE: true
    }
  });

  if (!result.ok) {
    return {
      ok: false as const,
      error: "Could not subscribe right now. Please try again.",
      status: 502
    };
  }

  return { ok: true as const, already: false as const };
}
