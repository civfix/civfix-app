/**
 * Unit tests for the sub-4 reverse-label DISPLAY logic (issue #61): `reverseLabelText` folds the resolved
 * geocoder label + the point into one string - the ADDRESS when one resolves, else the exact coordinates to
 * 5 decimals - and `coordsLabel` is the coords fallback itself. Pure (no hooks / no network), so vitest
 * exercises them directly.
 */
import { describe, expect, it } from "vitest"
import { coordsLabel, fetchReverseLabel, reverseLabelText } from "../hooks/reverseLabel"
import { fetchJurisdiction } from "../hooks/reports"

describe("coordsLabel", () => {
  it("formats lat/lng to exactly 5 decimals", () => {
    expect(coordsLabel({ lat: 40.7127837, lng: -74.0059413 })).toBe("40.71278, -74.00594")
  })

  it("pads short coordinates to 5 decimals", () => {
    expect(coordsLabel({ lat: 1, lng: -2.5 })).toBe("1.00000, -2.50000")
  })
})

describe("reverseLabelText (sub-4: address, else exact coords)", () => {
  const point = { lat: 37.77493, lng: -122.41942 }

  it("shows the address when the geocoder resolved one", () => {
    expect(reverseLabelText("San Francisco, CA", point)).toBe("San Francisco, CA")
  })

  it("trims surrounding whitespace from a resolved address", () => {
    expect(reverseLabelText("  Oakland, CA  ", point)).toBe("Oakland, CA")
  })

  it("falls back to exact coords when the label is null (no coverage)", () => {
    expect(reverseLabelText(null, point)).toBe("37.77493, -122.41942")
  })

  it("falls back to exact coords while the label is still loading (undefined)", () => {
    expect(reverseLabelText(undefined, point)).toBe("37.77493, -122.41942")
  })

  it("falls back to exact coords for a blank/whitespace label", () => {
    expect(reverseLabelText("   ", point)).toBe("37.77493, -122.41942")
  })

  it("returns an empty string when there is no point and no label", () => {
    expect(reverseLabelText(null, null)).toBe("")
  })

  it("prefers the address even when a point is present", () => {
    expect(reverseLabelText("123 Main St", point)).toBe("123 Main St")
  })
})

describe("fetchReverseLabel (a transient failure is not cached as 'no address')", () => {
  const point = { lat: 37.77493, lng: -122.41942 }
  const api = (reverseLabel: () => Promise<unknown>) =>
    ({ reverseLabel }) as unknown as Parameters<typeof fetchReverseLabel>[0]

  it("returns the trimmed label", async () => {
    await expect(fetchReverseLabel(api(async () => ({ cityStateLabel: " Oakland, CA " })), point)).resolves.toBe(
      "Oakland, CA",
    )
  })

  it("returns null when the geocoder cannot place the point", async () => {
    await expect(fetchReverseLabel(api(async () => ({ cityStateLabel: "" })), point)).resolves.toBeNull()
    await expect(
      fetchReverseLabel(api(() => Promise.reject(Object.assign(new Error("nf"), { code: "NOT_FOUND" }))), point),
    ).resolves.toBeNull()
  })

  it("rejects a network or rate-limit failure instead of resolving null", async () => {
    await expect(fetchReverseLabel(api(() => Promise.reject(new TypeError("Failed to fetch"))), point)).rejects.toThrow()
    const rateLimited = Object.assign(new Error("Too Many Requests"), { status: 429, code: "RATE_LIMITED" })
    await expect(fetchReverseLabel(api(() => Promise.reject(rateLimited)), point)).rejects.toBe(rateLimited)
  })
})

describe("fetchJurisdiction (a transient failure is not cached as 'no jurisdiction')", () => {
  const api = (resolveJurisdiction: () => Promise<unknown>) =>
    ({ resolveJurisdiction }) as unknown as Parameters<typeof fetchJurisdiction>[0]

  it("returns null for an uncovered point", async () => {
    await expect(fetchJurisdiction(api(async () => null), 1, 2)).resolves.toBeNull()
  })

  it("rejects a server or network failure instead of resolving null", async () => {
    const serverError = Object.assign(new Error("boom"), { status: 500, code: "INTERNAL" })
    await expect(fetchJurisdiction(api(() => Promise.reject(serverError)), 1, 2)).rejects.toBe(serverError)
  })
})
