import type { SiteSectionModule } from "./types";

/** Map section key → IR presentation enum (theme chooses exact layout). */
export function presentationForSection(sectionKey: string): SiteSectionModule["presentation"] {
  if (sectionKey === "publications") return "publication_list";
  if (sectionKey === "research_interests" || sectionKey === "skills" || sectionKey === "languages") {
    return "chip_list";
  }
  if (sectionKey === "research_interests") return "chip_and_rows";
  return "row_list";
}
