import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { MAP_THEME_TOGGLE_ENABLED } from "../themeTogglePlatform"
import { THEME_MENU_MAX_WIDTH, themeMenuFrame, themeMenuPlacement } from "../themeMenuPlacement"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const source = read("../MapThemeToggle.tsx")
const anchoredPopover = read("../../primitives/AnchoredPopover.tsx")
const popoverMenu = read("../../primitives/PopoverMenu.tsx")
const headerActions = read("../MapHeaderActions.tsx")
const controls = read("../MapControls.tsx")
const seamWeb = read("../themeTogglePlatform.web.ts")
const seamNative = read("../themeTogglePlatform.native.ts")
const seamDefault = read("../themeTogglePlatform.ts")

const appearanceCatalog = (lng: string): { toggle?: string; dismiss?: string } =>
  (
    JSON.parse(read(`../../i18n/locales/${lng}/map-ui.json`)) as {
      appearance?: { toggle?: string; dismiss?: string }
    }
  ).appearance ?? {}

const appearanceLabel = (lng: string): string | undefined => appearanceCatalog(lng).toggle
const dismissLabel = (lng: string): string | undefined => appearanceCatalog(lng).dismiss

describe("MapThemeToggle", () => {
  it("is a web-only affordance: the bare seam and its .web sibling are on, .native is off", () => {
    expect(MAP_THEME_TOGGLE_ENABLED).toBe(true)
    expect(seamWeb).toContain("MAP_THEME_TOGGLE_ENABLED = true")
    expect(seamNative).toContain("MAP_THEME_TOGGLE_ENABLED = false")
    expect(seamDefault).toContain(
      'export { MAP_THEME_TOGGLE_ENABLED } from "./themeTogglePlatform.web"',
    )
    expect(seamDefault).not.toMatch(/MAP_THEME_TOGGLE_ENABLED\s*=/)
    expect(source).toContain('import { MAP_THEME_TOGGLE_ENABLED } from "./themeTogglePlatform"')
    expect(source).toContain("if (!MAP_THEME_TOGGLE_ENABLED) return null")
  })

  it("reuses the shared AppearanceOptionList so the Beta pill and the copy have ONE source", () => {
    expect(source).toContain('import { AppearanceOptionList } from "../bodies/AppearanceOptionList"')
    expect(source).toContain("<AppearanceOptionList />")
    expect(source).not.toContain("setAppearancePreference(")
    expect(source).not.toMatch(/APPEARANCE_PREFERENCES/)
  })

  it("reuses the header/map control chrome rather than drawing its own button", () => {
    expect(source).toContain('from "../bodies/HeaderIconButton"')
    expect(source).toContain('surface="solid"')
    expect(source).toContain('from "../primitives"')
    expect(source).toContain("iconMap.SunMoon")
    expect(source).toContain('icon="SunMoon"')
  })

  it("labels the control from the map-ui catalog, translated in every locale", () => {
    expect(source).toContain('t("appearance.toggle")')
    for (const lng of ["en", "es", "de", "ko"]) {
      expect(appearanceLabel(lng), lng).toBeTruthy()
    }
    expect(appearanceLabel("en")).not.toBe(appearanceLabel("de"))
  })

  it("closes itself once a preference is picked, so the popover is never left hanging", () => {
    expect(source).toContain("useAppearancePreference()")
    expect(source).toContain("setOpen(false)")
  })

  it("mounts in BOTH map chromes: the compact header row and the expanded top bar", () => {
    expect(headerActions).toContain('<MapThemeToggle variant="solid" />')
    const expanded = controls.slice(controls.indexOf('if (mode === "expanded")'))
    expect(expanded).toContain('<MapThemeToggle variant="glass" />')
  })

  it("presents through the shared Modal portal, never a fixed layer inside the map's stacking context", () => {
    expect(source).toContain("<AnchoredPopover")
    expect(source).toContain('import { menuOrigin, useMenuMotion } from "../primitives/menuMotion"')
    expect(source).toContain("motion={motion}")
    expect(source).not.toMatch(/position: "fixed"/)
    expect(source).not.toMatch(/as unknown as/)
    expect(source).not.toMatch(/zIndex/)
    expect(anchoredPopover).toMatch(/<Modal\s/)
    expect(anchoredPopover).toContain('animationType="none"')
    expect(anchoredPopover).toContain("visible={motion.rendered}")
  })

  it("dismisses on an outside tap and on Escape, the way every other popover in the package does", () => {
    expect(source).toContain("onClose={close}")
    expect(source).toContain('dismissLabel={t("appearance.dismiss")}')
    expect(anchoredPopover).toContain("{...webScrimProps}")
    expect(anchoredPopover).toContain("accessibilityLabel={dismissLabel}")
    expect(anchoredPopover).toContain("onPress={onClose}")
    expect(anchoredPopover).toContain("onRequestClose={onClose}")
    expect(source).not.toMatch(/keydown|Escape/)
    for (const lng of ["en", "es", "de", "ko"]) {
      expect(dismissLabel(lng), lng).toBeTruthy()
    }
  })

  it("leaves the popover card unroled - its child is a radiogroup, not a menu", () => {
    expect(source).not.toContain('accessibilityRole="menu"')
    expect(popoverMenu).toContain('accessibilityRole="menu"')
  })

  it("tells a screen reader whether the menu is open, on both platforms", () => {
    expect(source).toContain("expanded={open}")
    const trigger = read("../../bodies/HeaderIconButton.tsx")
    const glass = read("../../primitives/GlassButton.tsx")
    for (const button of [trigger, glass]) {
      expect(button).toContain("accessibilityState={{ expanded }}")
      expect(button).toContain("aria-expanded={expanded}")
    }
  })

  it("measures its own anchor so the placement math has a real right edge", () => {
    expect(source).toContain("usePopoverAnchor(onMeasured)")
    expect(source).toContain("useWindowDimensions()")
    expect(source).toContain("onLayout={measure}")
    expect(source).toContain("themeMenuFrame({")
  })

  it("measures BEFORE it opens, so the first paint already sits on a real anchor", () => {
    expect(source).toMatch(/pendingOpen\.current = true\s*measure\(\)/)
    expect(source).toMatch(/pendingOpen\.current = false\s*setOpen\(true\)/)
  })

  it("holds the entrance until both the anchor and the card have been measured", () => {
    expect(source).toContain("const measuring = anchorRect === null || cardSize === null")
    expect(source).toContain("useMenuMotion({ visible: open, ready: !measuring })")
    expect(popoverMenu).toContain("useMenuMotion({ visible, ready: !measuring })")
  })
})

