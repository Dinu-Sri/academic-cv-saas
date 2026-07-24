import type { WebsiteComposition, WebsiteContentModule, WebsiteSectionEntry } from "./composition-types";
import { WEBSITE_SECTION_BY_KEY } from "./section-registry";

export type HomeMetric = { label: string; value: number };

export type HomeHighlight = {
  label: string;
  title: string;
  meta: string;
  sectionKey: string;
  entryId: string;
};

type SectionBag = Record<string, WebsiteSectionEntry[] | undefined>;

/** End-year score from year / years / date; "present" ranks as current year + 1. */
export function entryRecencyScore(entry: WebsiteSectionEntry): number {
  const data = entry.data || {};
  const raw = String(data.years || data.year || data.date || "");
  if (!raw.trim()) return 0;
  if (/present|current|ongoing/i.test(raw)) return new Date().getFullYear() + 1;
  const years = raw.match(/\d{4}/g);
  if (!years?.length) return 0;
  return Math.max(...years.map(Number));
}

export function mostRecentEntry(entries: WebsiteSectionEntry[] | undefined): WebsiteSectionEntry | null {
  if (!entries?.length) return null;
  return [...entries].sort((a, b) => entryRecencyScore(b) - entryRecencyScore(a))[0] || null;
}

/**
 * Metrics band: only real non-zero counts from CV sections.
 * Never invent citations or placeholder stats.
 */
export function buildHomeMetrics(sections: SectionBag): HomeMetric[] {
  const candidates: Array<[string, number]> = [
    ["Publications", sections.publications?.length || 0],
    ["Projects", sections.projects?.length || 0],
    ["Teaching", sections.teaching?.length || 0],
    ["Supervision", sections.supervision?.length || 0],
    ["Education", sections.education?.length || 0],
    ["Roles", (sections.academic_appointments?.length || 0) + (sections.experience?.length || 0)],
    ["Awards", sections.awards?.length || 0]
  ];
  return candidates
    .filter(([, value]) => value > 0)
    .slice(0, 4)
    .map(([label, value]) => ({ label, value }));
}

/**
 * Home highlights: prefer most recent project → publication → award,
 * then appointment → education → teaching. Max 3 distinct labels.
 */
export function buildHomeHighlights(sections: SectionBag): HomeHighlight[] {
  const slots: Array<{
    label: string;
    sectionKey: string;
    titleFields: string[];
    metaFields: string[];
  }> = [
    { label: "Project", sectionKey: "projects", titleFields: ["title", "name"], metaFields: ["role", "years", "year", "organization", "funder"] },
    {
      label: "Publication",
      sectionKey: "publications",
      titleFields: ["title"],
      metaFields: ["venue", "year", "authors"]
    },
    { label: "Recognition", sectionKey: "awards", titleFields: ["title", "name"], metaFields: ["issuer", "year"] },
    {
      label: "Role",
      sectionKey: "academic_appointments",
      titleFields: ["title", "role"],
      metaFields: ["institution", "years", "year", "location"]
    },
    {
      label: "Experience",
      sectionKey: "experience",
      titleFields: ["title", "role"],
      metaFields: ["organization", "years", "year", "location"]
    },
    {
      label: "Education",
      sectionKey: "education",
      titleFields: ["degree", "title", "name"],
      metaFields: ["institution", "year", "field"]
    },
    {
      label: "Teaching",
      sectionKey: "teaching",
      titleFields: ["course", "title", "name"],
      metaFields: ["role", "institution", "years", "year"]
    }
  ];

  const out: HomeHighlight[] = [];
  const seen = new Set<string>();

  for (const slot of slots) {
    if (out.length >= 3) break;
    if (seen.has(slot.label)) continue;
    const entry = mostRecentEntry(sections[slot.sectionKey]);
    if (!entry) continue;
    const title =
      slot.titleFields.map((field) => entry.data[field]).find(Boolean) ||
      entry.data.title ||
      entry.data.name ||
      slot.label;
    const meta = slot.metaFields
      .map((field) => entry.data[field])
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index && value !== title)
      .slice(0, 3)
      .join(" · ");
    out.push({
      label: slot.label,
      title,
      meta,
      sectionKey: slot.sectionKey,
      entryId: entry.id
    });
    seen.add(slot.label);
  }

  return out;
}

/**
 * Full modules merged onto Home (sparse / thin categories).
 * Prefer composition.homeModules; fall back to preferred keys with content.
 */
export function resolveHomeBodyModules(
  sections: SectionBag,
  composition: WebsiteComposition
): WebsiteContentModule[] {
  if (composition.homeModules.length > 0) {
    return composition.homeModules;
  }
  if (composition.mode !== "sparse") return [];

  const preferred = [
    "projects",
    "publications",
    "academic_appointments",
    "experience",
    "education",
    "teaching",
    "awards",
    "languages"
  ];
  const modules: WebsiteContentModule[] = [];
  for (const key of preferred) {
    const entries = sections[key] || [];
    const definition = WEBSITE_SECTION_BY_KEY.get(key);
    if (!entries.length || !definition) continue;
    modules.push({
      key,
      label: definition.label,
      category: definition.category,
      entries,
      anchor: Boolean(definition.anchor),
      featured: false
    });
  }
  return modules;
}
