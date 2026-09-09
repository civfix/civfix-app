import { describe, expect, it } from "vitest"
import { METERS_PER_MILE, reportHitRowModel } from "../reportHitRowModel"

/** Downtown LA — the viewer. */
const HERE = { lat: 34.05, lng: -118.24 }
/** +0.0058 deg lat = 644.93 m = 0.40 mi from HERE (the spec's "0.4 mi" example). */
const NEAR = { lat: 34.0558, lng: -118.24 }
/** +0.1 deg lat = 11119.49 m = 6.909 mi from HERE (one-decimal branch). */
const MID = { lat: 34.15, lng: -118.24 }
/** +0.2 deg lat = 22238.99 m = 13.819 mi from HERE (whole-mile branch, >= 10 mi). */
const FAR = { lat: 34.25, lng: -118.24 }

/** A report pin with everything populated; spread over it to knock fields out. */
const FULL = {
  ...NEAR,
  title: "Broken swing",
  description: "The chain snapped",
  addr: "1200 S Hope St",
  thumbUrl: "https://cdn.civfix.org/thumb.jpg",
}

describe("reportHitRowModel", () => {
  it("joins distance and address into the location subtitle", () => {
    const row = reportHitRowModel({ report: FULL, categoryLabel: "Parks", viewer: HERE })
    expect(row).toEqual({
      title: "Broken swing",
      subtitle: "0.4 mi · 1200 S Hope St",
      thumbUrl: "https://cdn.civfix.org/thumb.jpg",
    })
  })

  it("converts METRES to MILES (a metres-as-miles label would read '645 mi')", () => {
    expect(METERS_PER_MILE).toBe(1609.344)
    expect(
      reportHitRowModel({ report: { ...FULL, addr: null }, categoryLabel: "Parks", viewer: HERE })
        .subtitle,
    ).toBe("0.4 mi")
    expect(
      reportHitRowModel({ report: { ...FULL, ...MID, addr: null }, categoryLabel: "Parks", viewer: HERE })
        .subtitle,
    ).toBe("6.9 mi")
    // Above 10 mi distanceLabel switches to whole miles.
    expect(
      reportHitRowModel({ report: { ...FULL, ...FAR, addr: null }, categoryLabel: "Parks", viewer: HERE })
        .subtitle,
    ).toBe("14 mi")
  })

  it("falls back to the address alone when the viewer has no location", () => {
    const row = reportHitRowModel({ report: FULL, categoryLabel: "Parks", viewer: null })
    expect(row.subtitle).toBe("1200 S Hope St")
  })

  it("falls back to the distance alone when the report has no geocoded address", () => {
    expect(
      reportHitRowModel({ report: { ...FULL, addr: null }, categoryLabel: "Parks", viewer: HERE })
        .subtitle,
    ).toBe("0.4 mi")
    // A whitespace-only addr is treated as absent, not joined as an empty segment.
    expect(
      reportHitRowModel({ report: { ...FULL, addr: "   " }, categoryLabel: "Parks", viewer: HERE })
        .subtitle,
    ).toBe("0.4 mi")
  })

  it("falls back to the description only when there is NO location at all", () => {
    expect(
      reportHitRowModel({ report: { ...FULL, addr: null }, categoryLabel: "Parks", viewer: null })
        .subtitle,
    ).toBe("The chain snapped")
  })

  it("returns a null subtitle when there is no location and no description", () => {
    expect(
      reportHitRowModel({
        report: { ...FULL, addr: null, description: null },
        categoryLabel: "Parks",
        viewer: null,
      }).subtitle,
    ).toBeNull()
    // Whitespace-only description is absent too.
    expect(
      reportHitRowModel({
        report: { ...FULL, addr: null, description: "   " },
        categoryLabel: "Parks",
        viewer: null,
      }).subtitle,
    ).toBeNull()
  })

  it("falls the title back to the localized category label", () => {
    expect(
      reportHitRowModel({ report: { ...FULL, title: null }, categoryLabel: "Parks", viewer: HERE }).title,
    ).toBe("Parks")
    expect(
      reportHitRowModel({ report: { ...FULL, title: "   " }, categoryLabel: "Parks", viewer: HERE }).title,
    ).toBe("Parks")
  })

  it("normalizes a missing or blank thumb to null so the row draws the category pin dot", () => {
    expect(
      reportHitRowModel({ report: { ...FULL, thumbUrl: null }, categoryLabel: "Parks", viewer: HERE })
        .thumbUrl,
    ).toBeNull()
    expect(
      reportHitRowModel({ report: { ...FULL, thumbUrl: "  " }, categoryLabel: "Parks", viewer: HERE })
        .thumbUrl,
    ).toBeNull()
  })
})
