import { describe, expect, it } from "vitest"
import { expectWrittenInLayoutEffect, layoutEffectBodies, sliceBetween, sliceFrom } from "./sourceGuards"

describe("sliceBetween", () => {
  it("returns the region between the anchors", () => {
    expect(sliceBetween("a START b END c", "START", "END")).toBe("START b ")
  })

  it("fails instead of widening or emptying the region when an anchor is gone", () => {
    expect(() => sliceBetween("a b END", "START", "END")).toThrow(/anchor "START" is gone/)
    expect(() => sliceBetween("a START b", "START", "END")).toThrow(/end anchor "END"/)
    expect(() => sliceBetween("END a START b", "START", "END")).toThrow(/end anchor "END"/)
  })
})

describe("sliceFrom", () => {
  it("fails when the anchor is gone rather than handing back the last character", () => {
    expect(sliceFrom("a START b", "START")).toBe("START b")
    expect(() => sliceFrom("a b", "START")).toThrow(/anchor "START" is gone/)
  })
})

describe("layoutEffectBodies", () => {
  it("matches each body by brace depth and reads its dependency list", () => {
    const src = [
      "useLayoutEffect(() => {",
      "  a.current = { x, y }",
      "})",
      "useLayoutEffect(() => {",
      "  if (on) { b() }",
      "}, [on])",
    ].join("\n")
    const effects = layoutEffectBodies(src)
    expect(effects).toHaveLength(2)
    expect(effects[0]).toEqual({ body: "\n  a.current = { x, y }\n", deps: null })
    expect(effects[1]?.deps).toBe("[on]")
    expect(effects[1]?.body).toContain("if (on) { b() }")
  })
})

describe("expectWrittenInLayoutEffect", () => {
  it("accepts a ref written inside a dependency-free layout effect", () => {
    expect(() =>
      expectWrittenInLayoutEffect("const r = useRef(v)\nuseLayoutEffect(() => {\n  r.current = v\n})", "r.current = v"),
    ).not.toThrow()
  })

  it("rejects a render-phase write that follows a mount-only layout effect", () => {
    const src = "useLayoutEffect(() => {\n  other()\n}, [])\nr.current = v"
    expect(() => expectWrittenInLayoutEffect(src, "r.current = v")).toThrow(/not inside a useLayoutEffect body/)
  })

  it("rejects a write inside a layout effect that does not run on every commit", () => {
    const src = "useLayoutEffect(() => {\n  r.current = v\n}, [])"
    expect(() => expectWrittenInLayoutEffect(src, "r.current = v")).toThrow(/after every commit/)
  })

  it("rejects a second, render-phase copy of the same write", () => {
    const src = "useLayoutEffect(() => {\n  r.current = v\n})\nr.current = v"
    expect(() => expectWrittenInLayoutEffect(src, "r.current = v")).toThrow(/exactly once/)
  })
})
