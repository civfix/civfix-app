import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  SHEET_SNAP_RANGE,
  sheetSnapForAccessibilityAction,
  sheetSnapForKey,
  sheetSnapKeyOutcome,
  sheetSnapValueKey,
  stepSheetSnap,
} from "../tabBarLogic"

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8")

// The seams below are RN components the package cannot render in node, so these pin the exact
// accessibility props on the element that needs them.
function elementAround(source: string, marker: string): string {
  const at = source.indexOf(marker)
  expect(at, marker).toBeGreaterThan(-1)
  const open = source.lastIndexOf("<", at)
  const close = source.indexOf(">", at)
  return source.slice(open, close)
}

describe("web dock tab bar semantics", () => {
  const shared = read("TabBar.shared.tsx")
  const web = read("TabBar.web.tsx")

  it("emits aria-selected on each tab, since RNW drops accessibilityState.selected", () => {
    const tab = shared.slice(shared.indexOf("export function TabButton"), shared.indexOf("export function SearchOrb"))
    expect(tab).toContain('{...({ "aria-selected": active } as object)}')
  })

  it("marks the tab row as a horizontal tablist", () => {
    const row = elementAround(web, "style={styles.row}")
    expect(row).toContain('accessibilityRole="tablist"')
    expect(row).toContain('"aria-orientation": "horizontal"')
  })

  it("exposes the search orb's state as aria-pressed, not an invalid selected on a button", () => {
    const orb = shared.slice(shared.indexOf("export function SearchOrb"))
    expect(orb).toContain('{...({ "aria-pressed": active } as object)}')
  })
})

describe("native dock tab bar semantics", () => {
  const native = read("TabBar.native.tsx")

  it("names the docked search field and hides its decorative placeholder from screen readers", () => {
    const input = elementAround(native, "value={dockedSearch.value}")
    expect(input).toContain("accessibilityLabel={dockedSearch.placeholder}")
    const hint = native.slice(native.indexOf("<Animated.Text"), native.indexOf("</Animated.Text>"))
    expect(hint).toContain("accessibilityElementsHidden")
    expect(hint).toContain('importantForAccessibility="no"')
  })

  it("removes every touch-gated hit target from the accessibility tree while it is inert", () => {
    expect(native).toMatch(
      /pointerEvents=\{interactive \? "auto" : "none"\}\s*\{\.\.\.a11yReachableWhen\(interactive\)\}/,
    )
    expect(native).toMatch(
      /pointerEvents=\{minimizedActive \? "auto" : "none"\}\s*\{\.\.\.a11yReachableWhen\(minimizedActive\)\}/,
    )
    expect(native).toMatch(
      /pointerEvents=\{searchActive \? "auto" : "none"\}\s*\{\.\.\.a11yReachableWhen\(searchActive\)\}/,
    )
    expect(native).toMatch(
      /pointerEvents=\{searchActive \? "none" : "auto"\}\s*\{\.\.\.a11yReachableWhen\(!searchActive\)\}/,
    )
    expect(native).toMatch(/pointerEvents=\{pinned \? "auto" : "none"\}\s*\{\.\.\.a11yReachableWhen\(pinned\)\}/)
    expect(native).toMatch(/accessibilityElementsHidden: !reachable/)
    expect(native).toMatch(/reachable \? \("auto" as const\) : \("no-hide-descendants" as const\)/)
  })

  it("labels the minimized-dock restore button as what it does, not as a tab", () => {
    const restore = elementAround(native, "onPress={resetMinimize}")
    expect(restore).toContain('accessibilityLabel={t("a11y.show_tab_bar")}')
    expect(restore).not.toContain("labelKey")
  })
})

