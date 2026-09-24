import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useMediaQuery } from "./use-media-query"

const original = window.matchMedia

afterEach(() => {
  cleanup()
  window.matchMedia = original
})

function stubMatchMedia(matching: string) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query === matching,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

describe("useMediaQuery", () => {
  it("reports a matching query on the very first render", () => {
    stubMatchMedia("(min-width: 1440px)")
    const seen: boolean[] = []
    renderHook(() => {
      const wide = useMediaQuery("(min-width: 1440px)")
      seen.push(wide)
      return wide
    })
    expect(seen[0]).toBe(true)
  })

  it("reports false for a query that does not match", () => {
    stubMatchMedia("(min-width: 1440px)")
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"))
    expect(result.current).toBe(false)
  })
})
