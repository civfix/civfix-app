import { describe, expect, it } from "vitest"
import type { ResolveAddressResponse } from "@civfix/shared"
import { reportAddressPrefill } from "../reportAddressField"

const near = (line: string) => `Near ${line}`

function resolved(over: Partial<ResolveAddressResponse> = {}): ResolveAddressResponse {
  return {
    address: "123 Main St, Inglewood, CA",
    precision: "street",
    cityStateLabel: "Inglewood, CA",
    ...over,
  }
}

describe("reportAddressPrefill", () => {
  const base = {
    hasPoint: true,
    currentAddr: null,
    addrEdited: false,
    near,
  }

  it("fills an empty field from a located resolution", () => {
    expect(reportAddressPrefill({ ...base, resolution: resolved() })).toBe(
      "123 Main St, Inglewood, CA",
    )
  })

  it("prefixes a landmark so a POI never reads as a postal address", () => {
    expect(
      reportAddressPrefill({
        ...base,
        resolution: resolved({ address: "Vista Hermosa Park", precision: "landmark" }),
      }),
    ).toBe("Near Vista Hermosa Park")
  })

  it("leaves the field alone rather than filling it with a locality", () => {
    expect(
      reportAddressPrefill({
        ...base,
        resolution: resolved({ address: "Los Angeles, CA", precision: "locality" }),
      }),
    ).toBeNull()
  })

  it("leaves the field alone when resolution failed - filing is never blocked on an address", () => {
    expect(reportAddressPrefill({ ...base, resolution: null })).toBeNull()
    expect(reportAddressPrefill({ ...base, resolution: resolved({ address: null }) })).toBeNull()
  })

  it("waits for a point and for the request to settle", () => {
    expect(reportAddressPrefill({ ...base, resolution: undefined })).toBeNull()
    expect(reportAddressPrefill({ ...base, hasPoint: false, resolution: resolved() })).toBeNull()
  })

  it("never clobbers text the reporter typed", () => {
    expect(
      reportAddressPrefill({
        ...base,
        addrEdited: true,
        currentAddr: "Alley behind the market",
        resolution: resolved(),
      }),
    ).toBeNull()
  })

  it("settles once applied", () => {
    expect(
      reportAddressPrefill({
        ...base,
        currentAddr: "123 Main St, Inglewood, CA",
        resolution: resolved(),
      }),
    ).toBeNull()
  })

  it("clamps to the report wire maximum of 300, not 200", () => {
    const long = "x".repeat(400)
    expect(
      reportAddressPrefill({ ...base, resolution: resolved({ address: long }) })?.length,
    ).toBe(300)
  })
})
