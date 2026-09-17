import { describe, expect, it } from "vitest"
import {
  addressExternalPlan,
  addressMapsOptions,
  addressRowAffordances,
  appleMapsUrl,
  applyNearPrefix,
  geoUri,
  googleMapsUrl,
  stripNearPrefix,
} from "../addressRowModel"

const POINT = { lat: 34.05223, lng: -118.24368 }
const near = (address: string) => `Near ${address}`

describe("applyNearPrefix", () => {
  it("prefixes only a landmark line, so a postal address is never dressed up as approximate", () => {
    expect(applyNearPrefix("Vista Hermosa Park, Los Angeles, CA", "landmark", near)).toBe(
      "Near Vista Hermosa Park, Los Angeles, CA",
    )
    expect(applyNearPrefix("123 Main St, Inglewood, CA", "street", near)).toBe(
      "123 Main St, Inglewood, CA",
    )
    expect(applyNearPrefix("Main St & 5th Ave, Inglewood, CA", "intersection", near)).toBe(
      "Main St & 5th Ave, Inglewood, CA",
    )
    expect(applyNearPrefix("Los Angeles, CA", "locality", near)).toBe("Los Angeles, CA")
    expect(applyNearPrefix("123 Main St", null, near)).toBe("123 Main St")
    expect(applyNearPrefix("123 Main St", undefined, near)).toBe("123 Main St")
  })

  it("trims and never prefixes an empty line", () => {
    expect(applyNearPrefix("  123 Main St  ", "street", near)).toBe("123 Main St")
    expect(applyNearPrefix("   ", "landmark", near)).toBe("")
  })
})

describe("stripNearPrefix", () => {
  const korean = (address: string) => `${address} 근처`

  it("peels the localized wrapper back off, whichever side it sits on", () => {
    expect(stripNearPrefix("Near Vista Hermosa Park", near)).toBe("Vista Hermosa Park")
    expect(stripNearPrefix("Vista Hermosa Park 근처", korean)).toBe("Vista Hermosa Park")
  })

  it("leaves a line that never carried the wrapper alone", () => {
    expect(stripNearPrefix("123 Main St", near)).toBe("123 Main St")
    expect(stripNearPrefix("  123 Main St  ", near)).toBe("123 Main St")
    expect(stripNearPrefix("", near)).toBe("")
  })

  it("does not strip itself down to nothing", () => {
    expect(stripNearPrefix("Near", near)).toBe("Near")
  })
})

describe("appleMapsUrl", () => {
  it("sends the verified address text with ll as the disambiguator", () => {
    expect(
      appleMapsUrl({ address: "123 Main St, Inglewood, CA", point: POINT, verified: true }),
    ).toBe(
      "https://maps.apple.com/?address=123%20Main%20St%2C%20Inglewood%2C%20CA&ll=34.05223%2C-118.24368",
    )
  })

  it("falls back to coordinates when the address is not host-verified", () => {
    expect(
      appleMapsUrl({
        address: "Vista Hermosa Park",
        point: POINT,
        verified: false,
        title: "Park cleanup",
      }),
    ).toBe("https://maps.apple.com/?ll=34.05223%2C-118.24368&q=Park%20cleanup")
  })

  it("works address-only when no point is available, and is null with neither", () => {
    expect(appleMapsUrl({ address: "123 Main St", point: null, verified: true })).toBe(
      "https://maps.apple.com/?address=123%20Main%20St",
    )
    expect(appleMapsUrl({ address: null, point: null, verified: true })).toBeNull()
    expect(appleMapsUrl({ address: "   ", point: null, verified: true })).toBeNull()
  })
})

describe("googleMapsUrl", () => {
  it("queries the address when verified and the coordinates otherwise", () => {
    expect(googleMapsUrl({ address: "123 Main St", point: POINT, verified: true })).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20St",
    )
    expect(googleMapsUrl({ address: "123 Main St", point: POINT, verified: false })).toBe(
      "https://www.google.com/maps/search/?api=1&query=34.05223%2C-118.24368",
    )
    expect(googleMapsUrl({ address: null, point: null, verified: false })).toBeNull()
  })
})

describe("geoUri", () => {
  it("always pins the real coordinates and only labels with verified text", () => {
    expect(geoUri({ address: "123 Main St", point: POINT, verified: true })).toBe(
      "geo:34.05223,-118.24368?q=123%20Main%20St",
    )
    expect(
      geoUri({ address: "123 Main St", point: POINT, verified: false, title: "Park cleanup" }),
    ).toBe("geo:34.05223,-118.24368?q=34.05223%2C-118.24368(Park%20cleanup)")
  })

  it("is null without coordinates - geo: cannot carry a bare address", () => {
    expect(geoUri({ address: "123 Main St", point: null, verified: true })).toBeNull()
  })
})

