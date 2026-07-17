import type { WebsitePageKey } from "./constants";

export type AcademicCategoryKey = "research" | "journey" | "contributions";

export type WebsiteSectionEntry = {
  id: string;
  sectionKey: string;
  data: Record<string, string>;
};
export type CompositionReason =
  | "qualified"
  | "merged_into_home"
  | "merged_into_journey"
  | "hidden_by_user"
  | "empty";

export type CompositionStrength = "strong" | "developing" | "merged" | "empty";

export type WebsiteContentModule = {
  key: string;
  label: string;
  category: AcademicCategoryKey;
  entries: WebsiteSectionEntry[];
  anchor: boolean;
  featured: boolean;
};

export type WebsiteCompositionPage = {
  key: AcademicCategoryKey;
  label: string;
  description: string;
  narrative: string;
  score: number;
  strength: CompositionStrength;
  reason: CompositionReason;
  modules: WebsiteContentModule[];
};

export type WebsiteComposition = {
  mode: "sparse" | "developing" | "rich";
  pages: WebsiteCompositionPage[];
  categories: Record<AcademicCategoryKey, WebsiteCompositionPage>;
  homeModules: WebsiteContentModule[];
  navigation: WebsitePageKey[];
};
