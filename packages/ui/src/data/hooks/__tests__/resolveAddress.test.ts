import { describe, expect, it } from "vitest"
import { geocodePointKey } from "@civfix/shared"
import type { ResolveAddressResponse } from "@civfix/shared"
import { queryKeys } from "../../keys"
import { fetchResolvedAddress } from "../resolveAddress"

const POINT = { lat: 34.052234, lng: -118.243685 }

function api(impl: () => Promise<ResolveAddressResponse>) {
  return { resolveAddress: impl }
}

describe("fetchResolvedAddress", () => {
  it("folds a located resolution through, trimmed", () => {
    return expect(
      fetchResolvedAddress(
        api(async () => ({
          address: "  123 Main St, Inglewood, CA  ",
          precision: "street",
          cityStateLabel: "  Inglewood, CA  ",
        })),
        POINT,
      ),
    ).resolves.toEqual({
      address: "123 Main St, Inglewood, CA",
      precision: "street",
      cityStateLabel: "Inglewood, CA",
    })
  })

  it("nulls a blank address rather than surfacing whitespace", () => {
    return expect(
      fetchResolvedAddress(
        api(async () => ({ address: "   ", precision: null, cityStateLabel: "Los Angeles, CA" })),
        POINT,
      ),
    ).resolves.toEqual({ address: null, precision: null, cityStateLabel: "Los Angeles, CA" })
  })

  it("resolves to null - not a rejection - when the endpoint 404s on an older server", async () => {
    const notFound = Object.assign(new Error("Not Found"), { status: 404, code: "NOT_FOUND" })
    await expect(
      fetchResolvedAddress(
        api(() => Promise.reject(notFound)),
        POINT,
      ),
    ).resolves.toBeNull()
  })

  it("resolves to null when the network is gone, so the caller falls to the manual path", async () => {
    await expect(
      fetchResolvedAddress(
        api(() => Promise.reject(new TypeError("Failed to fetch"))),
        POINT,
      ),
    ).resolves.toBeNull()
  })
})

describe("the resolved-address query key", () => {
  it("is the shared 5-decimal point key, so a pin fine-tune reuses one cache entry", () => {
    expect(queryKeys.resolvedAddress(geocodePointKey(POINT))).toEqual([
      "geocode",
      "address",
      "34.05223,-118.24368",
    ])
    expect(geocodePointKey({ lat: 34.0522341, lng: -118.2436812 })).toBe(
      geocodePointKey({ lat: 34.0522339, lng: -118.2436835 }),
    )
  })

  it("sits under one prefix the caller can invalidate wholesale", () => {
    expect(queryKeys.resolvedAddress("x").slice(0, 2)).toEqual([...queryKeys.resolvedAddressRoot])
  })
})
