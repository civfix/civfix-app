import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  addressExternalPlan,
  addressMapsOptions,
  addressRowAffordances,
  appleMapsUrl,
  applyNearPrefix,
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

  it("carries a verified address with no point, and never leaks an unverified line", () => {
    expect(googleMapsUrl({ address: "123 Main St", point: null, verified: true })).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20St",
    )
    expect(
      googleMapsUrl({ address: "Vista Hermosa Park", point: null, verified: false }),
    ).toBeNull()
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

  it("gives the full variant copy, maps and the show-on-map action", () => {
    expect(addressRowAffordances(base)).toEqual({
      focusMap: true,
      copy: true,
      externalMaps: true,
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
  })

  it("does not focus the map without a target, so the row never hardcodes an entity", () => {
    expect(addressRowAffordances({ ...base, hasFocusTarget: false }).focusMap).toBe(false)
  })

  it("leaves the compact variant inert so a list row keeps its own press behavior", () => {
    expect(addressRowAffordances({ ...base, variant: "compact" })).toEqual({
      focusMap: false,
      copy: false,
      externalMaps: false,
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
  }

  it("opens Google directly on web", () => {
    expect(addressExternalPlan({ platform: "web", ...urls, hasCopy: true })).toEqual({
      kind: "direct",
      url: urls.googleUrl,
    })
  })

  it("opens the same https Google URL on Android, which the host will actually accept", () => {
    expect(addressExternalPlan({ platform: "android", ...urls, hasCopy: true })).toEqual({
      kind: "direct",
      url: urls.googleUrl,
    })
  })

  it("reports nothing to open on Android when there is no Google URL at all", () => {
    expect(
      addressExternalPlan({ platform: "android", ...urls, googleUrl: null, hasCopy: true }),
    ).toEqual({ kind: "none" })
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
        hasCopy: false,
      }),
    ).toEqual({ kind: "none" })
    expect(
      addressExternalPlan({
        platform: "web",
        appleUrl: null,
        googleUrl: null,
        hasCopy: true,
      }),
    ).toEqual({ kind: "none" })
  })
})

describe("AddressRow source", () => {
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
  const row = strip(readFileSync(new URL("../AddressRow.tsx", import.meta.url), "utf8"))

  it("never turns the address text into an unlabelled press target", () => {
    expect(row).not.toContain('accessibilityHint={t("row.focus_hint")}')
    expect(row).not.toContain("onLongPress")
    expect(row).toContain('t("row.static_a11y", { address: display })')
  })

  it("offers a labelled Show on map action gated on focusMap and wired to onFocusMap", () => {
    expect(row).toContain('t("row.show_map")')
    const gateAt = row.indexOf("affordances.focusMap ? (")
    expect(gateAt).toBeGreaterThan(-1)
    expect(row.indexOf("onPress={onFocusMap}")).toBeGreaterThan(gateAt)
  })

  it("routes Show on map through the shared flow with the layout mode", () => {
    const focus = /const onFocusMap = useCallback\([\s\S]*?\n {2}\}, \[/.exec(row)?.[0] ?? ""
    expect(focus).toContain("showOnMap(\n      mode,")
    expect(focus).not.toContain("useMapFocus")
    expect(focus).not.toContain("selectView(")
  })

  it("exposes the static address as one labelled accessibility element", () => {
    expect(row).toContain('<View style={styles.label} accessible accessibilityLabel={t("row.static_a11y", { address: display })}>')
  })

  it("keeps the trailing content (e.g. the distance) outside the grouped element so it is still read", () => {
    const grouped = /<View style=\{styles\.label\} accessible[\s\S]*?\n {6}<\/View>/.exec(row)?.[0] ?? ""
    expect(grouped).toContain("{text}")
    expect(grouped).not.toContain("{trailing}")
    expect(row).toMatch(/<\/View>\n {6}\{trailing\}\n {4}<\/View>/)
  })
})
