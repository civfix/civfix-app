import { describe, expect, it } from "vitest"
import { AppError, ErrorCode } from "@civfix/shared"
import {
  APPROXIMATE_LOCATION_RETRY_LIMIT,
  approximateLocationShouldRetry,
} from "../approximateLocation"

describe("approximateLocationShouldRetry", () => {
  it("retries a transient failure while under the limit", () => {
    expect(approximateLocationShouldRetry(0, new Error("network"))).toBe(true)
    expect(approximateLocationShouldRetry(APPROXIMATE_LOCATION_RETRY_LIMIT - 1, new Error("network"))).toBe(true)
  })

  it("stops retrying a transient failure once the limit is reached", () => {
    expect(approximateLocationShouldRetry(APPROXIMATE_LOCATION_RETRY_LIMIT, new Error("network"))).toBe(false)
    expect(
      approximateLocationShouldRetry(APPROXIMATE_LOCATION_RETRY_LIMIT, new AppError(ErrorCode.RATE_LIMITED, "slow down")),
    ).toBe(false)
  })

  it("never retries a permanent failure", () => {
    expect(approximateLocationShouldRetry(0, new AppError(ErrorCode.NOT_FOUND, "no fix"))).toBe(false)
  })
})
