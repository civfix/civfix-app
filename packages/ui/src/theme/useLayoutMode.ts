/**
 * Orientation layout-mode seam for the unified community UI.
 *
 * The two faithful designs are selected by ORIENTATION and by whether the expanded chrome FITS: a
 * LANDSCAPE (or square) window at least `EXPANDED_MIN_WIDTH` wide renders the "expanded" presentation (the
 * original web persistent sidebar + detail panes over a full-bleed map with zoom + attribution chrome);
 * every other window - PORTRAIT, or a landscape one too narrow to carry the nav cluster beside the map's
 * action row - renders the "compact" presentation (the original mobile single column with bottom sheets
 * and a chrome-free map). The decision is `layoutModeFor` in the tested frame plan, so a rotation flips
 * the whole presentation. Driven by react-native's useWindowDimensions so it tracks rotation / window
 * resize on both native (Metro) and web (react-native-web) without any platform branch.
 */
import { useWindowDimensions } from "react-native"
import { layoutModeFor, type LayoutMode } from "../shell/expandedFramePlan"

export type { LayoutMode }

/** Current layout mode: landscape AND wide enough for the chrome -> expanded (sidebar), else compact (sheet). */
export function useLayoutMode(): LayoutMode {
  const { width, height } = useWindowDimensions()
  return layoutModeFor(width, height)
}
