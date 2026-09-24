import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { MOTION } from "../../theme/motion"
import { DOCK_MOUNT_MS, DOCK_MOUNT_SCALE_FROM, DOCK_TAB_GLYPH_SIZE } from "../tabBarLogic"

const rail = readFileSync(new URL("../Rail.tsx", import.meta.url), "utf8")
const code = rail.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
const mapControls = readFileSync(new URL("../../map/MapControls.tsx", import.meta.url), "utf8")
const mapControlsCode = mapControls.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

describe("the rail's material and geometry", () => {
  it("wears the DOCK glass, not the map-button glass", () => {
    expect(rail).toMatch(/BlurSurface kind="dock"/)
    expect(code).not.toMatch(/BlurSurface kind="button"/)
    expect(rail).toContain("t.glass.dock.border")
    expect(rail).toContain("t.glass.dock.selected")
    expect(rail).toContain("t.glass.dock.shadow")
    expect(code).not.toContain("glass.active.fill")
    expect(code).not.toContain("glass.active.icon")
  })

  it("takes every dimension from the tested frame plan instead of re-typing the numbers", () => {
    for (const c of [
      "NAV_LEFT",
      "NAV_TOP",
      "NAV_H",
      "NAV_GAP",
      "RAIL_ITEM",
      "RAIL_ITEM_GAP",
      "RAIL_PAD_H",
      "RAIL_CAPSULE_W",
      "RAIL_CAPSULE_H",
      "RAIL_CAPSULE_RADIUS",
      "RAIL_ORB",
      "railItemLeft",
    ]) {
      expect(rail, `${c} must come from expandedFramePlan`).toContain(c)
    }
    expect(rail).toMatch(/zIndex: 65/)
  })
})

describe("the rail carries the brand pill", () => {
  it("renders the civfix wordmark as the row's first item, never covered", () => {
    expect(rail).toContain('import { Brand, openBrandAbout } from "../primitives"')
    expect(rail).toContain("<Brand size={BRAND_SIZE}")
    expect(code).not.toMatch(/accessibilityElementsHidden|importantForAccessibility|brandCovered/)
  })

  it("opens the About card - the SAME action the compact MapControls pill fires", () => {
    expect(rail).toContain("const onBrand = () => openBrandAbout()")
    expect(mapControlsCode).toContain("const onBrand = () => openBrandAbout()")
    expect(code, "the landscape logo must not silently reset the nav instead").not.toContain(
      "useNavStore.getState().reset()",
    )
    expect(
      mapControlsCode,
      "no host prop may reach one pill and not the other - both go through the shared store",
    ).not.toContain("onOpenBrand")
  })
})

describe("system parity: one neutral ink, selection is the lozenge - everywhere, including the orb", () => {
  it("never tints a glyph with the accent, and draws tab icons at the dock's weight", () => {
    expect(code).not.toContain("colors.accent")
    expect(rail).toContain("color={th.colors.textMuted}")
    expect(rail).toContain("const RAIL_ICON = DOCK_TAB_GLYPH_SIZE")
    expect(DOCK_TAB_GLYPH_SIZE).toBe(24)
    expect(rail).toContain("const RAIL_ICON_STROKE = 2.4")
  })

  it("lights the orb with the SAME lozenge tint the tabs use, not a solid fill", () => {
    expect(rail).toContain("orbSelected")
    expect(rail).toMatch(/orbSelected:\s*\{[^}]*backgroundColor:\s*t\.glass\.dock\.selected/s)
  })
})

describe("wiring", () => {
  it("reuses the dock's model and the frame plan's active-view rule", () => {
    expect(rail).toContain("useTabBarModel()")
    expect(rail).toContain("railActiveView(view, active)")
    expect(code).not.toMatch(/activeIndex\s*[,}]/)
  })

  it("presses a rail tab through the dock's own handler, with no menu machinery of its own", () => {
    expect(rail).toContain("onPress={() => onTab(tab)}")
    expect(code).not.toContain("useCreateMenuStore")
    expect(code).not.toContain("useTabAnchors")
    expect(code).not.toContain("registerTabRef")
  })

  it("stays decoupled from the compact dock's stores and seams", () => {
    expect(code).not.toMatch(/from "\.\/TabBar\.(web|native)"/)
    expect(code).not.toMatch(/from "\.\/TabBar"/)
    expect(code).not.toContain("tabBarStore")
    expect(code).not.toContain("dockMinimizeStore")
    expect(code).not.toContain("dockMorph")
  })
})

describe("a11y", () => {
  it("announces as a HORIZONTAL tablist of tabs, with the web selected-state fix and the focus ring", () => {
    expect(rail).toContain('accessibilityRole="tablist"')
    expect(rail).toContain('"aria-orientation": "horizontal"')
    expect(rail).toContain('accessibilityRole="tab"')
    expect(rail).toContain("accessibilityState={{ selected }}")
    expect(rail).toContain('"aria-selected": selected')
    expect(rail).toContain("focusRingProps")
    expect(rail).toContain('dataSet: { civfixRail: "" }')
  })

  it("announces the ORB's lit state too, with the same raw-prop workaround", () => {
    expect(rail).toContain('"aria-pressed": searchActive')
    expect(rail).toContain("accessibilityState={{ selected: searchActive }}")
  })
})

describe("motion", () => {
  it("borrows the dock pill's clock and the shared glass-mount recipe - no new durations", () => {
    expect(rail).toContain("tabPillTransition(reduceMotion)")
    expect(rail).toContain("motion.glassIn")
    expect(rail).toContain("webTransition")
    expect(code).not.toMatch(/\b\d{2,4}ms\b/)
    expect(MOTION.tabPill.duration).toBe(220)
    expect(DOCK_MOUNT_MS).toBe(MOTION.dockMount.duration)
    expect(MOTION.dockMount.duration).toBe(250)
    expect(DOCK_MOUNT_SCALE_FROM).toBe(0.92)
  })

  it("plays the mount entrance ONCE, and skips it under reduced motion", () => {
    expect(rail).toContain("useState(reduceMotion)")
    expect(rail).toContain("useEffect(() => setMounted(true), [])")
    expect(rail).toContain("isWeb && !reduceMotion")
  })

  it("slides the lozenge on translateX, not translateY - the row lays out horizontally", () => {
    expect(rail).toContain("transform: [{ translateX: railItemLeft(")
    expect(code).not.toContain("translateY: railItemTop")
  })
})
