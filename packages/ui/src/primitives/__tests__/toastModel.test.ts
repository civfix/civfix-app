import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  TOAST_ACTION_MS,
  TOAST_ERROR_MS,
  TOAST_QUIET_MS,
  toastBottomOffset,
  toastDurationMs,
  toastLiveSemantics,
} from "../toastModel"

const TOAST_SOURCE = readFileSync(new URL("../Toast.tsx", import.meta.url), "utf8")

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

describe("Toast host", () => {
  it("derives the dock footprint from the shell's tab bar store, never a constant", () => {
    expect(TOAST_SOURCE).toContain('import { useTabBarStore } from "../shell/tabBarStore"')
    expect(TOAST_SOURCE).toContain("useTabBarStore((state) => state.tabBarHeight)")
  })

  it("anchors at the bottom and lets touches through everywhere but the card", () => {
    expect(TOAST_SOURCE).toContain('pointerEvents="box-none"')
    expect(TOAST_SOURCE).not.toContain('pointerEvents="none"')
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
    expect(TOAST_SOURCE).toContain("accessibilityLiveRegion={live.liveRegion}")
    expect(TOAST_SOURCE).toContain("role={live.role}")
    for (const variant of ["success", "info", "error"] as const) {
      expect(toastLiveSemantics(variant, false).liveRegion).toBe("none")
      expect(toastLiveSemantics(variant, true).liveRegion).not.toBe("none")
    }
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
})
