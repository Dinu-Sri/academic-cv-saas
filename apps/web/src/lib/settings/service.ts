import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_COOKIE_CONSENT,
  DEFAULT_CV_DEFAULTS,
  type AppearancePrefs,
  type CookieConsent,
  type CvDefaults
} from "@/lib/settings/defaults";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseCvDefaults(raw: unknown): CvDefaults {
  const o = asRecord(raw);
  const pageSize = o.pageSize === "Letter" || o.pageSize === "Legal" || o.pageSize === "A4" ? o.pageSize : DEFAULT_CV_DEFAULTS.pageSize;
  const fontFamily = o.fontFamily === "sans" || o.fontFamily === "serif" ? o.fontFamily : DEFAULT_CV_DEFAULTS.fontFamily;
  const fontSize = o.fontSize === "10" || o.fontSize === "11" || o.fontSize === "12" ? o.fontSize : DEFAULT_CV_DEFAULTS.fontSize;
  const lineSpacing =
    o.lineSpacing === "compact" || o.lineSpacing === "normal" || o.lineSpacing === "relaxed"
      ? o.lineSpacing
      : DEFAULT_CV_DEFAULTS.lineSpacing;
  const dateFormat =
    o.dateFormat === "F Y" || o.dateFormat === "M Y" || o.dateFormat === "m/Y" || o.dateFormat === "Y"
      ? o.dateFormat
      : DEFAULT_CV_DEFAULTS.dateFormat;

  return {
    pageSize,
    marginTop: typeof o.marginTop === "string" && o.marginTop.trim() ? o.marginTop : DEFAULT_CV_DEFAULTS.marginTop,
    marginBottom: typeof o.marginBottom === "string" && o.marginBottom.trim() ? o.marginBottom : DEFAULT_CV_DEFAULTS.marginBottom,
    marginLeft: typeof o.marginLeft === "string" && o.marginLeft.trim() ? o.marginLeft : DEFAULT_CV_DEFAULTS.marginLeft,
    marginRight: typeof o.marginRight === "string" && o.marginRight.trim() ? o.marginRight : DEFAULT_CV_DEFAULTS.marginRight,
    fontFamily,
    fontSize,
    lineSpacing,
    showPageNumbers: typeof o.showPageNumbers === "boolean" ? o.showPageNumbers : DEFAULT_CV_DEFAULTS.showPageNumbers,
    showLastUpdated: typeof o.showLastUpdated === "boolean" ? o.showLastUpdated : DEFAULT_CV_DEFAULTS.showLastUpdated,
    dateFormat
  };
}

function parseCookieConsent(raw: unknown): CookieConsent {
  const o = asRecord(raw);
  return {
    functional: typeof o.functional === "boolean" ? o.functional : DEFAULT_COOKIE_CONSENT.functional,
    analytics: typeof o.analytics === "boolean" ? o.analytics : DEFAULT_COOKIE_CONSENT.analytics,
    marketing: typeof o.marketing === "boolean" ? o.marketing : DEFAULT_COOKIE_CONSENT.marketing
  };
}

function parseAppearance(raw: unknown): AppearancePrefs {
  const o = asRecord(raw);
  return {
    density: o.density === "compact" ? "compact" : "comfortable",
    defaultNavCollapsed: Boolean(o.defaultNavCollapsed)
  };
}

export async function ensureUserPreferences(userId: string) {
  const existing = await prisma.userPreferences.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.userPreferences.create({
    data: {
      userId,
      marketingEmails: true,
      marketingSms: false,
      productUpdates: true,
      cookieConsentJson: DEFAULT_COOKIE_CONSENT,
      cvDefaultsJson: DEFAULT_CV_DEFAULTS,
      appearanceJson: DEFAULT_APPEARANCE,
      agentMemoryEnabled: true
    }
  });
}

export type SettingsPayload = {
  account: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: string;
  };
  privacy: {
    marketingEmails: boolean;
    marketingSms: boolean;
    productUpdates: boolean;
    cookieConsent: CookieConsent;
    termsAcceptedAt: string | null;
    privacyAcceptedAt: string | null;
  };
  cvDefaults: CvDefaults;
  appearance: AppearancePrefs;
  ai: {
    agentMemoryEnabled: boolean;
  };
};

