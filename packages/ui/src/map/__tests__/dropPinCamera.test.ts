import { describe, expect, it } from "vitest"
import {
  DROP_PIN_PAN_TOLERANCE_PX,
  DROP_PIN_PAN_ZOOM_TOLERANCE,
  DROP_PIN_ZOOM,
  dropPinCameraTarget,
  occludedCenterLng,
  shouldRestoreDropPinCamera,
  worldPx,
  type DropPinCameraSnapshot,
  type DropPinCameraTarget,
  type DropPinDismissal,
} from "../dropPinCamera"
import { sheetSnapPoints } from "../../shell/tabBarLogic"
import {
  clampSidebarWidth,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from "../../shell/sidebarStore"
import { expandedFramePlan, NAV_LEFT } from "../../shell/expandedFramePlan"

/** An iPhone 16-class portrait window. */
const WINDOW_H = 874
/** `insets.top` on that device; CompactShell's `sheetTopReserve` adds the shared 32pt gap. */
const SAFE_TOP = 59
const TOP_RESERVE = SAFE_TOP + 32
const SF = { lat: 37.7749, lng: -122.4194 }

const compact = (over: Partial<Parameters<typeof dropPinCameraTarget>[0]> = {}) =>
  dropPinCameraTarget({
    ...SF,
    currentZoom: null,
    windowHeight: WINDOW_H,
    sheetTopReserve: TOP_RESERVE,
    mode: "compact",
    ...over,
  })

describe("dropPinCamera: the 512-px world convention", () => {
  it("uses maplibre's 512-px tile world size", () => {
    expect(worldPx(0)).toBe(512)
    expect(worldPx(17)).toBe(512 * 2 ** 17)
  })
})

describe("dropPinCamera: zoom", () => {
  it("floors at DROP_PIN_ZOOM (street level) when the current zoom is unknown", () => {
    expect(DROP_PIN_ZOOM).toBe(17)
    expect(compact({ currentZoom: null }).zoom).toBe(17)
    expect(compact({ currentZoom: undefined }).zoom).toBe(17)
  })

  it("zooms IN from a wider view", () => {
    expect(compact({ currentZoom: 12 }).zoom).toBe(17)
  })

  it("NEVER zooms out: a long press while already past z17 keeps the closer zoom", () => {
    expect(compact({ currentZoom: 19.5 }).zoom).toBe(19.5)
  })
})

const expanded = (over: Partial<Parameters<typeof dropPinCameraTarget>[0]> = {}) =>
  dropPinCameraTarget({
    ...SF,
    currentZoom: null,
    windowHeight: WINDOW_H,
    sheetTopReserve: TOP_RESERVE,
    mode: "expanded",
    sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
    ...over,
  })

describe("dropPinCamera: expanded (the sidebar occludes HORIZONTALLY)", () => {
  it("returns the pressed point untouched when no sidebar width is supplied (back-compat)", () => {
    const target = dropPinCameraTarget({
      ...SF,
      currentZoom: 14,
      windowHeight: WINDOW_H,
      sheetTopReserve: TOP_RESERVE,
      mode: "expanded",
    })
    expect(target).toEqual({ lat: SF.lat, lng: SF.lng, zoom: 17 })
  })

  it("shifts the CENTRE west so the pin slides into the strip BESIDE the panel", () => {
    const target = expanded()
    expect(target.lng).toBeLessThan(SF.lng)
    expect(target.lat).toBe(SF.lat)
  })

  it("pins the exact magnitude - half the sidebar width, in linear-Mercator degrees", () => {
    // 440px card -> 220px offset; at z17 that is 220 / (512 * 2**17) * 360 = 1.180e-3 deg of longitude.
    expect(SIDEBAR_DEFAULT_WIDTH).toBe(440)
    const delta = SF.lng - expanded({ currentZoom: 17 }).lng
    expect(delta).toBeCloseTo((220 / worldPx(17)) * 360, 12)
    expect(delta).toBeGreaterThan(1.18e-3 - 5e-6)
    expect(delta).toBeLessThan(1.18e-3 + 5e-6)
  })

  it("tracks the user's RESIZED card, not a hardcoded default", () => {
    const narrow = SF.lng - expanded({ sidebarWidth: SIDEBAR_MIN_WIDTH, currentZoom: 17 }).lng
    const wide = SF.lng - expanded({ sidebarWidth: SIDEBAR_MAX_WIDTH, currentZoom: 17 }).lng
    expect(narrow).toBeLessThan(wide)
    expect(wide / narrow).toBeCloseTo(SIDEBAR_MAX_WIDTH / SIDEBAR_MIN_WIDTH, 9)
  })

  it("shrinks the shift as the zoom goes in (the offset is a FIXED pixel count)", () => {
    const atZ17 = SF.lng - expanded({ currentZoom: 17 }).lng
    const atZ18 = SF.lng - expanded({ currentZoom: 18 }).lng
    expect(atZ18).toBeCloseTo(atZ17 / 2, 12)
  })

  it("never zooms out on expanded either", () => {
    expect(expanded({ currentZoom: 19.5 }).zoom).toBe(19.5)
    expect(expanded({ currentZoom: 3 }).zoom).toBe(DROP_PIN_ZOOM)
  })

  it("wraps a shift that would cross the antimeridian instead of emitting an out-of-range lng", () => {
    const target = expanded({ lng: -179.9999, sidebarWidth: SIDEBAR_MAX_WIDTH, currentZoom: 17 })
    expect(target.lng).toBeGreaterThan(179)
    expect(target.lng).toBeLessThanOrEqual(180)
  })

  it("no-ops the shift on a degenerate / zero sidebar rather than producing NaN", () => {
    for (const sidebarWidth of [0, -28, Number.NaN]) {
      expect(expanded({ sidebarWidth }).lng).toBe(SF.lng)
    }
  })

  it("ignores the sheet detent entirely (there is no sheet in landscape)", () => {
    expect(expanded({ sheetDetent: 2 })).toEqual(expanded({ sheetDetent: 0 }))
  })
})

// Half the card alone leaves the pin west of the strip's centre by half the shell's inset, and says
// nothing in map mode where only the inset occludes.

describe("dropPinCamera: expanded takes the frame plan's occlusionLeft", () => {
  const frame = (over: Partial<Parameters<typeof expandedFramePlan>[0]> = {}) =>
    expandedFramePlan({ view: "home", stackLength: 0, sidebarWidth: SIDEBAR_DEFAULT_WIDTH, ...over })

  it("offsets by half the SHELL INSET + CARD, not half the card", () => {
    // 14 + 440 = 454 -> a 227px offset; at z17 that is 227 / (512 * 2**17) * 360 = 1.21772e-3 deg.
    expect(frame().occlusionLeft).toBe(454)
    const delta = SF.lng - expanded({ occlusionLeft: frame().occlusionLeft, currentZoom: 17 }).lng
    expect(delta).toBeCloseTo((227 / worldPx(17)) * 360, 12)
    expect(delta).toBeGreaterThan(1.21772e-3 - 5e-6)
    expect(delta).toBeLessThan(1.21772e-3 + 5e-6)
  })

  it("STILL shifts in map mode, where the card is hidden and only the shell's own inset occludes", () => {
    const hidden = frame({ view: "map" })
    expect(hidden.cardVisible).toBe(false)
    expect(hidden.occlusionLeft).toBe(NAV_LEFT)
    const delta = SF.lng - expanded({ occlusionLeft: NAV_LEFT, currentZoom: 17 }).lng
    expect(delta).toBeCloseTo((7 / worldPx(17)) * 360, 12)
    expect(delta).toBeGreaterThan(0)
  })

  it("takes occlusionLeft OVER the legacy sidebarWidth when both are supplied", () => {
    const both = expanded({ occlusionLeft: 454, sidebarWidth: SIDEBAR_DEFAULT_WIDTH, currentZoom: 17 })
    expect(both).toEqual(expanded({ occlusionLeft: 454, currentZoom: 17 }))
    expect(both.lng).not.toBe(expanded({ sidebarWidth: SIDEBAR_DEFAULT_WIDTH, currentZoom: 17 }).lng)
  })

  it("keeps the deprecated sidebarWidth input working", () => {
    expect(expanded({ sidebarWidth: 440, currentZoom: 17 })).toEqual(
      expanded({ occlusionLeft: 440, currentZoom: 17 }),
    )
  })

  it("no-ops the shift on a degenerate / zero occlusion rather than producing NaN", () => {
    for (const occlusionLeft of [0, -28, Number.NaN]) {
      expect(expanded({ occlusionLeft, sidebarWidth: undefined }).lng).toBe(SF.lng)
    }
  })
})

describe("occludedCenterLng: the one shift both the drop pin and the location pick make", () => {
  it("IS the expanded branch's math (the camera calls it, so they can never drift)", () => {
    for (const occlusionLeft of [90, 530, 730]) {
      expect(occludedCenterLng(SF.lng, occlusionLeft, 17)).toBe(
        expanded({ occlusionLeft, currentZoom: 17 }).lng,
      )
    }
  })

  it("moves the centre WEST by exactly half the occlusion, in linear-Mercator degrees", () => {
    expect(SF.lng - occludedCenterLng(SF.lng, 530, 17)).toBeCloseTo((265 / worldPx(17)) * 360, 12)
  })

  it("returns the longitude BIT-IDENTICAL when nothing occludes", () => {
    for (const occlusionLeft of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(occludedCenterLng(SF.lng, occlusionLeft, 17)).toBe(SF.lng)
    }
  })

  it("wraps across the antimeridian rather than emitting an out-of-range longitude", () => {
    const wrapped = occludedCenterLng(-179.9999, 730, 12)
    expect(wrapped).toBeGreaterThan(179)
    expect(wrapped).toBeLessThanOrEqual(180)
  })
})

describe("dropPinCamera: compact", () => {
  it("shifts the CENTRE south so the pin rises into the strip above the sheet", () => {
    const target = compact()
    expect(target.lat).toBeLessThan(SF.lat)
    expect(target.lng).toBe(SF.lng)
  })

  it("pins the exact magnitude - the guard against a 2x-wrong world-size constant", () => {
    // 874/91 -> detents [96, 487, 783]; offset 487/2 = 243.5px; at lat 37.7749 / z17 that is 1.03e-3 deg.
    expect(sheetSnapPoints(WINDOW_H, TOP_RESERVE)).toEqual([96, 487, 783])
    const delta = SF.lat - compact().lat
    expect(delta).toBeGreaterThan(1.03e-3 - 5e-5)
    expect(delta).toBeLessThan(1.03e-3 + 5e-5)
  })

  it("shrinks the shift as the zoom goes in (the offset is a FIXED pixel count)", () => {
    const atZ17 = SF.lat - compact({ currentZoom: 17 }).lat
    const atZ18 = SF.lat - compact({ currentZoom: 18 }).lat
    expect(atZ18).toBeLessThan(atZ17)
    expect(atZ18).toBeCloseTo(atZ17 / 2, 6)
  })

  it("shifts SOUTH in the southern hemisphere too (the sign is screen-space, not hemisphere-space)", () => {
    const sydney = { lat: -33.8688, lng: 151.2093 }
    const target = compact(sydney)
    expect(target.lat).toBeLessThan(sydney.lat)
  })

  it("round-trips the Mercator sign flip: the shifted centre is EXACTLY offsetPx south in Mercator Y", () => {
    // The inverse of the pair the module applies. Going lat -> mercY here and comparing the delta proves
    // both the DIRECTION (Mercator Y grows southward) and that latFromMercatorY undid mercatorYfromLat.
    const mercY = (lat: number) =>
      (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360
    for (const lat of [37.7749, -33.8688, 0, 64.1466, -54.8019]) {
      const target = compact({ lat, currentZoom: 17 })
      const expected = 487 / 2 / worldPx(17)
      expect(Math.abs(mercY(target.lat) - mercY(lat) - expected)).toBeLessThan(1e-9)
    }
  })

  it("no-ops the shift on a degenerate window rather than producing NaN", () => {
    const target = compact({ windowHeight: Number.NaN, sheetTopReserve: Number.NaN })
    expect(Number.isFinite(target.lat)).toBe(true)
    expect(target.lat).toBe(SF.lat)
  })
})

describe("dropPinCamera: compact, the SETTLED detent (not a hardcoded mid)", () => {
  // Offsetting by mid/2 for a sheet settled at FULL would put the pin below the sheet's top edge.
  it("defaults to MID, so an older caller is unchanged", () => {
    expect(compact({ sheetDetent: undefined })).toEqual(compact({ sheetDetent: 1 }))
  })

  it("offsets by FULL/2 when the sheet settles at FULL", () => {
    // detents [96, 487, 783]; offset 783/2 = 391.5px; at lat 37.7749 / z17 that is 1.660e-3 deg.
    const delta = SF.lat - compact({ sheetDetent: 2, currentZoom: 17 }).lat
    expect(delta).toBeGreaterThan(1.66e-3 - 5e-6)
    expect(delta).toBeLessThan(1.66e-3 + 5e-6)
  })

  it("offsets by PEEK/2 when the sheet is left at PEEK", () => {
    // detents[0] is the FIXED 96px peek; offset 48px -> 2.035e-4 deg at z17.
    const delta = SF.lat - compact({ sheetDetent: 0, currentZoom: 17 }).lat
    expect(delta).toBeGreaterThan(2.035e-4 - 5e-6)
    expect(delta).toBeLessThan(2.035e-4 + 5e-6)
  })

  it("orders the three detents' offsets exactly as the sheet heights order", () => {
    const at = (sheetDetent: 0 | 1 | 2) => SF.lat - compact({ sheetDetent, currentZoom: 17 }).lat
    const [peek, mid, full] = sheetSnapPoints(WINDOW_H, TOP_RESERVE)
    expect(at(0)).toBeLessThan(at(1))
    expect(at(1)).toBeLessThan(at(2))
    // The offset is exactly HALF the occluded band, so the ratios must match the detents' ratios.
    expect(at(2) / at(1)).toBeCloseTo(full / mid, 4)
    expect(at(0) / at(1)).toBeCloseTo(peek / mid, 4)
  })

  it("falls back to MID for an out-of-range detent from a JS host", () => {
    const bogus = compact({ sheetDetent: 7 as unknown as 0 | 1 | 2 })
    expect(bogus).toEqual(compact({ sheetDetent: 1 }))
    expect(Number.isFinite(bogus.lat)).toBe(true)
  })
})

// Deltas alone cannot tell "centred in the visible strip" from "shoved off the top of the window", so
// these invert the projection back to a screen y.

/** Re-derived because the module keeps `mercatorYfromLat` private. */
const mercY = (lat: number) =>
  (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360

/** The inverse of `dropPinCameraTarget`, computed from its output only. */
function pinScreenY(
  windowHeight: number,
  pressedLat: number,
  target: { lat: number; zoom: number },
): number {
  return windowHeight / 2 - (mercY(target.lat) - mercY(pressedLat)) * worldPx(target.zoom)
}

/**
 * `DROP_PIN_SIZE` restated as a literal because `map/pins/DropPin` imports react-native. The marker is
 * anchored at its bottom, so the art occupies `[pinY - 52, pinY]`.
 */
const DROP_PIN_ART = 52

/** [label, windowHeight, insets.top]. */
const NOTCHED = [
  ["iPhone 16 (the sim target)", 874, 59],
  ["iPhone SE-class notch", 852, 47],
  ["iPhone 15 Pro Max", 932, 62],
] as const

describe("dropPinCamera: the pin lands in VISIBLE map on a notched phone", () => {
  for (const [label, windowHeight, safeTop] of NOTCHED) {
    const sheetTopReserve = safeTop + 32
    const at = (sheetDetent: 0 | 1 | 2) =>
      dropPinCameraTarget({
        ...SF,
        currentZoom: 17,
        windowHeight,
        sheetTopReserve,
        topInset: safeTop,
        sheetDetent,
        mode: "compact",
      })

    it(`${label}: the pin is BELOW the safe-area inset at every detent, FULL included`, () => {
      for (const detent of [0, 1, 2] as const) {
        const occluded = sheetSnapPoints(windowHeight, sheetTopReserve)[detent]
        const y = pinScreenY(windowHeight, SF.lat, at(detent))
        expect(y).toBeGreaterThanOrEqual(safeTop)
        expect(y).toBeLessThanOrEqual(windowHeight - occluded)
        expect(y).toBeCloseTo((safeTop + (windowHeight - occluded)) / 2, 6)
      }
    })

    it(`${label}: without topInset the FULL detent puts the pin UNDER the notch (the bug)`, () => {
      // If this starts failing, the `topInset` default changed.
      const y = pinScreenY(
        windowHeight,
        SF.lat,
        dropPinCameraTarget({
          ...SF,
          currentZoom: 17,
          windowHeight,
          sheetTopReserve,
          sheetDetent: 2,
          mode: "compact",
        }),
      )
      expect(y).toBeLessThan(safeTop)
    })

    it(`${label}: at MID the whole 52pt teardrop clears the notch; at FULL it cannot fit at all`, () => {
      const midY = pinScreenY(windowHeight, SF.lat, at(1))
      expect(midY - DROP_PIN_ART).toBeGreaterThan(safeTop)
      // The geometry `dropPinFlow` acts on by settling compact at MID.
      expect(windowHeight - sheetSnapPoints(windowHeight, sheetTopReserve)[2] - safeTop).toBeLessThan(
        DROP_PIN_ART,
      )
    })
  }

  it("centres in the strip under a measured web banner too (no safe-area API there)", () => {
    const banner = 72
    const y = pinScreenY(
      812,
      SF.lat,
      dropPinCameraTarget({
        ...SF,
        currentZoom: 17,
        windowHeight: 812,
        sheetTopReserve: 32,
        topInset: banner,
        sheetDetent: 1,
        mode: "compact",
      }),
    )
    const mid = sheetSnapPoints(812, 32)[1]
    expect(y).toBeGreaterThanOrEqual(banner)
    expect(y).toBeCloseTo((banner + (812 - mid)) / 2, 6)
  })

  it("pins the sim device's MID magnitude with the inset folded in", () => {
    // 874/91 -> mid 487; offset (487 - 59)/2 = 214px; at lat 37.7749 / z17 that is 9.074e-4 deg.
    const delta = SF.lat - compact({ sheetDetent: 1, topInset: SAFE_TOP, currentZoom: 17 }).lat
    expect(delta).toBeGreaterThan(9.074e-4 - 5e-7)
    expect(delta).toBeLessThan(9.074e-4 + 5e-7)
  })

  it("shifts LESS than the inset-blind offset, never more (the pin moves DOWN, toward safety)", () => {
    for (const sheetDetent of [0, 1, 2] as const) {
      const blind = SF.lat - compact({ sheetDetent, currentZoom: 17 }).lat
      const aware = SF.lat - compact({ sheetDetent, topInset: SAFE_TOP, currentZoom: 17 }).lat
      expect(aware).toBeLessThan(blind)
    }
  })
})

// Fails if the camera offsets by half the card (45px too far west at every width) or forgets the rail
// in map mode.

/** `mercatorXfromLng` is linear, so this is the exact inverse of the expanded branch. */
function pinScreenX(
  windowWidth: number,
  pressedLng: number,
  target: { lng: number; zoom: number },
): number {
  return windowWidth / 2 + ((pressedLng - target.lng) / 360) * worldPx(target.zoom)
}

describe("dropPinCamera: the pin lands in the CLEAR map strip beside the rail + card", () => {
  /** [label, viewport width, the width the user has dragged the card to, the nav view]. */
  const LANDSCAPE = [
    ["1440 desktop, default card", 1440, SIDEBAR_DEFAULT_WIDTH, "home"],
    ["1920 desktop, card dragged to max", 1920, SIDEBAR_MAX_WIDTH, "home"],
    ["840 tablet, card render-clamped", 840, SIDEBAR_MAX_WIDTH, "home"],
    ["1440 map mode, card hidden", 1440, SIDEBAR_DEFAULT_WIDTH, "map"],
  ] as const

  for (const [label, windowWidth, storedWidth, view] of LANDSCAPE) {
    it(`${label}: the pin is centred in the visible strip, never under the chrome`, () => {
      const { occlusionLeft } = expandedFramePlan({
        view,
        stackLength: 0,
        sidebarWidth: clampSidebarWidth(storedWidth, windowWidth),
      })
      const target = dropPinCameraTarget({
        ...SF,
        currentZoom: 17,
        windowHeight: 900,
        sheetTopReserve: 0,
        occlusionLeft,
        mode: "expanded",
      })
      const x = pinScreenX(windowWidth, SF.lng, target)
      expect(x).toBeGreaterThan(occlusionLeft)
      expect(x).toBeLessThan(windowWidth)
      expect(x).toBeCloseTo((occlusionLeft + windowWidth) / 2, 6)
      expect(target.lat).toBe(SF.lat)
    })
  }

  it("the OLD half-the-card offset lands the pin 7px west of the strip's centre", () => {
    // Documents the deprecated `sidebarWidth` input: half the shell's own left inset is the whole error.
    const legacy = dropPinCameraTarget({
      ...SF,
      currentZoom: 17,
      windowHeight: 900,
      sheetTopReserve: 0,
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
      mode: "expanded",
    })
    const x = pinScreenX(1440, SF.lng, legacy)
    expect(x).toBeCloseTo((454 + 1440) / 2 - NAV_LEFT / 2, 6)
  })
})

describe("dropPinCamera: topInset is fed from a live store, so it must degrade", () => {
  it("treats a non-finite or negative inset as 0 rather than cancelling the shift", () => {
    for (const topInset of [Number.NaN, Number.POSITIVE_INFINITY, -40, undefined]) {
      expect(compact({ topInset })).toEqual(compact({ topInset: 0 }))
    }
  })

  it("clamps an inset TALLER than the visible strip to the sheet's top edge, never below it", () => {
    // Mobile web at FULL with a banner: the strip is negative, so the sheet's top edge is the least-bad answer.
    const full = sheetSnapPoints(812, 32)[2]
    const y = pinScreenY(
      812,
      SF.lat,
      dropPinCameraTarget({
        ...SF,
        currentZoom: 17,
        windowHeight: 812,
        sheetTopReserve: 32,
        topInset: 400,
        sheetDetent: 2,
        mode: "compact",
      }),
    )
    expect(y).toBeCloseTo(812 - full, 6)
  })

  it("pushes the centre NORTH when the top occluder is taller than the sheet", () => {
    // A 120px banner over a 96px peeked sheet puts the strip's centre below the window's.
    const target = compact({ sheetDetent: 0, topInset: 120, currentZoom: 17 })
    expect(target.lat).toBeGreaterThan(SF.lat)
    const y = pinScreenY(WINDOW_H, SF.lat, target)
    expect(y).toBeCloseTo((120 + (WINDOW_H - 96)) / 2, 6)
  })

  it("is ignored on expanded (the sidebar occludes horizontally; there is no sheet)", () => {
    expect(expanded({ topInset: 59 })).toEqual(expanded({ topInset: 0 }))
  })
})

// The hard part of the restore is telling a dismissal from a commitment: both take the drop-pin entry off
// the nav stack.

/** A wider view of a different part of town. */
const FROM: DropPinCameraTarget = { lat: 37.7935, lng: -122.4399, zoom: 13 }

const FLOWN: DropPinCameraTarget = dropPinCameraTarget({
  ...SF,
  currentZoom: FROM.zoom,
  windowHeight: WINDOW_H,
  sheetTopReserve: TOP_RESERVE,
  topInset: SAFE_TOP,
  sheetDetent: 1,
  mode: "compact",
})

const parkedOn = (camera: DropPinCameraTarget) => ({
  center: { lat: camera.lat, lng: camera.lng },
  zoom: camera.zoom,
})

const snapshot = (over: Partial<DropPinCameraSnapshot> = {}): DropPinCameraSnapshot => ({
  from: FROM,
  flownTo: FLOWN,
  view: "map",
  ...over,
})

const dismissal = (over: Partial<DropPinDismissal> = {}): DropPinDismissal => ({
  previousStack: [{ kind: "drop-pin" }],
  view: "map",
  viewport: parkedOn(FLOWN),
  ...over,
})

describe("shouldRestoreDropPinCamera: a dismissal restores, a COMMITMENT does not", () => {
  it("restores on a plain dismissal - Cancel, sheet drag, map tap and Android back all land here", () => {
    expect(shouldRestoreDropPinCamera(snapshot(), dismissal())).toBe(true)
  })

  it("carries BOTH cameras: `from` is what to fly, `flownTo` is what the pan check compares against", () => {
    // The fixture is a genuine before/after PAIR, not two copies of one camera.
    expect(snapshot().from).toEqual(FROM)
    expect(snapshot().flownTo.zoom).toBe(DROP_PIN_ZOOM)
    // The drop-pin fly pushes the CENTRE south so the pin rises into the strip above the sheet.
    expect(snapshot().flownTo.lat).toBeLessThan(SF.lat)
    // And the predicate accepts a viewport parked on EITHER endpoint - both are places the APP put the
    // camera, so neither is a user pan. (Task 2.2 turns the second half into a real measurement; here it
    // only has to not be rejected.)
    expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport: parkedOn(FLOWN) }))).toBe(true)
    expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport: parkedOn(FROM) }))).toBe(true)
  })

  it("does nothing with no snapshot - a long press that armed none (no map had reported yet)", () => {
    expect(shouldRestoreDropPinCamera(null, dismissal())).toBe(false)
  })

  it("does NOT restore when the VIEW changed - 'Report an issue here' is a commitment", () => {
    // `selectView("report")` empties the stack exactly as Cancel does; only the view tells them apart.
    expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ view: "report" }))).toBe(false)
  })

  it("does NOT restore on the [drop-pin, cleanup] PUBLISH-THEN-DISMISS trap", () => {
    // `stackAfterFlowPublished` truncates only to the topmost flow kind, so the drop-pin entry leaves when
    // the new event's detail is dismissed; restoring then would yank the camera off that event.
    expect(
      shouldRestoreDropPinCamera(
        snapshot(),
        dismissal({ previousStack: [{ kind: "drop-pin" }, { kind: "cleanup" }] }),
      ),
    ).toBe(false)
  })

  it("does NOT restore while a create flow is still stacked over the pin", () => {
    expect(
      shouldRestoreDropPinCamera(
        snapshot(),
        dismissal({ previousStack: [{ kind: "drop-pin" }, { kind: "create-cleanup" }] }),
      ),
    ).toBe(false)
  })

  it("DOES restore from EXPANDED's appended stack, where the pin is not at index 0", () => {
    // Expanded pushes onto the open panel stack, so the rule is positional, not "is it the only entry".
    expect(
      shouldRestoreDropPinCamera(
        snapshot(),
        dismissal({ previousStack: [{ kind: "cleanups" }, { kind: "drop-pin" }] }),
      ),
    ).toBe(true)
  })

  it("does NOT restore when the previous stack held no drop-pin entry at all", () => {
    for (const previousStack of [[], [{ kind: "cleanup" }]]) {
      expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ previousStack }))).toBe(false)
    }
  })

  it("does NOT restore with no live viewport - no map is mounted, so there is nothing to fly", () => {
    // A fly issued with no map queues and replays onto the next mounted map.
    expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport: null }))).toBe(false)
  })
})

