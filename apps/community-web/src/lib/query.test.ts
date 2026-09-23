import { describe, expect, it } from "vitest"
import { AppError, ErrorCode } from "@civfix/shared"

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

describe("the web query client retries only transient failures", () => {
  const retry = makeQueryClient().getDefaultOptions().queries?.retry as (
    failureCount: number,
    error: unknown,
  ) => boolean

  it("never retries a 4xx, including rate limits and conflicts", () => {
    for (const code of [
      ErrorCode.UNAUTHORIZED,
      ErrorCode.NOT_FOUND,
      ErrorCode.VALIDATION,
      ErrorCode.RATE_LIMITED,
      ErrorCode.CONFLICT,
      ErrorCode.TURNSTILE_FAILED,
    ]) {
      expect(retry(0, new AppError(code, "no")), code).toBe(false)
    }
  })

  it("never retries a foreign-realm 4xx error (a second @civfix/shared copy)", () => {
    const foreign = { name: "AppError", code: ErrorCode.NOT_FOUND, message: "gone", httpStatus: 404 }
    expect(retry(0, foreign)).toBe(false)
  })

  it("retries network and server failures twice", () => {
    expect(retry(0, new TypeError("Failed to fetch"))).toBe(true)
    expect(retry(1, new AppError(ErrorCode.INTERNAL, "boom"))).toBe(true)
    expect(retry(2, new AppError(ErrorCode.INTERNAL, "boom"))).toBe(false)
  })
})
