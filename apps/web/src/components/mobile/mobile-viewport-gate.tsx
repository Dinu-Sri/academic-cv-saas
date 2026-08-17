"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isMobileFlowEnabled, isMobileShellPath, isPowerProductPath } from "@/lib/mobile/constants";
import { isNarrowPhoneViewport, readMobileModePreference } from "@/lib/mobile/preference";

/**
 * Client-side safety net: narrow viewports hitting power routes → /m
 * (covers cases where UA is ambiguous but width is phone-sized).
 */
export function MobileViewportGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isMobileFlowEnabled()) return;
    if (!pathname || isMobileShellPath(pathname)) return;
    if (readMobileModePreference() === "full") return;
    if (!isNarrowPhoneViewport()) return;
    if (!isPowerProductPath(pathname)) return;
    router.replace("/m");
  }, [pathname, router]);

  return null;
}
