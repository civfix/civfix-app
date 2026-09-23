import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../__tests__/sourceGuards"

const source = readFileSync(new URL("../AnchoredPopover.tsx", import.meta.url), "utf8")

describe("AnchoredPopover returns focus to the trigger as it is at close time", () => {
  it("reads the trigger ref inside the close callback, not a copy taken when the popover opened", () => {
    const returnFocus = sliceBetween(
      source,
      "const returnFocus = useCallback(",
      "}, [cancelPendingFocus, returnFocusRef])",
    )
    expect(returnFocus).toContain("cancelPendingFocus()")
    expect(returnFocus).toContain("focusAccessibilityNode(returnFocusRef?.current)")
  })

  it("runs that callback as the cleanup of the rendered popover", () => {
    const effect = sliceBetween(source, "if (!rendered) return", "}, [rendered, returnFocus])")
    expect(effect).toContain("return returnFocus")
  })
})
