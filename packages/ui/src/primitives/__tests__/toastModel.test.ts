import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  TOAST_ACTION_MS,
  TOAST_ERROR_MS,
  TOAST_QUIET_MS,
  toastBottomOffset,
  toastDockFootprint,
  toastDurationMs,
  toastLiveSemantics,
} from "../toastModel"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
const TOAST_SOURCE = read("../Toast.tsx")

describe("toastDurationMs", () => {
  it("keeps success and info short", () => {
    expect(toastDurationMs("success", false)).toBe(TOAST_QUIET_MS)
    expect(toastDurationMs("info", false)).toBe(TOAST_QUIET_MS)
  })

  it("holds errors longer", () => {
    expect(toastDurationMs("error", false)).toBe(TOAST_ERROR_MS)
  })

  it("holds any actionable toast longest", () => {
    expect(toastDurationMs("success", true)).toBe(TOAST_ACTION_MS)
    expect(toastDurationMs("error", true)).toBe(TOAST_ACTION_MS)
  })

  it("lets a caller override", () => {
    expect(toastDurationMs("error", true, 900)).toBe(900)
    expect(toastDurationMs("info", false, -5)).toBe(0)
  })
})

describe("toastBottomOffset", () => {
  it("clears the measured dock footprint, which already carries the safe area", () => {
    expect(toastBottomOffset(94, 34, 12)).toBe(106)
  })

  it("falls back to the safe area when no dock is mounted", () => {
    expect(toastBottomOffset(0, 34, 12)).toBe(46)
  })

  it("still clears the bottom edge with neither dock nor inset", () => {
    expect(toastBottomOffset(0, 0, 12)).toBe(12)
  })

  it("rides above the software keyboard, which covers the dock it normally clears", () => {
    expect(toastBottomOffset(94, 34, 12, 336)).toBe(348)
    expect(toastBottomOffset(0, 34, 12, 336)).toBe(348)
  })

  it("keeps the dock footprint whenever it is the taller obstruction", () => {
    expect(toastBottomOffset(94, 34, 12, 0)).toBe(106)
    expect(toastBottomOffset(94, 34, 12, 60)).toBe(106)
    expect(toastBottomOffset(94, 34, 12, -20)).toBe(106)
  })
})

describe("toastDockFootprint", () => {
  it("clears the tab bar from the root host", () => {
    expect(toastDockFootprint("root", 94)).toBe(94)
  })

  it("drops the tab-bar gap inside a sheet, which covers the tab bar", () => {
    expect(toastDockFootprint("sheet", 94)).toBe(0)
    expect(toastBottomOffset(toastDockFootprint("sheet", 94), 34, 12)).toBe(46)
    expect(toastBottomOffset(toastDockFootprint("sheet", 94), 34, 12, 336)).toBe(348)
  })
})

describe("Toast host", () => {
  it("derives the dock footprint from the shell's tab bar store, never a constant", () => {
    expect(TOAST_SOURCE).toContain('import { useTabBarStore } from "../shell/tabBarStore"')
    expect(TOAST_SOURCE).toContain("useTabBarStore((state) => state.tabBarHeight)")
  })

  it("anchors at the bottom and lets touches through everywhere but the card", () => {
    expect(TOAST_SOURCE).toContain('pointerEventStyles["box-none"]')
    expect(TOAST_SOURCE).not.toContain("pointerEventStyles.none")
    expect(TOAST_SOURCE).toContain("{ bottom: offset }")
  })

  it("lifts above the keyboard through the shell's canonical anchor, not a private listener", () => {
    expect(TOAST_SOURCE).toContain('import { useKeyboardAnchor } from "../shell/useKeyboardAnchor"')
    expect(TOAST_SOURCE).toContain("useKeyboardAnchor({ restOffset: 0, gap: 0 })")
    expect(TOAST_SOURCE).toContain("keyboard.reserved")
    expect(TOAST_SOURCE).not.toContain("Keyboard.addListener")
  })

  it("announces exactly once: the native announcement OR the web live region, never both", () => {
    expect(TOAST_SOURCE).toContain("AccessibilityInfo.announceForAccessibility(message)")
    expect(TOAST_SOURCE).toContain("const live = toastLiveSemantics(entry.item.variant, IS_WEB)")
    expect(TOAST_SOURCE).toContain('accessibilityLiveRegion={moved ? "none" : live.liveRegion}')
    expect(TOAST_SOURCE).toContain("role={moved ? undefined : live.role}")
    for (const variant of ["success", "info", "error"] as const) {
      expect(toastLiveSemantics(variant, false).liveRegion).toBe("none")
      expect(toastLiveSemantics(variant, true).liveRegion).not.toBe("none")
    }
  })

  it("does not re-announce or replay a toast that moved between hosts", () => {
    expect(TOAST_SOURCE).toContain("const [moved] = useState(() => shown.has(entry.item.id))")
    expect(TOAST_SOURCE).toContain("new Animated.Value(moved ? 1 : 0)")
    expect(TOAST_SOURCE).toContain("shown.add(id)")
    expect(TOAST_SOURCE).toContain("shown.current.delete(id)")
  })

  it("names the dismiss control by the MESSAGE, keeping the affordance in the hint", () => {
    expect(TOAST_SOURCE).toContain("accessibilityLabel={entry.item.message}")
    expect(TOAST_SOURCE).toContain('accessibilityHint={t("dismiss")}')
    expect(TOAST_SOURCE).not.toContain('accessibilityLabel={t("dismiss")}')
  })

  it("plays the package's fadeUp/menuOut recipes and fades only under reduced motion", () => {
    expect(TOAST_SOURCE).toContain("const ENTER = motion.fadeUp")
    expect(TOAST_SOURCE).toContain("const EXIT = motion.menuOut")
    expect(TOAST_SOURCE).toContain("reducedMotion\n    ? { opacity: progress }")
  })

  it("clamps the message to exactly 6 lines and keeps the action link to one line", () => {
    const message = TOAST_SOURCE.match(/<Text[^>]*>\s*\{entry\.item\.message\}/)
    expect(message, "the toast message text").not.toBeNull()
    expect(message![0].match(/numberOfLines=\{(\d+)\}/g)).toEqual(["numberOfLines={6}"])
    expect(message![0]).toContain("style={[styles.message, webBreakAnywhere]}")
    expect(TOAST_SOURCE).toMatch(/<TextLink[^>]*numberOfLines=\{1\}[^>]*>\s*\{action\.label\}/)
  })
})

