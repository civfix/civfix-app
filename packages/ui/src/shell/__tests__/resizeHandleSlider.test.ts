/**
 * The landscape resize handle is a REAL slider - on the keyboard and to a screen reader, not only under a
 * mouse (shell/ExpandedShell.tsx).
 *
 * WHAT WENT WRONG. `accessibilityRole="adjustable"` maps to `role="slider"` on react-native-web, but the
 * three props that make a slider operable do NOT cross: `accessibilityValue`, `accessibilityActions` and
 * `onAccessibilityAction` are absent from RNW's forwarded-props allow-list, and RNW leaves the View at
 * `tabIndex: -1`. The rendered handle therefore had exactly four attributes (aria-label, role, class,
 * style): a `role="slider"` with no `aria-valuenow/min/max` - an ARIA authoring violation on its own -
 * that no Tab walk could reach and whose increment/decrement actions could never fire. In the only layout
 * that HAS a handle, the card width was mouse-only.
 *
 * Source greps: ExpandedShell imports react-native, which this package's node-environment vitest cannot
 * load, so the wiring is pinned by reading the source (house pattern - see `rail.test.ts`). The BEHAVIOUR
 * the key map commits to is exercised for real against the pure `clampSidebarWidth` below.
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
