import { describe, expect, it } from "vitest"
import { assignMergedRef } from "../useMergedRef"

describe("assignMergedRef", () => {
  it("fills the inner ref and calls a callback ref with the same node", () => {
    const inner = { current: null as string | null }
    const seen: Array<string | null> = []
    assignMergedRef(inner, (node: string | null) => seen.push(node), "a")
    expect(inner.current).toBe("a")
    expect(seen).toEqual(["a"])
  })

  it("fills an object ref alongside the inner ref", () => {
    const inner = { current: null as string | null }
    const forwarded = { current: null as string | null }
    assignMergedRef(inner, forwarded, "b")
    expect(inner.current).toBe("b")
    expect(forwarded.current).toBe("b")
  })

  it("clears both on unmount (a null node)", () => {
    const inner = { current: "x" as string | null }
    const forwarded = { current: "x" as string | null }
    assignMergedRef(inner, forwarded, null)
    expect(inner.current).toBeNull()
    expect(forwarded.current).toBeNull()
  })

  it("tolerates a null forwarded ref", () => {
    const inner = { current: null as string | null }
    assignMergedRef(inner, null, "c")
    expect(inner.current).toBe("c")
  })
})
