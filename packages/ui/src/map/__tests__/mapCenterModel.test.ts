import { describe, expect, it } from "vitest"
import {
  APPROX_ZOOM,
  PRECISE_ZOOM,
  holdsRememberedCamera,
  isRememberedCenter,
  resolveMapCenter,
  shouldAdoptCenter,
  zoomForSource,
} from "../mapCenterModel"

const LA = { lat: 34.0522, lng: -118.2437 }
const SF = { lat: 37.7749, lng: -122.4194 }
const REMEMBERED = { lat: 40.7128, lng: -74.006, zoom: 12 }

describe("resolution order", () => {
  it("prefers a precise fix over everything else, at the tight zoom", () => {
    const plan = resolveMapCenter({ precise: SF, approximate: LA, remembered: REMEMBERED })
    expect(plan.source).toBe("precise")
    expect(plan.center).toEqual({ ...SF, zoom: PRECISE_ZOOM })
    expect(plan.resolved).toBe(true)
    expect(plan.showFindingHint).toBe(false)
  })

  it("falls to the approximate location when there is no precise fix, at the metro zoom", () => {
    const plan = resolveMapCenter({ precise: null, approximate: LA, remembered: REMEMBERED })
    expect(plan.source).toBe("approximate")
    expect(plan.center).toEqual({ ...LA, zoom: APPROX_ZOOM })
    expect(plan.resolved).toBe(true)
    expect(APPROX_ZOOM).toBeLessThan(PRECISE_ZOOM)
  })

  it("holds the last known centre while nothing has resolved yet", () => {
    const plan = resolveMapCenter({ precise: null, approximate: null, remembered: REMEMBERED })
    expect(plan.source).toBe("remembered")
    expect(plan.center).toEqual(REMEMBERED)
    expect(plan.resolved).toBe(false)
    expect(plan.showFindingHint).toBe(false)
  })

  it("renders NO map and hints instead when nothing at all is known", () => {
    const plan = resolveMapCenter({ precise: null, approximate: null, remembered: null })
    expect(plan.center).toBeNull()
    expect(plan.source).toBeNull()
    expect(plan.resolved).toBe(false)
    expect(plan.showFindingHint).toBe(true)
  })
})

describe("the never-a-hardcoded-centre invariant", () => {
  it("never invents a point: no input, no centre", () => {
    expect(resolveMapCenter({ precise: null, approximate: null, remembered: null }).center).toBeNull()
  })

  it("treats an off-globe or non-finite candidate as absent rather than centring on it", () => {
    const bad = [
      { lat: 91, lng: 0 },
      { lat: 0, lng: 181 },
      { lat: Number.NaN, lng: 0 },
      { lat: 0, lng: Number.POSITIVE_INFINITY },
    ]
    for (const point of bad) {
      expect(resolveMapCenter({ precise: point, approximate: null, remembered: null }).center).toBeNull()
      expect(resolveMapCenter({ precise: null, approximate: point, remembered: null }).center).toBeNull()
    }
  })

  it("rejects a corrupt remembered centre instead of booting on it", () => {
    expect(
      resolveMapCenter({
        precise: null,
        approximate: null,
        remembered: { lat: 40.7128, lng: -74.006, zoom: 99 },
      }).center,
    ).toBeNull()
    expect(
      resolveMapCenter({
        precise: null,
        approximate: null,
        remembered: { lat: 200, lng: -74.006, zoom: 12 },
      }).center,
    ).toBeNull()
  })

  it("keeps the approximate centre when a precise fix never lands", () => {
    const first = resolveMapCenter({ precise: null, approximate: LA, remembered: null })
    const second = resolveMapCenter({ precise: null, approximate: LA, remembered: null })
    expect(second).toEqual(first)
  })
})

describe("camera adoption", () => {
  it("adopts anything over nothing, and only a precise fix over an area", () => {
    expect(shouldAdoptCenter(null, "remembered")).toBe(true)
    expect(shouldAdoptCenter(null, "approximate")).toBe(true)
    expect(shouldAdoptCenter(null, "precise")).toBe(true)
    expect(shouldAdoptCenter("remembered", "precise")).toBe(true)
    expect(shouldAdoptCenter("approximate", "precise")).toBe(true)
  })

  it("never moves the camera between two area-level guesses", () => {
    // The viewer's own last-settled centre is at least as good as a server IP estimate, so swapping one
    // for the other is a zoom-out to a different guess, not an upgrade - and it yanks a map being panned.
    expect(shouldAdoptCenter("remembered", "approximate")).toBe(false)
    expect(shouldAdoptCenter("approximate", "remembered")).toBe(false)
    expect(shouldAdoptCenter("approximate", "approximate")).toBe(false)
    expect(shouldAdoptCenter("remembered", "remembered")).toBe(false)
  })

  it("never downgrades off a precise fix", () => {
    expect(shouldAdoptCenter("precise", "approximate")).toBe(false)
    expect(shouldAdoptCenter("precise", "remembered")).toBe(false)
    expect(shouldAdoptCenter("precise", "precise")).toBe(false)
    expect(shouldAdoptCenter("precise", null)).toBe(false)
  })

  it("zooms by confidence", () => {
    expect(zoomForSource("precise")).toBe(PRECISE_ZOOM)
    expect(zoomForSource("approximate")).toBe(APPROX_ZOOM)
    expect(zoomForSource("remembered")).toBe(APPROX_ZOOM)
  })
})

describe("the remembered-centre validator both hosts persist through", () => {
  it("accepts a well-formed centre", () => {
    expect(isRememberedCenter(REMEMBERED)).toBe(true)
    expect(isRememberedCenter({ lat: 0, lng: 0, zoom: 0 })).toBe(true)
    expect(isRememberedCenter({ lat: 0, lng: 0, zoom: 24 })).toBe(true)
  })

  it("rejects anything that would boot the map somewhere wrong", () => {
    for (const bad of [
      null,
      undefined,
      "34,-118",
      {},
      { lat: 34, lng: -118 },
      { lat: "34", lng: -118, zoom: 12 },
      { lat: 91, lng: -118, zoom: 12 },
      { lat: 34, lng: -181, zoom: 12 },
      { lat: Number.NaN, lng: -118, zoom: 12 },
      { lat: 34, lng: -118, zoom: -1 },
      { lat: 34, lng: -118, zoom: 25 },
      { lat: 34, lng: -118, zoom: Number.NaN },
    ]) {
      expect(isRememberedCenter(bad)).toBe(false)
    }
  })
})

describe("holdsRememberedCamera", () => {
  it("holds a remembered boot camera against a silent grant, and releases it for a prompted one", () => {
    expect(holdsRememberedCamera("remembered", false)).toBe(true)
    expect(holdsRememberedCamera("remembered", true)).toBe(false)
  })

  it("never holds a camera that did not boot from the snapshot", () => {
    expect(holdsRememberedCamera("approximate", false)).toBe(false)
    expect(holdsRememberedCamera("precise", false)).toBe(false)
    expect(holdsRememberedCamera(null, false)).toBe(false)
  })
})
