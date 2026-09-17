import { describe, expect, it } from "vitest"
import type { ResolveAddressResponse } from "@civfix/shared"
import {
  composeEventAddress,
  eventAddressEdit,
  eventAddressPinMoved,
  eventAddressPrefill,
  eventAddressStatus,
  isEventAddressComplete,
  type EventAddressValue,
} from "../eventAddressField"

const COORDS = { lat: 34.05223, lng: -118.24368 }
const KEY = "34.05223,-118.24368"
const near = (line: string) => `Near ${line}`
const EMPTY: EventAddressValue = { address: "", addressSource: null, addressPointKey: null }

function resolved(over: Partial<ResolveAddressResponse> = {}): ResolveAddressResponse {
  return {
    address: "123 Main St, Inglewood, CA",
    precision: "street",
    cityStateLabel: "Inglewood, CA",
    ...over,
  }
}

describe("eventAddressPrefill", () => {
  it("prefills a located line and marks it resolved", () => {
    expect(
      eventAddressPrefill({ coords: COORDS, resolution: resolved(), current: EMPTY, near }),
    ).toEqual({
      address: "123 Main St, Inglewood, CA",
      addressSource: "resolved",
      addressPointKey: KEY,
    })
  })

  it("bakes the Near prefix into the field text for a landmark", () => {
    expect(
      eventAddressPrefill({
        coords: COORDS,
        resolution: resolved({ address: "Vista Hermosa Park", precision: "landmark" }),
        current: EMPTY,
        near,
      })?.address,
    ).toBe("Near Vista Hermosa Park")
  })

  it("requires a manual address when the pin only resolves to a locality", () => {
    expect(
      eventAddressPrefill({
        coords: COORDS,
        resolution: resolved({ address: "Los Angeles, CA", precision: "locality" }),
        current: EMPTY,
        near,
      }),
    ).toEqual({ address: "", addressSource: "manual", addressPointKey: KEY })
  })

  it("requires a manual address when resolution FAILED - a 404 is never a dead end", () => {
    expect(
      eventAddressPrefill({ coords: COORDS, resolution: null, current: EMPTY, near }),
    ).toEqual({ address: "", addressSource: "manual", addressPointKey: KEY })
  })

  it("waits while the resolution is still in flight", () => {
    expect(
      eventAddressPrefill({ coords: COORDS, resolution: undefined, current: EMPTY, near }),
    ).toBeNull()
    expect(
      eventAddressPrefill({ coords: null, resolution: resolved(), current: EMPTY, near }),
    ).toBeNull()
  })

  it("never clobbers text the host typed or edited", () => {
    const edited: EventAddressValue = {
      address: "Boathouse dock, 123 Main St",
      addressSource: "edited",
      addressPointKey: KEY,
    }
    expect(eventAddressPrefill({ coords: COORDS, resolution: resolved(), current: edited, near })).toBeNull()
    const manual: EventAddressValue = {
      address: "Gate 4, back lot",
      addressSource: "manual",
      addressPointKey: KEY,
    }
    expect(eventAddressPrefill({ coords: COORDS, resolution: null, current: manual, near })).toBeNull()
  })

  it("re-resolves in place when the host moves a pin whose address was never touched", () => {
    const already: EventAddressValue = {
      address: "123 Main St, Inglewood, CA",
      addressSource: "resolved",
      addressPointKey: "34.00000,-118.00000",
    }
    expect(
      eventAddressPrefill({
        coords: COORDS,
        resolution: resolved({ address: "500 Ocean Ave, Santa Monica, CA" }),
        current: already,
        near,
      }),
    ).toEqual({
      address: "500 Ocean Ave, Santa Monica, CA",
      addressSource: "resolved",
      addressPointKey: KEY,
    })
  })

  it("settles - a second pass over an applied prefill changes nothing", () => {
    const applied: EventAddressValue = {
      address: "123 Main St, Inglewood, CA",
      addressSource: "resolved",
      addressPointKey: KEY,
    }
    expect(
      eventAddressPrefill({ coords: COORDS, resolution: resolved(), current: applied, near }),
    ).toBeNull()
  })
})

