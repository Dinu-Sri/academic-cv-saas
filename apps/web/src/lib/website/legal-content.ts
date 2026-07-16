/** Platform legal copy for Scholar Pages public sites (footer links). */

export type LegalPageKey = "privacy" | "terms" | "cookies";

export const LEGAL_PAGE_KEYS = ["privacy", "terms", "cookies"] as const;

export const LEGAL_PAGE_LABELS: Record<LegalPageKey, string> = {
  privacy: "Privacy",
  terms: "Terms",
  cookies: "Cookies"
};

export function isLegalPageKey(value: string): value is LegalPageKey {
  return (LEGAL_PAGE_KEYS as readonly string[]).includes(value);
}

export function getLegalPage(key: LegalPageKey): { title: string; updated: string; paragraphs: string[] } {
  const updated = "16 July 2026";
  switch (key) {
    case "privacy":
      return {
        title: "Privacy",
        updated,
        paragraphs: [
          "This academic website is hosted by CVScholar. We process limited technical data needed to serve the site securely (for example connection and security signals).",
          "Privacy-safe page view counters may record how often each page path is opened. These counters do not store your name, email, or advertising profile, and they are not used to track you across other websites.",
          "If you use a contact form, the message you submit (and any details you choose to include) is delivered to the site owner. Do not send sensitive personal data you do not want the site owner to receive.",
          "Theme preference and cookie acceptance choices, when stored, remain in your browser (local storage) and are not used for advertising.",
          "For platform-level privacy questions about CVScholar itself, contact the CVScholar support channels listed on the main CVScholar website."
        ]
      };
    case "terms":
      return {
        title: "Terms of use",
        updated,
        paragraphs: [
          "This site is a personal academic website published by its author and hosted on CVScholar infrastructure.",
          "Content is provided for scholarly and professional information. Unless the author states otherwise, you may link to public pages and cite published work according to normal academic practice.",
          "Do not misuse the contact form (spam, harassment, or automated bulk messaging). The host may rate-limit or block abusive traffic to protect the site and its users.",
          "CVScholar provides hosting and tooling; the academic content remains the responsibility of the site author. CVScholar does not guarantee uninterrupted availability.",
          "These terms may be updated as the product evolves. Continued use of the public site after updates constitutes acceptance of the revised terms where applicable."
        ]
      };
    case "cookies":
      return {
        title: "Cookies",
        updated,
        paragraphs: [
          "This site aims to use a minimal, privacy-respecting approach.",
          "Essential technical storage may be used so the site functions (for example security checks on the contact form when enabled).",
          "Your browser may store a simple preference for light or dark appearance and whether you accepted this cookie notice. These preferences stay on your device.",
          "We do not use advertising cookies or third-party ad trackers on Scholar Pages public sites.",
          "You can clear site data in your browser settings at any time. Declining non-essential storage is supported by dismissing or ignoring optional prompts where offered; essential security features may still apply."
        ]
      };
  }
}
