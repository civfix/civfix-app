import { describe, expect, it } from "vitest"
import { makeQueryClient } from "./query"

describe("the web query client keeps a returning screen's content instead of refetching it", () => {
  const queries = makeQueryClient().getDefaultOptions().queries

  it("holds content fresh for five minutes so a remount is a cache read", () => {
    expect(queries?.staleTime).toBe(5 * 60_000)
  })

  it("never refetches just because the browser tab regained focus", () => {
    expect(queries?.refetchOnWindowFocus).toBe(false)
  })

  it("keeps warm entries as long as the persisted cache does", () => {
    expect(queries?.gcTime).toBe(24 * 60 * 60_000)
  })
})