describe("eventAddressEdit", () => {
  it("flips a resolved line to edited the moment the host touches it", () => {
    expect(
      eventAddressEdit({
        text: "Boathouse dock, 123 Main St",
        coords: COORDS,
        current: { address: "123 Main St", addressSource: "resolved", addressPointKey: KEY },
      }),
    ).toEqual({
      address: "Boathouse dock, 123 Main St",
      addressSource: "edited",
      addressPointKey: KEY,
    })
  })

  it("keeps a from-scratch line manual", () => {
    expect(eventAddressEdit({ text: "Gate 4", coords: COORDS, current: EMPTY }).addressSource).toBe(
      "manual",
    )
    expect(
      eventAddressEdit({
        text: "Gate 4 rear",
        coords: COORDS,
        current: { address: "Gate 4", addressSource: "manual", addressPointKey: KEY },
      }).addressSource,
    ).toBe("manual")
  })

  it("clamps to the wire maximum", () => {
    expect(
      eventAddressEdit({ text: "x".repeat(400), coords: COORDS, current: EMPTY }).address.length,
    ).toBe(200)
  })
})

describe("eventAddressPinMoved", () => {
  it("warns only when host-owned text is now attached to a different point", () => {
    const edited: EventAddressValue = {
      address: "Gate 4",
      addressSource: "edited",
      addressPointKey: "34.00000,-118.00000",
    }
    expect(eventAddressPinMoved({ coords: COORDS, current: edited })).toBe(true)
    expect(eventAddressPinMoved({ coords: COORDS, current: { ...edited, addressPointKey: KEY } })).toBe(
      false,
    )
  })

  it("stays quiet for a resolved line, which simply re-resolves", () => {
    expect(
      eventAddressPinMoved({
        coords: COORDS,
        current: { address: "123 Main St", addressSource: "resolved", addressPointKey: "1.00000,2.00000" },
      }),
    ).toBe(false)
  })

  it("stays quiet with nothing to compare", () => {
    expect(eventAddressPinMoved({ coords: null, current: EMPTY })).toBe(false)
    expect(eventAddressPinMoved({ coords: COORDS, current: EMPTY })).toBe(false)
  })
})

describe("isEventAddressComplete", () => {
  it("demands three real characters", () => {
    expect(isEventAddressComplete("")).toBe(false)
    expect(isEventAddressComplete("   ")).toBe(false)
    expect(isEventAddressComplete("ab")).toBe(false)
    expect(isEventAddressComplete(" 123 ")).toBe(true)
  })
})

describe("composeEventAddress", () => {
  it("folds the spot name in front of the verified line without losing either", () => {
    expect(
      composeEventAddress({
        address: "123 Main St, Inglewood, CA",
        addressSource: "resolved",
        spot: "Boathouse dock",
      }),
    ).toEqual({
      address: "Boathouse dock, 123 Main St, Inglewood, CA",
      addressSource: "edited",
    })
  })

  it("sends the verified line untouched when there is no spot name", () => {
    expect(
      composeEventAddress({ address: "123 Main St", addressSource: "resolved", spot: "  " }),
    ).toEqual({ address: "123 Main St", addressSource: "resolved" })
  })

  it("keeps a manual line manual even with a spot name in front of it", () => {
    expect(
      composeEventAddress({ address: "Gate 4", addressSource: "manual", spot: "Back lot" }),
    ).toEqual({ address: "Back lot, Gate 4", addressSource: "manual" })
  })

  it("does not double up when the host already typed the spot into the address", () => {
    expect(
      composeEventAddress({
        address: "Boathouse dock, 123 Main St",
        addressSource: "edited",
        spot: "Boathouse dock",
      }),
    ).toEqual({ address: "Boathouse dock, 123 Main St", addressSource: "edited" })
  })

  it("refuses to build a payload from a blank address, so publish stays blocked", () => {
    expect(composeEventAddress({ address: "   ", addressSource: null, spot: "Back lot" })).toBeNull()
  })

  it("clamps the composed line to the wire maximum", () => {
    const composed = composeEventAddress({
      address: "y".repeat(190),
      addressSource: "resolved",
      spot: "z".repeat(40),
    })
    expect(composed?.address.length).toBe(200)
  })
})

describe("eventAddressStatus", () => {
  it("is idle before a pin exists", () => {
    expect(eventAddressStatus({ hasCoords: false, isResolving: true, addressSource: null })).toBe("idle")
  })

  it("shimmers while the first resolution is in flight", () => {
    expect(eventAddressStatus({ hasCoords: true, isResolving: true, addressSource: null })).toBe(
      "resolving",
    )
  })

  it("reports the settled source once one exists", () => {
    expect(eventAddressStatus({ hasCoords: true, isResolving: false, addressSource: "resolved" })).toBe(
      "resolved",
    )
    expect(eventAddressStatus({ hasCoords: true, isResolving: false, addressSource: "edited" })).toBe(
      "resolved",
    )
    expect(eventAddressStatus({ hasCoords: true, isResolving: false, addressSource: "manual" })).toBe(
      "manual",
    )
  })
})