describe("themeMenuPlacement", () => {
  it("hangs the menu off the trigger's right edge when there is room", () => {
    expect(themeMenuPlacement({ anchorRight: 900, viewportWidth: 1024, margin: 12 })).toEqual({
      width: THEME_MENU_MAX_WIDTH,
      right: 0,
    })
  })

  it("pushes it back inside the viewport instead of clipping off the left edge", () => {
    const placement = themeMenuPlacement({ anchorRight: 244, viewportWidth: 360, margin: 12 })
    expect(placement.width).toBe(THEME_MENU_MAX_WIDTH)
    expect(244 - placement.right - placement.width).toBe(12)
  })

  it("never lets the menu run past the right edge either", () => {
    const placement = themeMenuPlacement({ anchorRight: 360, viewportWidth: 360, margin: 12 })
    expect(360 - placement.right).toBe(348)
  })

  it("shrinks below its natural width on a viewport too narrow to hold it", () => {
    const placement = themeMenuPlacement({ anchorRight: 260, viewportWidth: 260, margin: 12 })
    expect(placement.width).toBe(236)
    expect(260 - placement.right - placement.width).toBe(12)
  })

  it("stays anchored to the trigger until the first measurement lands", () => {
    expect(themeMenuPlacement({ anchorRight: null, viewportWidth: 360, margin: 12 })).toEqual({
      width: THEME_MENU_MAX_WIDTH,
      right: 0,
    })
  })
})

describe("themeMenuFrame", () => {
  const anchor = { x: 856, y: 60, width: 44, height: 44 }

  it("drops the card under the trigger in window coordinates, flush with its right edge", () => {
    expect(themeMenuFrame({ anchor, viewportWidth: 1024, margin: 12, gap: 8 })).toEqual({
      top: 112,
      right: 124,
      width: THEME_MENU_MAX_WIDTH,
    })
  })

  it("keeps the clamped card inside both viewport margins", () => {
    const narrow = { x: 200, y: 10, width: 44, height: 44 }
    const frame = themeMenuFrame({ anchor: narrow, viewportWidth: 360, margin: 12, gap: 8 })
    const left = 360 - frame.right - frame.width
    expect(left).toBe(12)
    expect(frame.right).toBe(100)
    expect(frame.top).toBe(62)
  })

  it("never lets the card overhang the right margin when the trigger sits at the edge", () => {
    const edge = { x: 340, y: 0, width: 20, height: 40 }
    const frame = themeMenuFrame({ anchor: edge, viewportWidth: 360, margin: 12, gap: 8 })
    expect(frame.right).toBe(12)
    expect(360 - frame.right - frame.width).toBeGreaterThanOrEqual(12)
  })
})
