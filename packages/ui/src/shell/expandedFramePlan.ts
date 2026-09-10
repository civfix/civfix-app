/**
 * THE expanded (landscape) shell's FRAME PLAN - the single source of truth for where the top nav strip
 * ends, whether the card is on screen, and how much of the map is hidden behind them.
 *
 * THE RULE (postCardRhythm / portrait-shell house style): every derived number is a FUNCTION of the numbers
 * above it. The card's top edge is not "90"; it is `NAV_TOP + NAV_H + NAV_GAP`. The map's occluded
 * strip is not "384 + 28"; it is `NAV_LEFT + the LIVE card width`, or the bare inset when the card is
 * dismissed.
 *
 * WHY IT EXISTS: the landscape shell's geometry used to live in three places that could not see each other -
 * ExpandedShell's private StyleSheet (the 14px inset), `map/dropPinCamera`'s `sidebarWidth` parameter (which
 * documents dropping the inset because "the literal is not exported"), and the web host's attribution rule
 * (a hardcoded `calc(384px + 28px)` that went stale the moment the default width moved). One tested module
 * kills that bug class: the shell, the nav strip, the map camera, the location picker and the web host's
 * `--cf-occlusion-left` custom property all read the same two functions.
 *
 * THE NAV STRIP IS A HORIZONTAL TOP BAR, in-line with the civfix wordmark's original top-left position -
 * NOT a vertical rail beside the card. It floats at the window's top-left corner (the same `NAV_LEFT`/
 * `NAV_TOP` inset the card itself uses), and the card sits BELOW it rather than beside it, so the card's
 * `left` returns to the shell's own inset and only its `top` is pushed down. The bar's cross-axis size
 * (`NAV_H`) is the portrait dock's own height (`theme.glass.dock.height`) laid flat, exactly as the old
 * vertical rail borrowed the same constant for its column width - the landscape chrome still inherits the
 * phone's spacing, just oriented the way the window is.
 *
 * Pure: RN-free and theme-free (the theme pulls `Platform`), so it unit-tests directly under vitest. Its
 * only runtime imports are the nav layer's static kind->list map and the framework-free design-token
 * spacing scale, both equally pure.
 */
import { space } from "@civfix/shared/tokens"
import { parentViewForEntry, type DetailEntry, type View } from "../nav"
import { HEADER_CONTROL_SIZE } from "../bodies/headerControls"

/** The nav strip's left inset - the card's own left inset, and the civfix wordmark's original position. */
export const NAV_LEFT = 14
/** The nav strip's top inset - the same 14 the card uses top/bottom. */
export const NAV_TOP = 14
/** The nav bar's height = the portrait dock's own height (`theme.glass.dock.height`), laid flat. */
export const NAV_H = 64
/** Nav-strip -> card gap (vertical now), and capsule -> orb gap (horizontal). The dock's own `DOCK_GAP`. */
export const NAV_GAP = 12
/** Where the nav strip ends and the card begins (vertically): the card's `top`. */
export const NAV_FOOTPRINT = NAV_TOP + NAV_H + NAV_GAP
/**
 * The narrowest strip of map the card may ever leave uncovered. The card is user-resizable, so on a small
 * landscape viewport (a 840px tablet) an unbounded drag could bury the map entirely; `clampSidebarWidth`
 * spends this to guarantee the co-star stays on stage.
 */
export const MAP_MIN_CLEAR = 280

/* ----------------------------------------------------------------------------------------------- *
 * The nav CLUSTER: the civfix brand pill, the 4-tab glass capsule, and the detached Search orb, all in
 * ONE horizontal row, left-anchored at the shell's top-left inset. Same rule as above - every number
 * below is a function of the numbers above it, so a capsule width is never "232" in a StyleSheet but
 * `pad + items + gaps`.
 * ----------------------------------------------------------------------------------------------- */

export const RAIL_ITEM = 56
export const RAIL_ITEM_GAP = 10
export const RAIL_PAD_H = 10
/**
 * How many items the capsule carries. It is `TAB_SPECS.length` by construction (the nav strip IS the
 * portrait dock, so it shows the same four view tabs), but stated as a literal here to keep this module
 * free of the tabBarLogic -> theme/motion import chain; `expandedFramePlan.test.ts` pins the two together.
 */
