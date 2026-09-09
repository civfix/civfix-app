import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const SRC = readFileSync(new URL("../CreateMenu.tsx", import.meta.url), "utf8")

const focusEffect = (() => {
  const start = SRC.indexOf("returnFocusRef.current = document.activeElement")
  expect(start, "the focus-move effect is gone - re-scope the guard, do not delete it").toBeGreaterThan(
    -1,
  )
  const head = SRC.lastIndexOf("useEffect(", start)
  const tail = SRC.indexOf("])", start)
  return SRC.slice(head, tail + 2)
})()

describe("CreateMenu: focus enters the menu only once the menu is MOUNTED", () => {
  it("gates the web focus move on motion.rendered, not on open alone", () => {
    expect(focusEffect).toContain("if (!open || !motion.rendered")
    expect(focusEffect).toContain("focusNode(firstItemRef.current)")
    expect(focusEffect, "keyed on open alone, the effect runs on the commit that returns null").toMatch(
      /\}, \[open, motion\.rendered\]\)/,
    )
  })

  it("still restores the trigger's focus on the way out", () => {
    expect(focusEffect).toContain("const target = returnFocusRef.current")
    expect(focusEffect).toContain("returnFocusRef.current = null")
    expect(focusEffect).toContain("focusNode(target)")
  })

  it("bails out of rendering on the same flag the focus move waits for", () => {
    expect(SRC).toContain("if (!motion.rendered) return null")
  })

  it("marks the open menu modal for BOTH platforms' probes", () => {
    expect(SRC).toContain("accessibilityViewIsModal")
    expect(SRC, "useShellKeys probes [aria-modal=true]; RNW 0.21 honors aria-modal").toContain(
      "aria-modal={true}",
    )
  })
})