export async function getSettingsForUser(user: Pick<User, "id" | "name" | "email" | "emailVerified" | "image" | "createdAt">): Promise<SettingsPayload> {
  const prefs = await ensureUserPreferences(user.id);

  return {
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt.toISOString()
    },
    privacy: {
      marketingEmails: prefs.marketingEmails,
      marketingSms: prefs.marketingSms,
      productUpdates: prefs.productUpdates,
      cookieConsent: parseCookieConsent(prefs.cookieConsentJson),
      termsAcceptedAt: prefs.termsAcceptedAt?.toISOString() ?? null,
      privacyAcceptedAt: prefs.privacyAcceptedAt?.toISOString() ?? null
    },
    cvDefaults: parseCvDefaults(prefs.cvDefaultsJson),
    appearance: parseAppearance(prefs.appearanceJson),
    ai: {
      agentMemoryEnabled: prefs.agentMemoryEnabled
    }
  };
}

export type UpdateSettingsInput = {
  privacy?: Partial<{
    marketingEmails: boolean;
    marketingSms: boolean;
    productUpdates: boolean;
    cookieConsent: Partial<CookieConsent>;
    acceptTerms: boolean;
    acceptPrivacy: boolean;
  }>;
  cvDefaults?: Partial<CvDefaults>;
  appearance?: Partial<AppearancePrefs>;
  ai?: Partial<{ agentMemoryEnabled: boolean }>;
  account?: Partial<{ name: string }>;
};

export async function updateSettingsForUser(
  user: Pick<User, "id" | "name" | "email" | "emailVerified" | "image" | "createdAt">,
  input: UpdateSettingsInput
): Promise<SettingsPayload> {
  await ensureUserPreferences(user.id);
  const current = await prisma.userPreferences.findUniqueOrThrow({ where: { userId: user.id } });

  const nextCookie = {
    ...parseCookieConsent(current.cookieConsentJson),
    ...(input.privacy?.cookieConsent ?? {})
  };
  const nextCv = {
    ...parseCvDefaults(current.cvDefaultsJson),
    ...(input.cvDefaults ?? {})
  };
  const nextAppearance = {
    ...parseAppearance(current.appearanceJson),
    ...(input.appearance ?? {})
  };

  if (input.account?.name && input.account.name.trim() && input.account.name.trim() !== user.name) {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: input.account.name.trim().slice(0, 120) }
    });
  }

  const nextMarketingEmails = input.privacy?.marketingEmails ?? current.marketingEmails;

  await prisma.userPreferences.update({
    where: { userId: user.id },
    data: {
      marketingEmails: nextMarketingEmails,
      marketingSms: input.privacy?.marketingSms ?? current.marketingSms,
      productUpdates: input.privacy?.productUpdates ?? current.productUpdates,
      cookieConsentJson: nextCookie,
      cvDefaultsJson: parseCvDefaults(nextCv),
      appearanceJson: nextAppearance,
      agentMemoryEnabled: input.ai?.agentMemoryEnabled ?? current.agentMemoryEnabled,
      termsAcceptedAt: input.privacy?.acceptTerms ? new Date() : current.termsAcceptedAt,
      privacyAcceptedAt: input.privacy?.acceptPrivacy ? new Date() : current.privacyAcceptedAt
    }
  });

  // Keep Brevo marketing list in sync when opt-in preference changes.
  if (
    input.privacy?.marketingEmails !== undefined &&
    input.privacy.marketingEmails !== current.marketingEmails
  ) {
    void import("@/lib/email")
      .then(({ syncMarketingContact }) =>
        syncMarketingContact({
          email: user.email,
          name: input.account?.name?.trim() || user.name,
          marketingOptIn: nextMarketingEmails,
          attributes: { SOURCE: "cvscholar_settings" }
        })
      )
      .catch((error) => console.error("[settings/email] contact sync failed", error));
  }

  const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  return getSettingsForUser(refreshed);
}
