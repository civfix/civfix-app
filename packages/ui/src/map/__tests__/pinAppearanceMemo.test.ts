/**
 * Every rendered pin asks for its outline and glyph ink. `pinOutlineFor` scores all ~15 pin fills against
 * the basemap and `inkOnFill` scores two inks, so a map of a few hundred pins redid thousands of WCAG
 * contrast computations per render. Both answers depend only on the scheme (and the fill), so they are
 * computed once per input.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as ChipContrast from "@civfix/shared/chip-contrast"
import { colorSchemes } from "@civfix/shared/tokens"

const calls = vi.hoisted(() => ({ count: 0 }))

vi.mock("@civfix/shared/chip-contrast", async (importOriginal) => {
  const actual = await importOriginal<typeof ChipContrast>()
  return {
    ...actual,
    contrastRatio: (a: string, b: string) => {
      calls.count += 1
      return actual.contrastRatio(a, b)
    },
  }
})

const { inkOnFill, pinOutlineFor } = await import("../pins/appearance")

describe("pin appearance is computed once per scheme", () => {
  beforeEach(() => {
    calls.count = 0
  })

  it("scores the outline once per scheme, then answers from memory", () => {
    const first = pinOutlineFor("light")
    const afterFirst = calls.count
    for (let i = 0; i < 50; i += 1) expect(pinOutlineFor("light")).toBe(first)
    expect(calls.count).toBe(afterFirst)
    pinOutlineFor("dark")
    expect(calls.count).toBeGreaterThan(afterFirst)
  })

  it("scores a fill's glyph ink once per scheme and ink pair", () => {
    const fill = colorSchemes.dark.brand.sky
    const onAccent = colorSchemes.dark.neutral.paper
    const first = inkOnFill(fill, "dark", onAccent)
    const afterFirst = calls.count
    for (let i = 0; i < 50; i += 1) expect(inkOnFill(fill, "dark", onAccent)).toBe(first)
    expect(calls.count).toBe(afterFirst)
    inkOnFill(fill, "light", onAccent)
    expect(calls.count).toBeGreaterThan(afterFirst)
  })
})
