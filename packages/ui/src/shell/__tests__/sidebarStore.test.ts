/**
 * The cookie/MMKV persistence seam is a no-op under node, so these cover the width math and the v1 -> v2
 * migration, not the storage round-trip.
 */
import { beforeEach, describe, expect, it } from "vitest"
import {
  useSidebarStore,
  clampSidebarWidth,
  migrateSidebarWidth,
  LEGACY_DEFAULT_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from "../sidebarStore"
import { MAP_MIN_CLEAR, NAV_LEFT } from "../expandedFramePlan"

beforeEach(() => {
  // The in-memory state would otherwise leak across cases.
  useSidebarStore.setState({ width: SIDEBAR_DEFAULT_WIDTH })
})

describe("sidebarStore: defaults + setWidth", () => {
  it("defaults to the design width", () => {
    expect(useSidebarStore.getState().width).toBe(SIDEBAR_DEFAULT_WIDTH)
    expect(SIDEBAR_DEFAULT_WIDTH).toBe(440)
  })

  it("setWidth clamps to the SAME [MIN, MAX] band as clampSidebarWidth, and rounds", () => {
    useSidebarStore.getState().setWidth(10_000)
    expect(useSidebarStore.getState().width).toBe(SIDEBAR_MAX_WIDTH)
    // Every drag release commits through this write, so a tighter cap here would swallow a raised maximum.
    expect(SIDEBAR_MAX_WIDTH).toBe(640)

    useSidebarStore.getState().setWidth(10)
    expect(useSidebarStore.getState().width).toBe(SIDEBAR_MIN_WIDTH)

    useSidebarStore.getState().setWidth(412.6)
    expect(useSidebarStore.getState().width).toBe(413)
  })

  it("accepts a width between the old 560 cap and the new one (the raise is not a no-op)", () => {
    useSidebarStore.getState().setWidth(600)
    expect(useSidebarStore.getState().width).toBe(600)
  })
})

describe("clampSidebarWidth", () => {
  // A roomy viewport so the absolute bounds (not the viewport cap) decide.
  const WIDE = 1600

  it("keeps an in-range width unchanged (rounded)", () => {
    expect(clampSidebarWidth(420, WIDE)).toBe(420)
  })

  it("clamps to the absolute min and max", () => {
    expect(clampSidebarWidth(50, WIDE)).toBe(SIDEBAR_MIN_WIDTH)
    expect(clampSidebarWidth(9999, WIDE)).toBe(SIDEBAR_MAX_WIDTH)
  })

  it("always leaves the map its guaranteed clear strip beside the card", () => {
    // The smallest legal landscape: 840 - 14 (left inset) - 280 (map) = 546.
    expect(clampSidebarWidth(9999, 840)).toBe(840 - NAV_LEFT - MAP_MIN_CLEAR)
    expect(clampSidebarWidth(9999, 840)).toBe(546)
    expect(clampSidebarWidth(SIDEBAR_DEFAULT_WIDTH, 840)).toBe(440)
  })

  it("lets the absolute max win once the viewport is roomy enough for it", () => {
    // The strip guarantee stops binding at 14 + 640 + 280 = 934.
    expect(clampSidebarWidth(9999, 1010)).toBe(SIDEBAR_MAX_WIDTH)
    expect(clampSidebarWidth(9999, 1920)).toBe(SIDEBAR_MAX_WIDTH)
  })

  it("on a viewport too small for the min, collapses to the available width (the strip still wins)", () => {
    // 590 - 14 - 280 = 296 is below the min; the cap must still win so the card never eats the map strip.
    expect(clampSidebarWidth(500, 700)).toBe(406)
    expect(clampSidebarWidth(500, 590)).toBe(296)
  })
})

describe("persist v1 -> v2 migration", () => {
  it("rewrites ONLY the exact old default", () => {
    expect(migrateSidebarWidth({ width: LEGACY_DEFAULT_WIDTH })).toEqual({ width: SIDEBAR_DEFAULT_WIDTH })
    expect(LEGACY_DEFAULT_WIDTH).toBe(384)
  })

  it("passes a hand-chosen width through untouched (the user's drag is not overwritten)", () => {
    expect(migrateSidebarWidth({ width: 383 })).toEqual({ width: 383 })
    expect(migrateSidebarWidth({ width: 385 })).toEqual({ width: 385 })
    expect(migrateSidebarWidth({ width: 520 })).toEqual({ width: 520 })
    expect(migrateSidebarWidth({ width: SIDEBAR_MIN_WIDTH })).toEqual({ width: SIDEBAR_MIN_WIDTH })
  })

  it("degrades a missing / corrupt cookie to the default instead of an undefined width", () => {
    expect(migrateSidebarWidth(undefined)).toEqual({ width: SIDEBAR_DEFAULT_WIDTH })
    expect(migrateSidebarWidth(null)).toEqual({ width: SIDEBAR_DEFAULT_WIDTH })
    expect(migrateSidebarWidth({})).toEqual({ width: SIDEBAR_DEFAULT_WIDTH })
    expect(migrateSidebarWidth({ width: "440" })).toEqual({ width: SIDEBAR_DEFAULT_WIDTH })
    expect(migrateSidebarWidth({ width: Number.NaN })).toEqual({ width: SIDEBAR_DEFAULT_WIDTH })
  })
})
