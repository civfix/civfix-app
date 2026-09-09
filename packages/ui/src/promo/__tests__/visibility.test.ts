/**
 * Unit tests for the single decision that drives BOTH promo surfaces.
 *
 * This is the whole feature's logic in one pure function: given the layout mode, the detected platform,
 * and the suppression flags, which surface (if any) renders. Both the web banner and the shared side-card
 * section call it, so they can never disagree about whether the promo is showing.
 */
import { describe, expect, it } from "vitest"
import { appPromoSurface, type AppPromoInput } from "../visibility"

/** A desktop visitor who has done nothing to suppress the promo - the baseline every case tweaks. */
const DESKTOP: AppPromoInput = {
  mounted: true,
  layoutMode: "expanded",
  platform: "other",
  dismissed: false,
  standalone: false,
}

describe("appPromoSurface: placement", () => {
  it("shows the side card section on desktop (expanded)", () => {
    expect(appPromoSurface(DESKTOP)).toBe("card")
  })

  it("shows the top banner to an iPhone in portrait", () => {
    expect(appPromoSurface({ ...DESKTOP, layoutMode: "compact", platform: "ios" })).toBe("banner")
  })

  it("shows the top banner to an Android phone in portrait", () => {
    expect(appPromoSurface({ ...DESKTOP, layoutMode: "compact", platform: "android" })).toBe("banner")
  })

  it("shows the top banner to an iPad in portrait", () => {
    expect(appPromoSurface({ ...DESKTOP, layoutMode: "compact", platform: "ipados" })).toBe("banner")
  })

  it("shows the side card section to an iPad in landscape", () => {
    expect(appPromoSurface({ ...DESKTOP, layoutMode: "expanded", platform: "ipados" })).toBe("card")
  })

  it("shows nothing to a desktop window resized to portrait - there is no single store to offer", () => {
    expect(appPromoSurface({ ...DESKTOP, layoutMode: "compact", platform: "other" })).toBe("none")
  })
})

describe("appPromoSurface: suppression", () => {
  it("shows nothing once dismissed, on desktop", () => {
    expect(appPromoSurface({ ...DESKTOP, dismissed: true })).toBe("none")
  })

  it("shows nothing once dismissed, on a phone", () => {
    expect(
      appPromoSurface({ ...DESKTOP, layoutMode: "compact", platform: "ios", dismissed: true }),
    ).toBe("none")
  })

  it("shows nothing when running as an installed PWA", () => {
    expect(
      appPromoSurface({ ...DESKTOP, layoutMode: "compact", platform: "android", standalone: true }),
    ).toBe("none")
  })

  it("shows nothing before mount, so the static-export prerender never mismatches", () => {
    expect(appPromoSurface({ ...DESKTOP, mounted: false })).toBe("none")
    expect(
      appPromoSurface({ ...DESKTOP, mounted: false, layoutMode: "compact", platform: "ios" }),
    ).toBe("none")
  })
})
