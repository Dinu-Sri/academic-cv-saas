export type CvDefaults = {
  pageSize: "A4" | "Letter" | "Legal";
  marginTop: string;
  marginBottom: string;
  marginLeft: string;
  marginRight: string;
  fontFamily: "serif" | "sans";
  fontSize: "10" | "11" | "12";
  lineSpacing: "compact" | "normal" | "relaxed";
  showPageNumbers: boolean;
  showLastUpdated: boolean;
  dateFormat: "F Y" | "M Y" | "m/Y" | "Y";
};

export type CookieConsent = {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

export type AppearancePrefs = {
  density: "comfortable" | "compact";
  defaultNavCollapsed: boolean;
};

export const DEFAULT_CV_DEFAULTS: CvDefaults = {
  pageSize: "A4",
  marginTop: "1in",
  marginBottom: "1in",
  marginLeft: "1in",
  marginRight: "1in",
  fontFamily: "serif",
  fontSize: "11",
  lineSpacing: "normal",
  showPageNumbers: true,
  showLastUpdated: true,
  dateFormat: "F Y"
};

export const DEFAULT_COOKIE_CONSENT: CookieConsent = {
  functional: true,
  analytics: false,
  marketing: false
};

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  density: "comfortable",
  defaultNavCollapsed: false
};

export type SettingsSectionId = "account" | "privacy" | "cv" | "ai" | "appearance";

export const SETTINGS_SECTIONS: {
  id: SettingsSectionId;
  label: string;
  description: string;
}[] = [
  { id: "account", label: "Account", description: "Name, email, password" },
  { id: "privacy", label: "Privacy", description: "Marketing, cookies, agreements" },
  { id: "cv", label: "CV defaults", description: "PDF page, fonts, footer" },
  { id: "ai", label: "AI & memory", description: "What CVScholar remembers" },
  { id: "appearance", label: "Appearance", description: "App layout preferences" }
];

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((s) => s.id === value);
}
