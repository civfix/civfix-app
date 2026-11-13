import { ACTIVE_SEASON, type SeasonName } from "@civfix/ui/theme/season"
import { ICON_PATH } from "./site-meta"

// Not in site-meta: the Pages Functions import that file and stay free of @civfix/ui.
const SEASON_ICON_PATHS: Readonly<Record<SeasonName, string>> = {
  none: ICON_PATH,
  christmas: "/favicon-christmas.svg",
}

export function iconPathFor(season: SeasonName): string {
  return SEASON_ICON_PATHS[season]
}

/** The browser-tab icon the manifest and the page head point at. */
export const ACTIVE_ICON_PATH = iconPathFor(ACTIVE_SEASON)
