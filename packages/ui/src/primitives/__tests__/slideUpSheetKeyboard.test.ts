import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const SLIDE_UP = read("../SlideUpSheet.tsx")

describe("the slide-up sheet rides the canonical keyboard anchor", () => {
  it("lifts on the UI thread through KeyboardAnchorView instead of a padding avoider", () => {
    expect(SLIDE_UP).toContain('import { KeyboardAnchorView } from "../shell/KeyboardAnchorView"')
    expect(SLIDE_UP).toContain('import { useKeyboardAnchor } from "../shell/useKeyboardAnchor"')
    expect(SLIDE_UP).not.toContain("IosKeyboardAvoidingView")
    expect(SLIDE_UP).not.toContain("useKeyboardReserve")
    expect(SLIDE_UP).toMatch(/<KeyboardAnchorView\s+anchor=\{anchor\}\s+pointerEvents="box-none"/)
  })

  it("owns the keyboard for as long as the modal is rendered, so the close rides the OS curve too", () => {
    expect(SLIDE_UP).toContain(
      "const anchor = useKeyboardAnchor({ enabled: rendered, restOffset: homeIndicatorPad, gap: 0 })",
    )
  })

  it("tucks its home-indicator pad under the keyboard rather than re-laying out the sheet", () => {
    expect(SLIDE_UP).toContain("const homeIndicatorPad = insets?.bottom ?? 0")
    expect(SLIDE_UP).toMatch(/paddingBottom: homeIndicatorPad \+ th\.space\["3"\]/)
  })

  it("hands the reserved lift back as height, so only the shrinkable content gives way", () => {
    expect(SLIDE_UP).toMatch(
      /maxHeight: slideUpSheetMaxHeight\(\s*winH,\s*maxHeightRatio,\s*anchor\.reserved,\s*insets\?\.top \?\? 0,\s*\)/,
    )
    expect(SLIDE_UP).not.toMatch(/maxHeight: winH \* maxHeightRatio/)
  })

  it("dismisses the keyboard the moment the sheet is asked to close", () => {
    expect(SLIDE_UP).toMatch(/useEffect\(\(\) => \{\s*if \(!visible && rendered\) Keyboard\.dismiss\(\)\s*\}, \[visible, rendered\]\)/)
  })
})
