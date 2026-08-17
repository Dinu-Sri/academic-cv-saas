import { DEFAULT_COOKIE_CONSENT, type CookieConsent } from "@/lib/settings/defaults";

/** Guest/localStorage key for lightweight cookie preferences. */
export const META_CONSENT_STORAGE_KEY = "cvscholar_cookie_consent";

export type MetaConsentSnapshot = {
  marketing: boolean;
  analytics: boolean;
  functional: boolean;
};

export function parseConsentRecord(raw: unknown): MetaConsentSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      marketing: DEFAULT_COOKIE_CONSENT.marketing,
      analytics: DEFAULT_COOKIE_CONSENT.analytics,
      functional: DEFAULT_COOKIE_CONSENT.functional
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    marketing: typeof o.marketing === "boolean" ? o.marketing : DEFAULT_COOKIE_CONSENT.marketing,
    analytics: typeof o.analytics === "boolean" ? o.analytics : DEFAULT_COOKIE_CONSENT.analytics,
    functional: typeof o.functional === "boolean" ? o.functional : DEFAULT_COOKIE_CONSENT.functional
  };
}

export function cookieConsentToMeta(consent: CookieConsent): MetaConsentSnapshot {
  return {
    marketing: consent.marketing,
    analytics: consent.analytics,
    functional: consent.functional
  };
}

/** Client-only: read guest/local consent; defaults match product defaults (marketing off). */
export function readClientMetaConsent(): MetaConsentSnapshot {
  if (typeof window === "undefined") {
    return parseConsentRecord(null);
  }
  try {
    const raw = window.localStorage.getItem(META_CONSENT_STORAGE_KEY);
    if (!raw) return parseConsentRecord(null);
    return parseConsentRecord(JSON.parse(raw) as unknown);
  } catch {
    return parseConsentRecord(null);
  }
}

/** Persist guest consent (Settings UI can also write this for logged-in sync). */
export function writeClientMetaConsent(consent: Partial<MetaConsentSnapshot>) {
  if (typeof window === "undefined") return;
  try {
    const next = { ...readClientMetaConsent(), ...consent };
    window.localStorage.setItem(META_CONSENT_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("cvscholar-cookie-consent", { detail: next }));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Advanced Matching (hashed email) requires marketing consent.
 * Base pixel may still load when tracking is enabled (see MetaPixel + docs).
 */
export function allowsMetaAdvancedMatching(consent: MetaConsentSnapshot | null | undefined): boolean {
  return Boolean(consent?.marketing);
}
