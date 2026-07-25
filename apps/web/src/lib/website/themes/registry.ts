import paperV1 from "./paper-academic-v1/theme.json";
import { DEFAULT_SITE_THEME_ID, type SiteThemeId } from "../site-engine/types";

export type SiteThemeMeta = {
  id: string;
  name: string;
  version: string;
  cssPath: string;
  rootClass: string;
  tokens: Record<string, string>;
  description: string;
};

const THEMES: Record<string, SiteThemeMeta> = {
  [paperV1.id]: paperV1 as SiteThemeMeta
};

export function getSiteTheme(themeId?: SiteThemeId): SiteThemeMeta {
  const id = themeId || DEFAULT_SITE_THEME_ID;
  return THEMES[id] || THEMES[DEFAULT_SITE_THEME_ID];
}

export function listSiteThemes(): SiteThemeMeta[] {
  return Object.values(THEMES);
}