/** maplibre's `latFromMercatorY`, re-derived for the same reason `mercY` is. */
const latFromMercY = (y: number) => {
  const y2 = 180 - y * 360
  return (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90
}

/** Mercator X is linear, so this is exact. */
const nudgeEastPx = (camera: DropPinCameraTarget, px: number) => ({
  center: { lat: camera.lat, lng: camera.lng + (px / worldPx(camera.zoom)) * 360 },
  zoom: camera.zoom,
})

const nudgeSouthPx = (camera: DropPinCameraTarget, px: number) => ({
  center: {
    lat: latFromMercY(mercY(camera.lat) + px / worldPx(camera.zoom)),
    lng: camera.lng,
  },
  zoom: camera.zoom,
})

describe("shouldRestoreDropPinCamera: a pan or zoom while the menu is open CANCELS the restore", () => {
  it("pins the tolerance at 12 SCREEN px - 6.4373e-5 deg of longitude at z17", () => {
    expect(DROP_PIN_PAN_TOLERANCE_PX).toBe(12)
    expect((DROP_PIN_PAN_TOLERANCE_PX / worldPx(17)) * 360).toBeCloseTo(6.4373e-5, 9)
  })

  it("tolerates a sub-threshold nudge in BOTH axes (settle noise, not intent)", () => {
    for (const viewport of [nudgeEastPx(FLOWN, 11), nudgeSouthPx(FLOWN, 11), nudgeEastPx(FLOWN, -11)]) {
      expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport }))).toBe(true)
    }
  })

  it("cancels on a deliberate pan in BOTH axes", () => {
    for (const viewport of [nudgeEastPx(FLOWN, 13), nudgeSouthPx(FLOWN, 13), nudgeEastPx(FLOWN, -40)]) {
      expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport }))).toBe(false)
    }
  })

  it("measures SCREEN PIXELS, not degrees: the same degree delta passes at z17 and fails at z20", () => {
    const degrees = (4 / worldPx(17)) * 360
    const at17: DropPinCameraTarget = { ...FLOWN, zoom: 17 }
    expect(
      shouldRestoreDropPinCamera(
        snapshot({ flownTo: at17 }),
        dismissal({ viewport: { center: { lat: at17.lat, lng: at17.lng + degrees }, zoom: 17 } }),
      ),
    ).toBe(true)
    // The same degrees are 32 px at z20.
    const at20: DropPinCameraTarget = { ...FLOWN, zoom: 20 }
    expect(
      shouldRestoreDropPinCamera(
        snapshot({ flownTo: at20 }),
        dismissal({ viewport: { center: { lat: at20.lat, lng: at20.lng + degrees }, zoom: 20 } }),
      ),
    ).toBe(false)
  })

  it("cancels on a pinch - a zoom delta past 0.1 is a deliberate camera move", () => {
    expect(
      shouldRestoreDropPinCamera(
        snapshot(),
        dismissal({ viewport: { ...parkedOn(FLOWN), zoom: FLOWN.zoom + 0.4 } }),
      ),
    ).toBe(false)
  })

  it("tolerates the host's own arrival slop - mapLifecycle's SETTLED_ZOOM_EPSILON is the same 0.1", () => {
    expect(DROP_PIN_PAN_ZOOM_TOLERANCE).toBe(0.1)
    expect(
      shouldRestoreDropPinCamera(
        snapshot(),
        dismissal({ viewport: { ...parkedOn(FLOWN), zoom: FLOWN.zoom - 0.09 } }),
      ),
    ).toBe(true)
  })

  it("restores when the viewport is still on the PRE-PRESS camera (dismissed MID-FLY)", () => {
    // Map.native publishes to useMapViewport only on region settle, so an immediate map tap still finds
    // the pre-press camera in the store.
    expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport: parkedOn(FROM) }))).toBe(true)
  })

  it("does NOT let a LOW-ZOOM pre-press camera launder a pan at the drop-pin zoom", () => {
    // A 160px pan at z17 is only 10px in z13's world, inside the tolerance without the zoom gate.
    const nearbyWideFrom: DropPinCameraTarget = { lat: FLOWN.lat, lng: FLOWN.lng, zoom: 13 }
    expect(
      shouldRestoreDropPinCamera(
        snapshot({ from: nearbyWideFrom }),
        dismissal({ viewport: nudgeEastPx(FLOWN, 160) }),
      ),
    ).toBe(false)
  })

  it("measures the SHORTEST way round the antimeridian, not the long way", () => {
    // maplibre wraps 8px east of the dateline to a negative longitude; a naive subtraction reads ~360 deg.
    const atDateline: DropPinCameraTarget = { lat: 0, lng: 179.99998, zoom: 17 }
    const wrapped = {
      center: { lat: 0, lng: atDateline.lng + (8 / worldPx(17)) * 360 - 360 },
      zoom: 17,
    }
    expect(wrapped.center.lng).toBeLessThan(-179.9)
    expect(
      shouldRestoreDropPinCamera(snapshot({ flownTo: atDateline }), dismissal({ viewport: wrapped })),
    ).toBe(true)
  })

  it("fails CLOSED on a non-finite viewport rather than flying somewhere undefined", () => {
    for (const viewport of [
      { center: { lat: Number.NaN, lng: FLOWN.lng }, zoom: FLOWN.zoom },
      { center: { lat: FLOWN.lat, lng: Number.POSITIVE_INFINITY }, zoom: FLOWN.zoom },
      { center: { lat: FLOWN.lat, lng: FLOWN.lng }, zoom: Number.NaN },
    ]) {
      expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport }))).toBe(false)
    }
  })

  it("THE TOLERANCE FLOOR: the bbox-midpoint source is a rounding error at the drop-pin zoom", () => {
    // The bbox-midpoint vs Mercator-centre gap is pi*sin(lat)*H^2/(4*worldPx(z)) px, 0.0055px here. The
    // 0.02px bound is tight enough that a degrees-based or zoom-blind source fails.
    const halfHeight = WINDOW_H / 2
    const north = latFromMercY(mercY(FLOWN.lat) - halfHeight / worldPx(17))
    const south = latFromMercY(mercY(FLOWN.lat) + halfHeight / worldPx(17))
    const midpoint = (north + south) / 2
    expect(Math.abs(mercY(midpoint) - mercY(FLOWN.lat)) * worldPx(17)).toBeLessThan(0.02)
    expect(
      shouldRestoreDropPinCamera(
        snapshot(),
        dismissal({ viewport: { center: { lat: midpoint, lng: FLOWN.lng }, zoom: 17 } }),
      ),
    ).toBe(true)
  })
})
