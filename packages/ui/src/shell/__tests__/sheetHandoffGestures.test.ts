import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../__tests__/sourceGuards"

const seam = readFileSync(join(__dirname, "..", "SheetHandoffScroll.native.tsx"), "utf8")

describe("T13: SheetHandoffScroll.native hands off through Gesture Handler 3's hooks", () => {
  const panConfig = () => sliceBetween(seam, "const pan = usePanGesture({\n", "\n    })\n")

  it("keeps the pan on the UI thread, manually activated, and alive outside the scrollable", () => {
    expect(seam.split("usePanGesture(").length - 1).toBe(1)
    const pan = panConfig()
    expect(pan).toMatch(/runOnJS: false,/)
    expect(pan).toMatch(/manualActivation: true,/)
    expect(pan).toMatch(/shouldCancelWhenOutside: false,/)
  })

  it("keeps every handoff phase, under Gesture Handler 3's callback names", () => {
    const pan = panConfig()
    for (const callback of [
      "onTouchesDown",
      "onTouchesMove",
      "onActivate",
      "onUpdate",
      "onDeactivate",
      "onFinalize",
    ]) {
      expect(pan).toMatch(new RegExp(`\\n {6}${callback}: \\(`))
    }
    expect(pan).not.toMatch(/\bonStart\b|\bonEnd\b/)
  })

  it("activates the pan from onTouchesMove through the state manager, on the engage decision", () => {
    const pan = panConfig()
    const touchesMove = sliceBetween(pan, "onTouchesMove: (e) => {", "onActivate:")
    expect(touchesMove).toMatch(
      /if \(\s*shouldEngageHandoff\([\s\S]*?\)\s*\) \{\s*GestureStateManager\.activate\(e\.handlerTag\)\s*\}/,
    )
    expect(pan).not.toMatch(/state\.activate\(\)/)
  })

  it("runs the scrollable's native gesture alongside the pan, also alive outside it", () => {
    expect(seam.split("useNativeGesture(").length - 1).toBe(1)
    const native = sliceBetween(seam, "const native = useNativeGesture({", "})\n")
    expect(native).toMatch(/simultaneousWith: pan,/)
    expect(native).toMatch(/shouldCancelWhenOutside: false\b/)
  })

  it("still nests the scrollable's detector inside the pan's", () => {
    expect(seam).toMatch(
      /<GestureDetector gesture=\{pan\}>\s*<View style=\{FILL\}>\s*<GestureDetector gesture=\{native\}>/,
    )
  })
})
