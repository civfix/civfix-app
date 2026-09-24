import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { ALL_DETAIL_KINDS } from "../../nav"
import { BODY_LAYOUT, pageBottomReserve } from "../bodyLayout"
import { personDetailSource } from "../../bodies/personDetail/__tests__/personDetailSource"

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8")

const SCROLL_KINDS = ALL_DETAIL_KINDS.filter((kind) => BODY_LAYOUT[kind] === "scroll")
const BOX_KINDS = ALL_DETAIL_KINDS.filter((kind) => pageBottomReserve(kind) === "box")

describe("pageBottomReserve - where a full page wears its safe-area bottom", () => {
  it("routes every scroll-owning body's reserve into its scroll CONTENT, so the list runs under the home indicator", () => {
    for (const kind of SCROLL_KINDS) expect(pageBottomReserve(kind), kind).toBe("content")
  })

  it("keeps the person page on the content path: table-full for presentation, but it pins no footer", () => {
    expect(BODY_LAYOUT.person).toBe("full")
    expect(pageBottomReserve("person")).toBe("content")
  })

  it("boxes only the pages that pin a composer or footer under their list", () => {
    expect([...BOX_KINDS].sort()).toEqual(["composer", "new-channel", "new-group", "post-thread", "thread"])
  })

  it("never boxes a table-scroll kind: by the table's own definition such a body pins nothing", () => {
    for (const kind of BOX_KINDS) expect(BODY_LAYOUT[kind], kind).toBe("full")
  })

  it("treats a view entry as content", () => {
    expect(pageBottomReserve("view")).toBe("content")
  })
})

describe("PageStack.native routes the reserve per layer", () => {
  const src = read("../PageStack.native.tsx")

  it("pads the layer box only for a footer-pinning page, and hands a scroll-owning page its reserve as content padding", () => {
    expect(src).toMatch(/const reserve = pageBottomReserve\(entry\.kind\)/)
    expect(src).toMatch(/const boxReserve = \(reserve === "box" \? paddingBottom : 0\) \+ keyboardReserve/)
    expect(src).toMatch(/const contentReserve = reserve === "content" \? paddingBottom : 0/)
    expect(src).toMatch(
      /const bodyScrollHost = reserve === "content" \? contentBottomReserveScrollHost\(scrollHost\) : scrollHost/,
    )
    expect(src).toMatch(/<View style=\{\[styles\.layerContent, \{ paddingBottom: boxReserve, paddingTop \}\]\}>/)
    expect(src).toMatch(
      /<ContentBottomReserveProvider value=\{contentReserve\}>\s*<ScrollHostProvider value=\{bodyScrollHost\}>/,
    )
    expect(src).not.toMatch(/paddingBottom: paddingBottom \+ keyboardReserve/)
  })

  it("keeps the composer's keyboard reserve on the box in both modes", () => {
    expect(src).toMatch(/\+ keyboardReserve\n/)
    expect(src).not.toMatch(/contentReserve[^\n]*keyboardReserve/)
  })
})

describe("ContentBottomReserve - the one additive content-padding decorator", () => {
  const src = read("../ContentBottomReserve.tsx")

  it("adds the reserve ON TOP of the body's own bottom gutter and leaves horizontal scrollers alone", () => {
    expect(src).toMatch(/if \(horizontal \|\| reserve <= 0\) return contentContainerStyle/)
    expect(src).toMatch(/return \[contentContainerStyle, \{ paddingBottom: basePad \+ reserve \}\]/)
  })

  it("memoizes the decorated host per base so a page body never remounts on a re-render", () => {
    expect(src).toMatch(/new WeakMap<ScrollHostValue, ScrollHostValue>\(\)/)
    expect(src).toMatch(/const cached = RESERVED_HOSTS\.get\(base\)\s*\n\s*if \(cached\) return cached/)
  })

  it("is the sheet's safe-area content padding too, not a second copy of it", () => {
    const sheet = read("../CompactShell.native.tsx")
    expect(sheet).toMatch(
      /const SHEET_SCROLL_HOST_SAFE_BOTTOM = makeContentBottomReserveScrollHost\(\s*SHEET_SCROLL_HOST,\s*useSafeAreaBottom,\s*\)/,
    )
    expect(sheet).not.toMatch(/makeSafeAreaPaddedScroll/)
  })
})

describe("the profile bodies take the page's scroll host, so the reserve reaches them", () => {
  it("PersonDetailBody inherits the shell host instead of building its own", () => {
    const src = personDetailSource()
    expect(src).toMatch(/const \{ ScrollView \} = useScrollHost\(\)/)
    expect(src).not.toMatch(/PERSON_SCROLL_HOST|makeKeyboardAwareScrollHost|ScrollHostProvider/)
  })

  it("ProfileBody reads the host directly", () => {
    const src = read("../../bodies/ProfileBody.tsx")
    expect(src).toMatch(/const \{ ScrollView \} = useScrollHost\(\)/)
    expect(src).not.toMatch(/ScrollHostProvider/)
  })
})
