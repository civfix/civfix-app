/**
 * The landscape resize handle must be a real slider on the keyboard and to a screen reader, not only
 * under a mouse. `accessibilityRole="adjustable"` maps to `role="slider"` on react-native-web, but
 * `accessibilityValue`, `accessibilityActions` and `onAccessibilityAction` are not in RNW's forwarded-props
 * allow-list and the View stays at `tabIndex: -1`, leaving a slider with no aria values that no Tab walk
 * reaches. Wiring is pinned by source read (ExpandedShell imports react-native); the key map's behaviour
 * runs for real against `clampSidebarWidth`.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  clampSidebarWidth,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "../sidebarStore"

const shell = readFileSync(new URL("../ExpandedShell.tsx", import.meta.url), "utf8")
const code = shell.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

describe("the handle exposes slider STATE to the web a11y tree", () => {
  it("passes the aria value trio + orientation itself, because RNW drops accessibilityValue", () => {
    for (const attr of ['"aria-valuemin"', '"aria-valuemax"', '"aria-valuenow"', '"aria-orientation"']) {
      expect(code, `${attr} must be passed as a raw web prop`).toContain(attr)
    }
    expect(code).toContain('"aria-orientation": "horizontal"')
    // The native props stay for native - this is an ADDITION, not a replacement.
    expect(code).toContain('accessibilityRole="adjustable"')
    expect(code).toContain("accessibilityValue={{ min: resizeMin, max: resizeMax, now: resizeNow }}")
    expect(code).toContain("accessibilityActions={ADJUST_ACTIONS}")
  })

  it("announces the LIVE bounds, not the absolute token pair", () => {
    // `clampSidebarWidth` additionally caps the width so the map keeps its guaranteed clear strip, so a
    // narrow landscape window's real ceiling is well under SIDEBAR_MAX_WIDTH; announcing 640 there would
    // promise a value the slider refuses to take.
    expect(code).toContain("const resizeMin = clampSidebarWidth(SIDEBAR_MIN_WIDTH, width)")
    expect(code).toContain("const resizeMax = clampSidebarWidth(SIDEBAR_MAX_WIDTH, width)")
    expect(clampSidebarWidth(SIDEBAR_MAX_WIDTH, 840)).toBeLessThan(SIDEBAR_MAX_WIDTH)
    expect(clampSidebarWidth(SIDEBAR_MAX_WIDTH, 1920)).toBe(SIDEBAR_MAX_WIDTH)
  })
})

describe("the handle is keyboard-operable", () => {
  it("takes a tab stop, and gives it up with the card", () => {
    // RNW drops `accessibilityElementsHidden` / `importantForAccessibility` as well, so a handle for an
    // absent card (map mode) would stay a live tab stop that resizes something invisible.
    expect(code).toContain("...(cardVisible ? { tabIndex: 0 } : { tabIndex: -1, \"aria-hidden\": true })")
    // And a control that is now a tab stop needs a visible focus indicator (WCAG 2.4.7).
    expect(code).toContain("{...focusRingProps}")
  })

  it("maps the WAI-ARIA slider keys and stops the page scrolling under them", () => {
    expect(code).toContain("onKeyDown: onHandleKeyDown")
    for (const key of ['"ArrowRight"', '"ArrowUp"', '"ArrowLeft"', '"ArrowDown"', '"Home"', '"End"']) {
      expect(code, `${key} must move the slider`).toContain(`case ${key}:`)
    }
    expect(code).toContain("event.preventDefault?.()")
    // Every path commits through the SAME clamp+persist the drag's release uses.
    expect(code).toContain("setWidth(clampSidebarWidth(next, width))")
  })

  it("steps by the same RESIZE_STEP the screen-reader actions use, and lands inside the bounds", () => {
    expect(code).toMatch(/const RESIZE_STEP = 24/)
    const viewport = 1440
    const step = 24
    // Right/Up widen, Left/Down narrow, from the default width.
    expect(clampSidebarWidth(SIDEBAR_DEFAULT_WIDTH + step, viewport)).toBe(SIDEBAR_DEFAULT_WIDTH + step)
    expect(clampSidebarWidth(SIDEBAR_DEFAULT_WIDTH - step, viewport)).toBe(SIDEBAR_DEFAULT_WIDTH - step)
    // Home/End are the live bounds themselves, so they are fixed points of the clamp.
    const min = clampSidebarWidth(SIDEBAR_MIN_WIDTH, viewport)
    const max = clampSidebarWidth(SIDEBAR_MAX_WIDTH, viewport)
    expect(clampSidebarWidth(min, viewport)).toBe(min)
    expect(clampSidebarWidth(max, viewport)).toBe(max)
    // Arrowing past an edge parks ON the edge rather than escaping it.
    expect(clampSidebarWidth(max + step, viewport)).toBe(max)
    expect(clampSidebarWidth(min - step, viewport)).toBe(min)
  })
})
