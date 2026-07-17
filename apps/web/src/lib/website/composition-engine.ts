import type { WebsitePageKey } from "./constants";
import { categoryQualifies, cleanPublicEntries, scoreCategory } from "./content-strength";
import {
  ACADEMIC_CATEGORY_META,
  WEBSITE_SECTION_REGISTRY
} from "./section-registry";
import type {
  AcademicCategoryKey,
  WebsiteComposition,
  WebsiteCompositionPage,
  WebsiteContentModule,
  WebsiteSectionEntry
} from "./composition-types";

const CATEGORY_KEYS: AcademicCategoryKey[] = ["research", "journey", "contributions"];

type CompositionInput = {
  entries: WebsiteSectionEntry[];
  narratives: Partial<Record<AcademicCategoryKey, string>>;
  sectionVisibility: Record<string, boolean>;
  enabledPages: Record<string, boolean>;
  featuredEntryIds?: string[];
  contactEnabled: boolean;
};

export function composeAcademicWebsite(input: CompositionInput): WebsiteComposition {
  const featuredIds = new Set(input.featuredEntryIds || []);
  const visibleEntries = cleanPublicEntries(input.entries);
  const categories = Object.fromEntries(
    CATEGORY_KEYS.map((category) => {
      const modules = WEBSITE_SECTION_REGISTRY.filter((section) => section.category === category)
        .filter((section) => input.sectionVisibility[section.visibilityKey] !== false)
        .map<WebsiteContentModule>((section) => {
          const entries = visibleEntries.filter((entry) => entry.sectionKey === section.key);
          return {
            key: section.key,
            label: section.label,
            category,
            entries,
            anchor: Boolean(section.anchor),
            featured: entries.some((entry) => featuredIds.has(entry.id))
          };
        })
        .filter((module) => module.entries.length > 0);
      return [category, buildCandidate(category, modules, input.narratives[category] || "", input.enabledPages[category] !== false)];
    })
  ) as Record<AcademicCategoryKey, WebsiteCompositionPage>;

  const pages: WebsiteCompositionPage[] = [];
  const homeModules: WebsiteContentModule[] = [];

  for (const key of ["research", "journey"] as const) {
    const candidate = categories[key];
    if (candidate.reason === "qualified") pages.push(candidate);
    else homeModules.push(...candidate.modules);
  }

  const contributions = categories.contributions;
  if (contributions.reason === "qualified") {
    pages.push(contributions);
  } else if (contributions.modules.length > 0 && categories.journey.reason === "qualified") {
    categories.contributions = { ...contributions, strength: "merged", reason: "merged_into_journey" };
    categories.journey = {
      ...categories.journey,
      modules: [...categories.journey.modules, ...contributions.modules]
    };
    const journeyIndex = pages.findIndex((page) => page.key === "journey");
    if (journeyIndex >= 0) pages[journeyIndex] = categories.journey;
  } else {
    homeModules.push(...contributions.modules);
  }

  const navigation: WebsitePageKey[] = ["home", ...pages.map((page) => page.key)];
  if (input.contactEnabled && input.enabledPages.contact !== false) navigation.push("contact");

  const contentPageCount = pages.length;
  return {
    mode: contentPageCount === 0 ? "sparse" : contentPageCount === 3 ? "rich" : "developing",
    pages,
    categories,
    homeModules: dedupeModules(homeModules),
    navigation
  };
}
function buildCandidate(
  key: AcademicCategoryKey,
  modules: WebsiteContentModule[],
  narrative: string,
  enabled: boolean
): WebsiteCompositionPage {
  const score = scoreCategory(modules, narrative);
  const qualifies = categoryQualifies(modules, narrative, score);
  const hasContent = modules.length > 0 || narrative.trim().length > 0;
  const reason = !hasContent ? "empty" : !enabled ? "hidden_by_user" : qualifies ? "qualified" : "merged_into_home";
  const strength = reason === "empty" ? "empty" : reason === "qualified" ? (score >= 6 || modules.length >= 3 ? "strong" : "developing") : "merged";

  return {
    key,
    label: ACADEMIC_CATEGORY_META[key].label,
    description: ACADEMIC_CATEGORY_META[key].description,
    narrative: narrative.trim(),
    score,
    strength,
    reason,
    modules
  };
}

function dedupeModules(modules: WebsiteContentModule[]) {
  const seen = new Set<string>();
  return modules.filter((module) => {
    if (seen.has(module.key)) return false;
    seen.add(module.key);
    return true;
  });
}
