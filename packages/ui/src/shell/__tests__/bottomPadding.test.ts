import { describe, expect, it, vi } from "vitest"

type Style = Record<string, unknown> | null | undefined | false | Style[]

const flatten = (style: Style): Record<string, unknown> | undefined => {
  if (!style) return undefined
  if (!Array.isArray(style)) return style
  return style.reduce<Record<string, unknown>>((acc, item) => ({ ...acc, ...flatten(item) }), {})
}

vi.mock("react-native", () => ({ StyleSheet: { flatten } }))

const { withExtraBottomPadding } = await import("../bottomPadding")

describe("withExtraBottomPadding", () => {
  it("adds the extra ON TOP of the style's own numeric bottom gutter", () => {
    const style = { paddingBottom: 24, gap: 8 }
    expect(withExtraBottomPadding(style, 40)).toEqual([style, { paddingBottom: 64 }])
  })

  it("reads the gutter through a nested style array, last entry winning", () => {
    const style = [{ paddingBottom: 4 }, [{ paddingBottom: 12 }]]
    expect(withExtraBottomPadding(style, 10)).toEqual([style, { paddingBottom: 22 }])
  })

  it("treats a missing, empty or non-numeric gutter as zero", () => {
    expect(withExtraBottomPadding(undefined, 30)).toEqual([undefined, { paddingBottom: 30 }])
    expect(withExtraBottomPadding({}, 30)).toEqual([{}, { paddingBottom: 30 }])
    expect(withExtraBottomPadding({ paddingBottom: "10%" }, 30)).toEqual([
      { paddingBottom: "10%" },
      { paddingBottom: 30 },
    ])
  })

  it("still appends an explicit override for a zero extra, so the caller's guard decides", () => {
    const style = { paddingBottom: 16 }
    expect(withExtraBottomPadding(style, 0)).toEqual([style, { paddingBottom: 16 }])
  })

  it("keeps the caller's style object by identity as the first entry", () => {
    const style = { paddingBottom: 2 }
    expect(withExtraBottomPadding(style, 1)[0]).toBe(style)
  })
})