describe("addressRowAffordances", () => {
  const base = {
    variant: "full" as const,
    hasAddress: true,
    hasPoint: true,
    hasFocusTarget: true,
    hasClipboard: true,
    hasOpenExternal: true,
    hasExternalPlan: true,
  }

  it("gives the full variant all three affordances", () => {
    expect(addressRowAffordances(base)).toEqual({
      focusMap: true,
      copy: true,
      externalMaps: true,
      longPressSheet: true,
    })
  })

  it("omits copy entirely when the host registered no clipboard capability", () => {
    expect(addressRowAffordances({ ...base, hasClipboard: false }).copy).toBe(false)
  })

  it("omits external maps when the host cannot open a URL", () => {
    expect(addressRowAffordances({ ...base, hasOpenExternal: false }).externalMaps).toBe(false)
  })

  it("still offers copy and maps for a verified address with no point (the ticket surface)", () => {
    const withoutPoint = addressRowAffordances({ ...base, hasPoint: false, hasFocusTarget: false })
    expect(withoutPoint.focusMap).toBe(false)
    expect(withoutPoint.copy).toBe(true)
    expect(withoutPoint.externalMaps).toBe(true)
  })

  it("hides the maps button when nothing could be opened, leaving copy on its own", () => {
    const noPlan = addressRowAffordances({
      ...base,
      hasPoint: false,
      hasFocusTarget: false,
      hasExternalPlan: false,
    })
    expect(noPlan.externalMaps).toBe(false)
    expect(noPlan.copy).toBe(true)
    expect(noPlan.longPressSheet).toBe(true)
  })

  it("does not focus the map without a target, so the row never hardcodes an entity", () => {
    expect(addressRowAffordances({ ...base, hasFocusTarget: false }).focusMap).toBe(false)
  })

  it("leaves the compact variant inert so a list row keeps its own press behavior", () => {
    expect(addressRowAffordances({ ...base, variant: "compact" })).toEqual({
      focusMap: false,
      copy: false,
      externalMaps: false,
      longPressSheet: false,
    })
  })
})

describe("addressMapsOptions", () => {
  it("offers Apple only off Android", () => {
    expect(
      addressMapsOptions({ platform: "ios", hasApple: true, hasGoogle: true, hasCopy: true }),
    ).toEqual(["apple", "google", "copy"])
    expect(
      addressMapsOptions({ platform: "android", hasApple: true, hasGoogle: true, hasCopy: false }),
    ).toEqual(["google"])
  })

  it("drops whatever has no URL", () => {
    expect(
      addressMapsOptions({ platform: "ios", hasApple: false, hasGoogle: false, hasCopy: true }),
    ).toEqual(["copy"])
  })
})

describe("addressExternalPlan", () => {
  const urls = {
    appleUrl: "https://maps.apple.com/?address=a",
    googleUrl: "https://www.google.com/maps/search/?api=1&query=a",
    geoUrl: "geo:1,2?q=a",
  }

  it("opens Google directly on web", () => {
    expect(addressExternalPlan({ platform: "web", ...urls, hasCopy: true })).toEqual({
      kind: "direct",
      url: urls.googleUrl,
    })
  })

  it("fires the geo: URI on Android and lets the OS chooser decide", () => {
    expect(addressExternalPlan({ platform: "android", ...urls, hasCopy: true })).toEqual({
      kind: "direct",
      url: urls.geoUrl,
    })
  })

  it("falls back to Google on Android when there are no coordinates for a geo: URI", () => {
    expect(
      addressExternalPlan({ platform: "android", ...urls, geoUrl: null, hasCopy: true }),
    ).toEqual({ kind: "direct", url: urls.googleUrl })
  })

  it("presents the one sheet on iOS", () => {
    expect(addressExternalPlan({ platform: "ios", ...urls, hasCopy: true })).toEqual({
      kind: "sheet",
      options: ["apple", "google", "copy"],
    })
  })

  it("reports nothing to open rather than an empty sheet", () => {
    expect(
      addressExternalPlan({
        platform: "ios",
        appleUrl: null,
        googleUrl: null,
        geoUrl: null,
        hasCopy: false,
      }),
    ).toEqual({ kind: "none" })
    expect(
      addressExternalPlan({
        platform: "web",
        appleUrl: null,
        googleUrl: null,
        geoUrl: null,
        hasCopy: true,
      }),
    ).toEqual({ kind: "none" })
  })
})
