"use client";

import { MOBILE_MODE_COOKIE, type MobileModePreference } from "@/lib/mobile/constants";

const CLIENT_MODE_KEY = "cvscholar_mobile_mode";

export function readMobileModePreference(): MobileModePreference {
  if (typeof document === "undefined") return "minimal";
  try {
    const fromLs = window.localStorage.getItem(CLIENT_MODE_KEY);
    if (fromLs === "full" || fromLs === "minimal") return fromLs;
  } catch {
    // ignore
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${MOBILE_MODE_COOKIE}=([^;]*)`));
  const v = match?.[1] ? decodeURIComponent(match[1]) : "";
  return v === "full" ? "full" : "minimal";
}

export function writeMobileModePreference(mode: MobileModePreference) {
  if (typeof document === "undefined") return;
  try {
    window.localStorage.setItem(CLIENT_MODE_KEY, mode);
  } catch {
    // ignore
  }
  const maxAge = 365 * 24 * 60 * 60;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${MOBILE_MODE_COOKIE}=${encodeURIComponent(mode)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent("cvscholar-mobile-mode", { detail: { mode } }));
}

/** Narrow phone viewport (not tablet widths). */
export function isNarrowPhoneViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}