describe("Toast over an open sheet", () => {
  it("renders the root host only while no outlet is mounted, so a toast paints once", () => {
    expect(TOAST_SOURCE).toContain("entries.length > 0 && topOutlet === null")
    expect(TOAST_SOURCE).toContain('<ToastHost stage={stage} placement="root" />')
    expect(TOAST_SOURCE).toContain("stage.topOutlet !== seq")
    expect(TOAST_SOURCE).toContain('<ToastHost stage={stage} placement="sheet" />')
  })

  it("hands over before paint and lets the newest outlet win", () => {
    expect(TOAST_SOURCE).toContain("useLayoutEffect(() => register?.(seq), [register, seq])")
    expect(TOAST_SOURCE).toContain("const [seq] = useState(() => ++outletSeq)")
    expect(TOAST_SOURCE).toContain("Math.max(...outlets)")
  })

  it("keeps the overlay's own z-index rather than climbing over the first-run gate and boot splash", () => {
    expect(TOAST_SOURCE).toContain("zIndex: 80,")
  })

  it("clears the tab bar only from the root host", () => {
    expect(TOAST_SOURCE).toContain("toastDockFootprint(placement, tabBarHeight)")
  })

  it("is mounted as the last child of every open sheet's Modal", () => {
    expect(read("../ModalCardSheet.tsx")).toMatch(
      /\{visible \? <ToastOutlet \/> : null\}\s*<\/Modal>/,
    )
    // Inside the root, not beside it: the root is accessibilityViewIsModal, which hides its siblings.
    expect(read("../SlideUpSheet.tsx")).toMatch(
      /\{visible \? <ToastOutlet \/> : null\}\s*<\/View>\s*<\/Modal>/,
    )
    // The block confirmation is a ModalCardSheet, so it carries the outlet above.
    expect(read("../../bodies/personDetail/PersonModerationLayer.tsx")).toMatch(
      /<ModalCardSheet\s+visible=\{confirmingBlock\}/,
    )
  })
})

describe("Toast card layout", () => {
  it("breaks an unbreakable message inside the card on web", () => {
    expect(TOAST_SOURCE).toContain("style={[styles.message, webBreakAnywhere]}")
    expect(read("../../theme/webAffordances.ts")).toContain(
      'export const webBreakAnywhere: TextStyle = isWeb\n  ? webStyle({ overflowWrap: "anywhere" })\n  : {}',
    )
  })

  it("never shrinks the action label", () => {
    expect(TOAST_SOURCE).toMatch(/action: \{\s*flexShrink: 0,/)
    expect(TOAST_SOURCE).toContain("style={styles.action}")
  })

  it("holds the icon at 16 px in a non-shrinking box", () => {
    expect(TOAST_SOURCE).toMatch(
      /<View style=\{styles\.icon\}>\s*<Icon icon=\{iconMap\[iconName\]\} size=\{16\}/,
    )
    expect(TOAST_SOURCE).toMatch(/icon: \{\s*flexShrink: 0,\s*\}/)
  })
})