export const RAIL_TAB_COUNT = 4
/** The capsule's width: its own padding, its items, and the gaps between them. */
export const RAIL_CAPSULE_W =
  RAIL_PAD_H * 2 + RAIL_ITEM * RAIL_TAB_COUNT + RAIL_ITEM_GAP * (RAIL_TAB_COUNT - 1)
/** The capsule's height = the bar height - a pill on a 64-tall row, "radius = height/2". */
export const RAIL_CAPSULE_H = NAV_H
export const RAIL_CAPSULE_RADIUS = RAIL_CAPSULE_H / 2
/** The detached Search orb's diameter. The portrait dock's own orb (`TabBar.shared`'s ORB_SIZE / 58). */
export const RAIL_ORB = 58

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
  NAV_LEFT + RAIL_BRAND_W + NAV_GAP + RAIL_CAPSULE_W + NAV_GAP + RAIL_ORB
export const EXPANDED_RIGHT_ACTIONS_W =
  MAP_ACTIONS_RIGHT +
  MAP_ACTION_SIZE * MAP_ACTION_COUNT +
  MAP_ACTION_GAP * (MAP_ACTION_COUNT - 1) +
  MAP_PROFILE_EXTRA
export const EXPANDED_CLUSTER_BREATHING = NAV_GAP * 2
export const EXPANDED_MIN_WIDTH =
  EXPANDED_LEFT_CLUSTER_W + EXPANDED_RIGHT_ACTIONS_W + EXPANDED_CLUSTER_BREATHING

export type LayoutMode = "compact" | "expanded"

export function expandedFits(width: number): boolean {
  return width >= EXPANDED_MIN_WIDTH
}

export function layoutModeFor(width: number, height: number): LayoutMode {
  return width >= height && expandedFits(width) ? "expanded" : "compact"
}

/**
 * The left edge (capsule-local) of the item at `index` - the lozenge's resting x, and the stop it slides
 * between. Item 0 sits on the capsule's left padding; every later item is one item-plus-gap further right.
 */
export function railItemLeft(index: number): number {
  return RAIL_PAD_H + index * (RAIL_ITEM + RAIL_ITEM_GAP)
}

export interface ExpandedFrameInput {
  /** The nav store's current list view. */
  view: View
  /** `stack.length`. Non-zero means a detail is open, which is what brings the card back in map mode. */
  stackLength: number
  /** The card's LIVE width, ALREADY viewport-clamped (`clampSidebarWidth`). */
  sidebarWidth: number
}

export interface ExpandedFrame {
  /**
   * Whether the card paints at all. The Map tab hands the whole viewport to the map: on `view === "map"`
   * with nothing stacked the card animates out (and stays MOUNTED - see ExpandedShell) so a pin tap can
   * bring it straight back with the detail.
   */
  cardVisible: boolean
  /**
   * px of the viewport occluded from the LEFT edge: everything the map must consider hidden. Consumed by
   * the web host's `--cf-occlusion-left` (the maplibre attribution offset), `dropPinCamera`'s expanded
   * branch, and the main-map LocationPicker's centring. The nav strip no longer occupies a left-edge
   * column (it is a top bar now), so the floor when the card is hidden is just the shell's own inset -
   * nothing else permanently blocks the map's left edge.
   */
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
 * Which rail item should read as selected. An open detail answers with the list that OWNS it (a report pin
 * lights nothing - "reports" is not a rail tab - while a post lights Home and a conversation lights
 * Messages), because the rail must describe where the user IS, not which tab they last tapped. With nothing
 * stacked it is simply the current view.
 *
 * Returns a View, or null when the open detail belongs to no list at all (profile, activity, settings) - the
 * honest "no lozenge" state, exactly what the portrait dock already does when `activeTabIndex` is -1. The
 * rail lights its lozenge only when the answer is one of its four tabs (home / map / messaging / report) and
 * its orb only for `search`; every other answer leaves the rail dark.
 */
export function railActiveView(view: View, active: DetailEntry | null): View | null {
  return active ? parentViewForEntry(active) : view
}
