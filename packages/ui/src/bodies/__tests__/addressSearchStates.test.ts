import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as suggest from "../addressSuggestRequest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
const addressSearch = strip(read("../AddressSearch.tsx"))

type Helpers = {
  settleWithin?: <T>(p: Promise<T>, ms: number) => Promise<T | null>
  addressSearchStatus?: (input: {
    open: boolean
    loading: boolean
    failed: boolean
    resultCount: number
    query: string
  }) => string
  PROXIMITY_FIX_TIMEOUT_MS?: number
}
const helpers = suggest as unknown as Helpers

describe("address search proximity bias never waits on an unanswered permission prompt", () => {
  afterEach(() => vi.useRealTimers())

  it("settles null once the cap passes when the device fix never answers", async () => {
    expect(typeof helpers.settleWithin).toBe("function")
    vi.useFakeTimers()
    const settled = helpers.settleWithin!(new Promise<never>(() => {}), 4000)
    vi.advanceTimersByTime(4000)
    await expect(settled).resolves.toBeNull()
  })

  it("passes a fix through and flattens a denial to null", async () => {
    await expect(helpers.settleWithin!(Promise.resolve(7), 50)).resolves.toBe(7)
    await expect(helpers.settleWithin!(Promise.reject(new Error("denied")), 50)).resolves.toBeNull()
  })

  it("caps the device fix inside AddressSearch at 4 s", () => {
    expect(helpers.PROXIMITY_FIX_TIMEOUT_MS).toBe(4000)
    expect(addressSearch).toContain("settleWithin(geo.getCurrentPosition(), PROXIMITY_FIX_TIMEOUT_MS)")
  })
})

describe("address search dropdown states", () => {
  const base = { open: true, loading: false, failed: false, resultCount: 0, query: "main st" }

  it("tells a failed suggest apart from an honest no-matches answer", () => {
    expect(typeof helpers.addressSearchStatus).toBe("function")
    expect(helpers.addressSearchStatus!({ ...base, failed: true })).toBe("failed")
    expect(helpers.addressSearchStatus!(base)).toBe("empty")
  })

  it("shows results whenever there are some, and nothing while loading, closed or blank", () => {
    expect(helpers.addressSearchStatus!({ ...base, resultCount: 2 })).toBe("results")
    expect(helpers.addressSearchStatus!({ ...base, loading: true })).toBe("closed")
    expect(helpers.addressSearchStatus!({ ...base, open: false, resultCount: 2 })).toBe("closed")
    expect(helpers.addressSearchStatus!({ ...base, query: "  " })).toBe("closed")
  })

  it("renders the failed state with a retry and marks the request as failed on error", () => {
    expect(addressSearch).toContain('status === "failed" ? (')
    expect(addressSearch).toContain('t("error.failed")')
    expect(addressSearch).toContain("onPress={() => void runSearch(value)}")
    expect(addressSearch).toMatch(/if \(!ac\.signal\.aborted\) \{\s*setResults\(\[\]\)\s*setFailed\(true\)/)
  })
})

describe("address search accessibility", () => {
  it("names the input for assistive tech instead of relying on the placeholder", () => {
    expect(addressSearch).toMatch(/placeholder=\{t\("input\.placeholder"\)\}\s*accessibilityLabel=\{t\("input\.a11y"\)\}/)
  })

  it("announces the settled result count, the no-matches answer and a failure", () => {
    expect(addressSearch).toContain('import { announce } from "../announce"')
    expect(addressSearch).toContain('t("results.count", { count: res.suggestions.length })')
    expect(addressSearch).toContain(': t("empty.noMatches"),')
    expect(addressSearch).toContain('announce(t("error.failed"))')
  })
})
