/** Classify a User-Agent into a coarse device class (legacy-compatible). */

export type DeviceClass = "mobile" | "tablet" | "desktop" | "unknown";

export function classifyUserAgent(userAgent?: string | null): DeviceClass {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone|opera mini|blackberry/.test(ua)) return "mobile";
  if (/mozilla|chrome|safari|firefox|edge|msie|trident|windows|macintosh|linux|cros/.test(ua)) {
    return "desktop";
  }
  return "unknown";
}

export function deviceLabel(device: DeviceClass): string {
  switch (device) {
    case "mobile":
      return "Mobile";
    case "tablet":
      return "Tablet";
    case "desktop":
      return "Desktop";
    default:
      return "Unknown";
  }
}
