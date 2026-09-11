/**
 * Unit tests for the expanded (landscape) shell's FRAME PLAN - the ONE place that answers "where does the
 * top nav strip end", "is the card on screen", and "how much of the map is hidden behind it". Pure
 * functions over the nav vocabulary, so vitest drives them directly (house style: backAffordance,
 * dragCollapse, postCardRhythm).
 *
 * WHY the module exists: before it, the card's inset lived in ExpandedShell's private styles, the map
 * camera re-derived the occlusion from a `sidebarWidth` parameter, and the web host's attribution rule
 * hardcoded a stale pixel offset - three copies of one number. Every checkpoint width in the design's
 * table is asserted here so a geometry change cannot pass silently.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { space } from "@civfix/shared/tokens"
import {
  EXPANDED_CLUSTER_BREATHING,
  EXPANDED_LEFT_CLUSTER_W,
  EXPANDED_MIN_WIDTH,
  EXPANDED_RIGHT_ACTIONS_W,
  MAP_ACTION_COUNT,
  MAP_ACTION_GAP,
  MAP_ACTION_SIZE,
  MAP_ACTIONS_RIGHT,
  MAP_MIN_CLEAR,
  MAP_PROFILE_EXTRA,
  MAP_SIGN_IN_FONT,
  MAP_SIGN_IN_LABEL_EM,
  MAP_SIGN_IN_PAD_H,
  MAP_SIGN_IN_W,
  NAV_FOOTPRINT,
  NAV_GAP,
  NAV_H,
  NAV_LEFT,
  NAV_TOP,
  RAIL_CAPSULE_H,
  RAIL_CAPSULE_RADIUS,
  RAIL_CAPSULE_W,
  RAIL_ITEM,
  RAIL_ITEM_GAP,
  RAIL_BRAND_GLYPH_EM,
  RAIL_BRAND_PAD_H,
  RAIL_BRAND_SIZE,
  RAIL_BRAND_W,
  RAIL_ORB,
  RAIL_PAD_H,
  RAIL_TAB_COUNT,
  expandedFits,
  expandedFramePlan,
  layoutModeFor,
  railActiveView,
  railItemLeft,
} from "../expandedFramePlan"
import { SIDEBAR_DEFAULT_WIDTH, clampSidebarWidth } from "../sidebarStore"
import { TAB_PILL_INSET_X, TAB_PILL_INSET_Y, TAB_SPECS, activeTabIndex } from "../tabBarLogic"
import { DOCK_H } from "../../surface/liquidGlass/liquidGlassModel"
import { ALL_VIEWS, type View } from "../../nav"

const plan = (over: Partial<Parameters<typeof expandedFramePlan>[0]> = {}) =>
  expandedFramePlan({ view: "home", stackLength: 0, sidebarWidth: SIDEBAR_DEFAULT_WIDTH, ...over })

describe("nav strip geometry constants", () => {
  it("pins the design's numbers", () => {
    expect(NAV_LEFT).toBe(14)
    expect(NAV_TOP).toBe(14)
    expect(NAV_H).toBe(64)
    expect(NAV_GAP).toBe(12)
    expect(MAP_MIN_CLEAR).toBe(280)
  })

  it("derives the footprint (the card's top edge) rather than hardcoding 90", () => {
    expect(NAV_FOOTPRINT).toBe(NAV_TOP + NAV_H + NAV_GAP)
    expect(NAV_FOOTPRINT).toBe(90)
  })
})

describe("rail cluster geometry (horizontal: brand pill, capsule, orb, left to right)", () => {
  it("pins the design's item numbers", () => {
    expect(RAIL_ITEM).toBe(56)
    expect(RAIL_ITEM_GAP).toBe(10)
    expect(RAIL_PAD_H).toBe(10)
    expect(RAIL_ORB).toBe(58)
  })

  it("borrows the portrait dock's own cell rhythm instead of a tighter landscape one", () => {
    expect(RAIL_ITEM).toBe(DOCK_H - TAB_PILL_INSET_Y * 2)
    expect(RAIL_ITEM_GAP).toBe(TAB_PILL_INSET_X * 2)
    expect(RAIL_ITEM + RAIL_ITEM_GAP).toBeGreaterThan(52)
  })

  it("carries one item per dock tab (the rail IS the dock, laid flat)", () => {
    expect(RAIL_TAB_COUNT).toBe(TAB_SPECS.length)
    expect(RAIL_TAB_COUNT).toBe(4)
  })

  it("derives the capsule's width from its own padding, items and gaps", () => {
    expect(RAIL_CAPSULE_W).toBe(RAIL_PAD_H * 2 + RAIL_ITEM * RAIL_TAB_COUNT + RAIL_ITEM_GAP * (RAIL_TAB_COUNT - 1))
    expect(RAIL_CAPSULE_W).toBe(274)
  })

  it("gives the capsule the bar's own height - a pill on a 64-tall row", () => {
    expect(RAIL_CAPSULE_H).toBe(NAV_H)
    expect(RAIL_CAPSULE_RADIUS).toBe(RAIL_CAPSULE_H / 2)
    expect(RAIL_CAPSULE_RADIUS).toBe(32)
  })

  it("stacks the lozenge stops one item pitch apart, inside the capsule", () => {
    expect([0, 1, 2, 3].map(railItemLeft)).toEqual([10, 76, 142, 208])
    // The last item's right edge lands exactly on the capsule's right padding.
    expect(railItemLeft(RAIL_TAB_COUNT - 1) + RAIL_ITEM + RAIL_PAD_H).toBe(RAIL_CAPSULE_W)
  })

  it("puts each rail tab at the index the dock's own pure lookup gives it", () => {
    // The rail mirrors the portrait dock's order: Map . Home . Messages . Report, one neutral ink.
    expect(activeTabIndex("map")).toBe(0)
    expect(activeTabIndex("home")).toBe(1)
    expect(activeTabIndex("messaging")).toBe(2)
    expect(activeTabIndex("report")).toBe(3)
    // Search has no tab (it is the detached orb), and neither do the list views.
    expect(activeTabIndex("search")).toBe(-1)
    expect(activeTabIndex("events")).toBe(-1)
  })
})

describe("expandedFramePlan: cardVisible", () => {
  it("shows the card on every NON-map view at the view root", () => {
    for (const view of ALL_VIEWS.filter((v) => v !== "map")) {
      expect(plan({ view }).cardVisible).toBe(true)
    }
  })

  it("HIDES the card on the map view at the view root (the /map fix)", () => {
    expect(plan({ view: "map" }).cardVisible).toBe(false)
  })

  it("brings the card back as soon as the map opens a detail on top of it", () => {
    // Pin tap / cluster tap / long-press drop-pin: the stack goes non-empty, the card returns.
    expect(plan({ view: "map", stackLength: 1 }).cardVisible).toBe(true)
    expect(plan({ view: "map", stackLength: 3 }).cardVisible).toBe(true)
  })
})

describe("expandedFramePlan: occlusionLeft", () => {
  it("is the shell's own left inset plus the live card width while the card shows", () => {
    expect(plan().occlusionLeft).toBe(NAV_LEFT + SIDEBAR_DEFAULT_WIDTH)
    expect(plan().occlusionLeft).toBe(454)
    expect(plan({ sidebarWidth: 300 }).occlusionLeft).toBe(314)
    expect(plan({ sidebarWidth: 640 }).occlusionLeft).toBe(654)
  })

  it("collapses to the bare left inset when the card is hidden - the top strip costs the map no horizontal space", () => {
    expect(plan({ view: "map" }).occlusionLeft).toBe(NAV_LEFT)
    expect(plan({ view: "map" }).occlusionLeft).toBe(14)
  })

  it("tracks a drag frame-for-frame (it is a pure function of the LIVE width)", () => {
    const frames = [440, 452, 468, 501, 560].map((w) => plan({ sidebarWidth: w }).occlusionLeft)
    expect(frames).toEqual([454, 466, 482, 515, 574])
  })
})

describe("expandedFramePlan: the design's checkpoint table", () => {
  // viewport -> [clamped card at the default, clear map strip beside it]
  const CHECKPOINTS: ReadonlyArray<readonly [number, number, number]> = [
    [840, 440, 386],
    [1024, 440, 570],
    [1280, 440, 826],
    [1440, 440, 986],
    [1920, 440, 1466],
  ]

  it("leaves the documented clear map strip at every checkpoint width", () => {
    for (const [viewport, card, clear] of CHECKPOINTS) {
      const width = clampSidebarWidth(SIDEBAR_DEFAULT_WIDTH, viewport)
      expect(width).toBe(card)
      const { occlusionLeft } = expandedFramePlan({ view: "home", stackLength: 0, sidebarWidth: width })
      expect(viewport - occlusionLeft).toBe(clear)
      expect(viewport - occlusionLeft).toBeGreaterThanOrEqual(MAP_MIN_CLEAR)
    }
  })

  it("never lets a dragged card eat into the guaranteed strip", () => {
    for (const [viewport] of CHECKPOINTS) {
      // The widest the user can drag to at this viewport, straight through the clamp.
      const widest = clampSidebarWidth(10_000, viewport)
      const { occlusionLeft } = expandedFramePlan({ view: "home", stackLength: 0, sidebarWidth: widest })
      expect(viewport - occlusionLeft).toBeGreaterThanOrEqual(MAP_MIN_CLEAR)
    }
  })

  it("hands the whole viewport minus the shell's own inset to the map in map mode", () => {
    for (const [viewport] of CHECKPOINTS) {
      const { occlusionLeft } = expandedFramePlan({ view: "map", stackLength: 0, sidebarWidth: 640 })
      expect(occlusionLeft).toBe(NAV_LEFT)
      expect(viewport - occlusionLeft).toBe(viewport - NAV_LEFT)
    }
  })
})

describe("EXPANDED_MIN_WIDTH: the width the expanded chrome needs before it may be chosen", () => {
  const rail = readFileSync(new URL("../Rail.tsx", import.meta.url), "utf8")
  const mapControls = readFileSync(new URL("../../map/MapControls.tsx", import.meta.url), "utf8")
  const useLayoutMode = readFileSync(new URL("../../theme/useLayoutMode.ts", import.meta.url), "utf8")

  it("sizes the brand pill from its own inputs, never from a StyleSheet literal", () => {
    expect(RAIL_BRAND_PAD_H).toBe(space["5"])
    expect(RAIL_BRAND_SIZE).toBe(27)
    expect(RAIL_BRAND_W).toBe(Math.ceil(RAIL_BRAND_PAD_H * 2 + RAIL_BRAND_SIZE * RAIL_BRAND_GLYPH_EM))
    expect(RAIL_BRAND_W).toBe(111)
    expect(rail).toContain("const BRAND_SIZE = RAIL_BRAND_SIZE")
    expect(rail).toContain("paddingHorizontal: RAIL_BRAND_PAD_H")
  })

  it("adds the left cluster up the way the rail lays it out: inset, pill, capsule, orb", () => {
    expect(EXPANDED_LEFT_CLUSTER_W).toBe(
      NAV_LEFT + RAIL_BRAND_W + NAV_GAP + RAIL_CAPSULE_W + NAV_GAP + RAIL_ORB,
    )
    expect(EXPANDED_LEFT_CLUSTER_W).toBe(481)
  })

  it("adds the map's top-right action row up the way MapControls lays it out", () => {
    expect(MAP_ACTION_GAP).toBe(space["2"])
    expect(MAP_ACTIONS_RIGHT).toBe(space["3"])
    expect(EXPANDED_RIGHT_ACTIONS_W).toBe(
      MAP_ACTIONS_RIGHT +
        MAP_ACTION_SIZE * MAP_ACTION_COUNT +
        MAP_ACTION_GAP * (MAP_ACTION_COUNT - 1) +
        MAP_PROFILE_EXTRA,
    )
    expect(EXPANDED_RIGHT_ACTIONS_W).toBe(368)
    expect(mapControls).toContain("export const GLASS_CONTROL_SIZE = MAP_ACTION_SIZE")
    const plan = readFileSync(new URL("../expandedFramePlan.ts", import.meta.url), "utf8")
    expect(plan).toContain("export const MAP_ACTION_SIZE = HEADER_CONTROL_SIZE")
    const glass = readFileSync(new URL("../../primitives/GlassButton.tsx", import.meta.url), "utf8")
    expect(glass, "the glass button must render the size the plan reserves").toContain(
      "const SIZE = HEADER_CONTROL_SIZE",
    )
  })

  it("budgets for the row's WIDEST state - the signed-out pill, not the 52pt avatar", () => {
    expect(MAP_SIGN_IN_PAD_H).toBe(space["4"])
    expect(MAP_SIGN_IN_W).toBe(Math.ceil(MAP_SIGN_IN_PAD_H * 2 + MAP_SIGN_IN_FONT * MAP_SIGN_IN_LABEL_EM))
    expect(MAP_SIGN_IN_W).toBeGreaterThan(MAP_ACTION_SIZE)
    expect(MAP_PROFILE_EXTRA).toBe(MAP_SIGN_IN_W - MAP_ACTION_SIZE)
    expect(mapControls).toContain("paddingHorizontal: t.space[\"4\"]")
    expect(mapControls).toMatch(/signInText: \{[^}]*fontSize: 14/)
  })

  it("is the two clusters plus breathing room - wider than the width at which they collide", () => {
    expect(EXPANDED_CLUSTER_BREATHING).toBe(NAV_GAP * 2)
    expect(EXPANDED_MIN_WIDTH).toBe(
      EXPANDED_LEFT_CLUSTER_W + EXPANDED_RIGHT_ACTIONS_W + EXPANDED_CLUSTER_BREATHING,
    )
    expect(EXPANDED_MIN_WIDTH).toBe(873)
    expect(EXPANDED_MIN_WIDTH).toBeGreaterThanOrEqual(
      EXPANDED_LEFT_CLUSTER_W + EXPANDED_RIGHT_ACTIONS_W,
    )
    expect(expandedFits(EXPANDED_MIN_WIDTH)).toBe(true)
    expect(expandedFits(EXPANDED_MIN_WIDTH - 1)).toBe(false)
  })

  it("keeps a landscape PHONE on the compact chrome - the rail would bury the Locate button", () => {
    expect(layoutModeFor(667, 375)).toBe("compact")
    expect(layoutModeFor(736, 414)).toBe("compact")
    expect(layoutModeFor(740, 360)).toBe("compact")
  })

  it("still gives every real landscape surface the expanded chrome", () => {
    expect(layoutModeFor(1024, 768)).toBe("expanded")
    expect(layoutModeFor(1280, 800)).toBe("expanded")
    expect(layoutModeFor(1920, 1080)).toBe("expanded")
    expect(layoutModeFor(EXPANDED_MIN_WIDTH, EXPANDED_MIN_WIDTH)).toBe("expanded")
  })

  it("never answers expanded for a portrait window, however wide", () => {
    expect(layoutModeFor(390, 844)).toBe("compact")
    expect(layoutModeFor(1024, 1366)).toBe("compact")
  })

  it("is the ONE constant the layout-mode seam gates on", () => {
    expect(useLayoutMode).toContain("layoutModeFor(width, height)")
    expect(useLayoutMode).not.toMatch(/return width >= height \? "expanded"/)
  })
})

describe("railActiveView", () => {
  it("is the current view when nothing is stacked", () => {
    for (const view of ALL_VIEWS) {
      expect(railActiveView(view, null)).toBe(view)
    }
  })

  it("resolves an open detail to the view that OWNS it, not to the view behind it", () => {
    expect(railActiveView("home", { kind: "pin", id: "r" })).toBe("reports")
    expect(railActiveView("home", { kind: "thread", id: "t" })).toBe("messaging")
    expect(railActiveView("home", { kind: "cleanup", id: "c" })).toBe("events")
    expect(railActiveView("home", { kind: "person", id: "p" })).toBe("social")
    // A feed surface belongs to Home, so the Home lozenge stays lit while a post/thread is open.
    expect(railActiveView("map", { kind: "post", id: "p" })).toBe("home")
    // The drop-pin menu is launched FROM the map and reverts there: the Map lozenge stays lit while the
    // card is back on screen with the menu in it.
    expect(railActiveView("map", { kind: "drop-pin", lat: 0, lng: 0 })).toBe("map")
  })

  it("lights NOTHING for a detail no list owns (the honest state)", () => {
    expect(railActiveView("home", { kind: "profile" })).toBeNull()
    expect(railActiveView("home", { kind: "activity" })).toBeNull()
    expect(railActiveView("home", { kind: "view", view: "map" })).toBeNull()
  })

  it("only ever answers with a real View or null", () => {
    const answers: Array<View | null> = ALL_VIEWS.map((v) => railActiveView(v, null))
    for (const a of answers) expect(ALL_VIEWS).toContain(a as View)
  })
})
