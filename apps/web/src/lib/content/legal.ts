import fs from "node:fs";
import path from "node:path";
import { asString, splitFrontmatter } from "@/lib/content/frontmatter";
import { renderMarkdown } from "@/lib/content/markdown";
import { contentPath } from "@/lib/content/paths";

export type LegalPageKey = "privacy" | "terms" | "cookies" | "refund";

export type LegalPage = {
  key: LegalPageKey;
  title: string;
  slug: string;
  path: string;
  description: string;
  updated: string;
  bodyHtml: string;
};

const LEGAL_FILES: Record<LegalPageKey, { file: string; defaultPath: string; defaultTitle: string }> = {
  privacy: { file: "privacy.md", defaultPath: "/privacy", defaultTitle: "Privacy Policy" },
  terms: { file: "terms.md", defaultPath: "/terms", defaultTitle: "Terms of Use" },
  cookies: { file: "cookies.md", defaultPath: "/cookie-policy", defaultTitle: "Cookie Policy" },
  refund: { file: "refund.md", defaultPath: "/refund-policy", defaultTitle: "Refund Policy" }
};

export const LEGAL_NAV: { key: LegalPageKey; href: string; label: string }[] = [
  { key: "privacy", href: "/privacy", label: "Privacy" },
  { key: "terms", href: "/terms", label: "Terms" },
  { key: "cookies", href: "/cookie-policy", label: "Cookies" },
  { key: "refund", href: "/refund-policy", label: "Refunds" }
];

export function getLegalPage(key: LegalPageKey): LegalPage {
  const meta = LEGAL_FILES[key];
  const filepath = contentPath("legal", meta.file);

  let raw = "";
  try {
    raw = fs.readFileSync(filepath, "utf8");
  } catch {
    const { html } = renderMarkdown(
      `## Unavailable\n\nThis policy document is not available in this environment. Please contact support.`
    );
    return {
      key,
      title: meta.defaultTitle,
      slug: key,
      path: meta.defaultPath,
      description: meta.defaultTitle,
      updated: "",
      bodyHtml: html
    };
  }

  const { data, body } = splitFrontmatter(raw);
  const { html } = renderMarkdown(body);

  return {
    key,
    title: asString(data.title, meta.defaultTitle),
    slug: asString(data.slug, key),
    path: asString(data.path, meta.defaultPath),
    description: asString(data.description, meta.defaultTitle),
    updated: asString(data.updated),
    bodyHtml: html
  };
}

export function getAllLegalPages(): LegalPage[] {
  return (Object.keys(LEGAL_FILES) as LegalPageKey[]).map(getLegalPage);
}

export function formatLegalUpdated(updated: string): string {
  if (!updated) return "";
  // Accept YYYY-MM-DD
  const d = new Date(`${updated}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return updated;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

export function legalFileExists(key: LegalPageKey): boolean {
  return fs.existsSync(path.join(contentPath("legal"), LEGAL_FILES[key].file));
}
