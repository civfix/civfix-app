import { afterEach, describe, expect, it, vi } from "vitest"

const FLAG = "🇺🇸"
const FAMILY = "👩‍👩‍👧"
const THUMB = "👍🏽"
const ACCENT = "é"

async function loadWithoutSegmenter(): Promise<typeof import("../graphemes.js")> {
  vi.resetModules()
  const original = Intl.Segmenter
  Reflect.deleteProperty(Intl as unknown as Record<string, unknown>, "Segmenter")
  try {
    return await import("../graphemes.js")
  } finally {
    Object.defineProperty(Intl, "Segmenter", { value: original, configurable: true, writable: true })
  }
}

afterEach(() => {
  vi.resetModules()
})

describe("segmentGraphemes with Intl.Segmenter", () => {
  it("keeps flags, ZWJ sequences, skin tones and combining marks whole", async () => {
    const { segmentGraphemes } = await import("../graphemes.js")
    expect(segmentGraphemes(`${FLAG}${FAMILY}${THUMB}${ACCENT}`)).toEqual([FLAG, FAMILY, THUMB, ACCENT])
    expect(segmentGraphemes("")).toEqual([])
  })
})

describe("segmentGraphemes fallback (no Intl.Segmenter, e.g. a trimmed RN runtime)", () => {
  it("still keeps flags, ZWJ sequences, skin tones and combining marks whole", async () => {
    const { segmentGraphemes, graphemeLength } = await loadWithoutSegmenter()
    expect(segmentGraphemes(`${FLAG}${FAMILY}${THUMB}${ACCENT}`)).toEqual([FLAG, FAMILY, THUMB, ACCENT])
    expect(graphemeLength(`${FLAG}${FLAG}`)).toBe(2)
    expect(graphemeLength("abc")).toBe(3)
  })

  it("never splits a surrogate pair when truncating", async () => {
    const { truncateGraphemes } = await loadWithoutSegmenter()
    const truncated = truncateGraphemes(`${FAMILY}${FAMILY}${FAMILY}`, 2)
    expect(truncated).toBe(`${FAMILY}…`)
    expect(truncated.includes("�")).toBe(false)
  })
})
