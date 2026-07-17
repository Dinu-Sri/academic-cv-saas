import type { WebsiteContentModule, WebsiteSectionEntry } from "./composition-types";

const IGNORED_VALUE_KEYS = new Set(["id", "entry_order", "archived_at"]);

export function entryHasPublicContent(entry: WebsiteSectionEntry) {
  return Object.entries(entry.data).some(
    ([key, value]) => !IGNORED_VALUE_KEYS.has(key.toLowerCase()) && typeof value === "string" && value.trim().length > 0
  );
}

export function cleanPublicEntries(entries: WebsiteSectionEntry[]) {
  return entries
    .filter(entryHasPublicContent)
    .map((entry) => ({
      ...entry,
      data: Object.fromEntries(
        Object.entries(entry.data)
          .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
          .map(([key, value]) => [key, value.trim()])
      )
    }));
}

export function scoreCategory(modules: WebsiteContentModule[], narrative: string) {
  let score = narrative.trim().length >= 100 ? 2 : 0;
  for (const contentModule of modules) {
    score += contentModule.entries.length >= 3 ? 2 : 1;
  }
  if (modules.length >= 2) score += 1;
  if (modules.some((module) => module.featured)) score += 1;
  return score;
}

export function categoryQualifies(modules: WebsiteContentModule[], narrative: string, score: number) {
  const substantialAnchor = modules.some((module) => module.anchor && module.entries.length >= 4);
  const enrichedAnchor = modules.some((module) => module.anchor && module.entries.length >= 2) && narrative.trim().length >= 100;
  return substantialAnchor || enrichedAnchor || (modules.length >= 2 && score >= 3);
}
