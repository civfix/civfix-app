/**
 * The expanded (landscape) shell's frame plan: the single source for where the top nav strip ends,
 * whether the card is on screen, and how much of the map is hidden behind them. Every derived number is a
 * function of the numbers above it, never a literal: the shell, the nav strip, the map camera, the location
 * picker and the web host's `--cf-occlusion-left` all read these, so a moved width cannot go stale in one
 * of them.
 *
 * Pure: RN-free and theme-free (the theme pulls `Platform`), so it unit-tests under vitest.
 */
import { space } from "@civfix/shared/tokens"
import { parentViewForEntry, type DetailEntry, type LayoutMode, type View } from "../nav"
import { HEADER_CONTROL_SIZE } from "../primitives/headerControls"
import { DOCK_GAP, DOCK_H } from "../surface/liquidGlass/liquidGlassModel"

/** Shared with the card's own left inset. */
export const NAV_LEFT = 14
export const NAV_TOP = 14
/** The portrait dock laid flat. */
export const NAV_H = DOCK_H
export const NAV_GAP = DOCK_GAP
export const NAV_FOOTPRINT = NAV_TOP + NAV_H + NAV_GAP
/** The card is user-resizable, so on an 840px tablet an unbounded drag could bury the map entirely. */
export const MAP_MIN_CLEAR = 280

export const RAIL_ITEM = 56
export const RAIL_ITEM_GAP = 10
export const RAIL_PAD_H = 10
/**
 * `TAB_SPECS.length`, stated as a literal to keep this module free of the tabBarLogic -> theme/motion
 * import chain; the test pins the two together.
 */
export const RAIL_TAB_COUNT = 4
export const RAIL_CAPSULE_W =
  RAIL_PAD_H * 2 + RAIL_ITEM * RAIL_TAB_COUNT + RAIL_ITEM_GAP * (RAIL_TAB_COUNT - 1)
export const RAIL_CAPSULE_H = NAV_H
export const RAIL_CAPSULE_RADIUS = RAIL_CAPSULE_H / 2
/** One orb for the portrait dock and the rail. */
export const DOCK_ORB = 58

export const RAIL_BRAND_SIZE = 27
export const RAIL_BRAND_PAD_H = space["5"]
export const RAIL_BRAND_GLYPH_EM = 2.6
export const RAIL_BRAND_W = Math.ceil(RAIL_BRAND_PAD_H * 2 + RAIL_BRAND_SIZE * RAIL_BRAND_GLYPH_EM)

export const MAP_ACTION_SIZE = HEADER_CONTROL_SIZE
export const MAP_ACTION_GAP = space["2"]
export const MAP_ACTION_COUNT = 5
export const MAP_ACTIONS_RIGHT = space["3"]
export const MAP_SIGN_IN_PAD_H = space["4"]
export const MAP_SIGN_IN_FONT = 14
export const MAP_SIGN_IN_LABEL_EM = 6
export const MAP_SIGN_IN_W = Math.ceil(MAP_SIGN_IN_PAD_H * 2 + MAP_SIGN_IN_FONT * MAP_SIGN_IN_LABEL_EM)
export const MAP_PROFILE_EXTRA = Math.max(MAP_SIGN_IN_W - MAP_ACTION_SIZE, 0)

export const EXPANDED_LEFT_CLUSTER_W =
  NAV_LEFT + RAIL_BRAND_W + NAV_GAP + RAIL_CAPSULE_W + NAV_GAP + DOCK_ORB
export const EXPANDED_RIGHT_ACTIONS_W =
  MAP_ACTIONS_RIGHT +
  MAP_ACTION_SIZE * MAP_ACTION_COUNT +
  MAP_ACTION_GAP * (MAP_ACTION_COUNT - 1) +
  MAP_PROFILE_EXTRA
export const EXPANDED_CLUSTER_BREATHING = NAV_GAP * 2
export const EXPANDED_MIN_WIDTH =
  EXPANDED_LEFT_CLUSTER_W + EXPANDED_RIGHT_ACTIONS_W + EXPANDED_CLUSTER_BREATHING

export function expandedFits(width: number): boolean {
  return width >= EXPANDED_MIN_WIDTH
}

export function layoutModeFor(width: number, height: number): LayoutMode {
  return width >= height && expandedFits(width) ? "expanded" : "compact"
}

export function railItemLeft(index: number): number {
  return RAIL_PAD_H + index * (RAIL_ITEM + RAIL_ITEM_GAP)
}

export interface ExpandedFrameInput {
  view: View
  stackLength: number
  /** Already viewport-clamped (`clampSidebarWidth`). */
  sidebarWidth: number
}

export interface ExpandedFrame {
  /** On the Map tab with nothing stacked the card animates out but stays mounted, so a pin tap brings it straight back. */
  cardVisible: boolean
  /** px hidden from the left edge. The nav strip is a top bar, so with the card hidden only the inset remains. */
  occlusionLeft: number
}

export function expandedFramePlan({ view, stackLength, sidebarWidth }: ExpandedFrameInput): ExpandedFrame {
  const cardVisible = view !== "map" || stackLength > 0
  return {
    cardVisible,
    occlusionLeft: cardVisible ? NAV_LEFT + sidebarWidth : NAV_LEFT,
  }
}

/**
 * An open detail answers with the list that owns it, because the rail describes where the user is, not
 * which tab they last tapped. Null when the detail belongs to no list (profile, activity, settings): the
 * same "no lozenge" state as the portrait dock's `activeTabIndex` of -1.
 */
export function railActiveView(view: View, active: DetailEntry | null): View | null {
  return active ? parentViewForEntry(active) : view
}