describe("compact sheet grab handle", () => {
  it("steps within the three snaps and ignores unknown actions", () => {
    expect(SHEET_SNAP_RANGE).toEqual({ min: 0, max: 2 })
    expect(stepSheetSnap(2, 1)).toBe(2)
    expect(stepSheetSnap(0, -1)).toBe(0)
    expect(sheetSnapForAccessibilityAction(1, "increment")).toBe(2)
    expect(sheetSnapForAccessibilityAction(1, "decrement")).toBe(0)
    expect(sheetSnapForAccessibilityAction(1, "activate")).toBeNull()
  })

  it("maps slider keys and Enter/Space (tap-to-cycle parity) to a snap", () => {
    expect(sheetSnapForKey(0, "ArrowUp")).toBe(1)
    expect(sheetSnapForKey(0, "ArrowDown")).toBe(0)
    expect(sheetSnapForKey(1, "Home")).toBe(0)
    expect(sheetSnapForKey(1, "End")).toBe(2)
    expect(sheetSnapForKey(2, "Enter")).toBe(0)
    expect(sheetSnapForKey(1, " ")).toBe(2)
    expect(sheetSnapForKey(1, "Tab")).toBeNull()
  })

  it("is adjustable on native: a value and increment/decrement actions, not just a double-tap", () => {
    const native = read("CompactShell.native.tsx")
    const handle = native.slice(native.indexOf("function SheetGrabHandle("), native.indexOf("function makeBackground("))
    expect(handle).toContain('accessibilityRole="adjustable"')
    expect(handle).toContain("accessibilityValue={{ ...SHEET_SNAP_RANGE, now: snap, text: t(sheetSnapValueKey(snap)) }}")
    expect(handle).toContain("accessibilityActions={ADJUST_ACTIONS}")
    expect(handle).toContain("onAccessibilityAction={(e) => onAdjust(e.nativeEvent.actionName)}")
  })

  it("is a focusable, labelled slider on web with keyboard stepping", () => {
    const web = read("CompactShell.web.tsx")
    const handle = elementAround(web, "style={styles.handleArea}")
    expect(handle).toContain('accessibilityRole="adjustable"')
    expect(handle).toContain('accessibilityLabel={tNav("a11y.drag_handle")}')
    expect(handle).toContain('"aria-valuenow": snap')
    expect(handle).toContain("tabIndex: 0")
    expect(handle).toContain("onKeyDown: onHandleKeyDown")
  })

  it("settles the web sheet without a transition under reduced motion", () => {
    const web = read("CompactShell.web.tsx")
    expect(web).toMatch(
      /const settleTransition =\s*dragging \|\| !snapAnimated \|\| prefersReducedMotion\(\) \? "none" : SETTLE_TRANSITION/,
    )
  })
})

describe("compact sheet grab handle at a bound and its spoken value", () => {
  it("consumes a slider key at a bound without changing the snap, so ArrowDown at peek never re-collapses", () => {
    expect(sheetSnapKeyOutcome(0, "ArrowDown")).toEqual({ consumed: true, next: null })
    expect(sheetSnapKeyOutcome(0, "Home")).toEqual({ consumed: true, next: null })
    expect(sheetSnapKeyOutcome(2, "ArrowUp")).toEqual({ consumed: true, next: null })
    expect(sheetSnapKeyOutcome(1, "ArrowDown")).toEqual({ consumed: true, next: 0 })
    expect(sheetSnapKeyOutcome(2, "Enter")).toEqual({ consumed: true, next: 0 })
    expect(sheetSnapKeyOutcome(1, "Tab")).toEqual({ consumed: false, next: null })
  })

  it("names each snap instead of reading 0, 1 or 2", () => {
    expect([0, 1, 2].map((snap) => sheetSnapValueKey(snap as 0 | 1 | 2))).toEqual([
      "a11y.sheet_snap.collapsed",
      "a11y.sheet_snap.half",
      "a11y.sheet_snap.full",
    ])
  })

  it("the web handle applies only a changed snap and speaks the snap name", () => {
    const web = read("CompactShell.web.tsx")
    const handler = web.slice(web.indexOf("const onHandleKeyDown"), web.indexOf("const settleTransition"))
    expect(handler.length).toBeGreaterThan(0)
    expect(handler).toContain("sheetSnapKeyOutcome(cur, event.key)")
    expect(handler).toMatch(/if \(outcome\.next === null\) return\s+setSnap\(outcome\.next\)/)
    expect(elementAround(web, "style={styles.handleArea}")).toContain('"aria-valuetext": tNav(sheetSnapValueKey(snap))')
  })

  it("the native handle speaks the snap name as its value text", () => {
    const native = read("CompactShell.native.tsx")
    const handle = native.slice(native.indexOf("function SheetGrabHandle("), native.indexOf("function makeBackground("))
    expect(handle.length).toBeGreaterThan(0)
    expect(handle).toContain("accessibilityValue={{ ...SHEET_SNAP_RANGE, now: snap, text: t(sheetSnapValueKey(snap)) }}")
  })
})
