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

/** The sim device (iPhone 16-class portrait) the verification script measures against. */
const WINDOW_H = 874
/** `insets.top` on that device. `sheetTopReserve` is this plus the shared 32pt gap - what CompactShell uses. */
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
    // The panel does not occlude vertically, so the latitude must come back byte-for-byte.
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

// --- occlusionLeft: the WHOLE left chrome, not just the card -------------------------------------------
//
// The top nav strip is a horizontal bar now (shell/expandedFramePlan) - it costs the map no LEFT-edge
// space of its own, so the card's own inset is the whole story. Offsetting by half the CARD leaves the
// pin west of the visible strip's centre by half the shell's inset, and in map mode (card hidden) the old
// input has nothing to say at all even though the inset itself still applies. The frame plan answers both
// in one number, so the camera takes THAT.

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
    // `/map` with an empty stack: cardVisible false, occlusionLeft = NAV_LEFT. A long press there
    // pushes the drop-pin entry (so the card comes back) - but the value the caller reads AFTER
    // `openDropPinMenu` already reflects that, and this bare-inset case is what a hidden card must produce.
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

  it("keeps the legacy sidebarWidth caller working (civfix-mobile's tablet host)", () => {
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
  // `openIfPeeked` bumps a PEEKED sheet to mid but KEEPS a FULL one, so a long press in the strip above an
  // already-full sheet opens the menu at FULL. Offsetting by mid/2 there put the pin BELOW the sheet's top
  // edge (hidden) - these are the tests that failed before `sheetDetent` existed.
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

// --- The real acceptance criterion: WHERE ON SCREEN DOES THE PIN END UP? ------------------------------
//
// Every assertion above measures a DELTA, which cannot tell "centred in the visible strip" from "shoved off
// the top of the window". These invert the projection back to a screen y and assert the pin lands inside the
// strip of map the user can actually SEE - between the safe-area inset / banner at the top and the sheet's
// top edge at the bottom. That is the assertion the FULL detent failed: `sheetSnapPoints` clamps `full` to
// `windowHeight - sheetTopReserve`, so at FULL the whole strip IS the top reserve, and offsetting by full/2
// put the pin at reserve/2 - above `insets.top`, i.e. under the Dynamic Island.

/** `mercatorYfromLat`, re-derived here rather than imported (the module keeps it private on purpose). */
const mercY = (lat: number) =>
  (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360

/**
 * The pin's screen y, in px from the top of the window, given the camera the module returned.
 *
 * The camera CENTRE is at `windowHeight / 2` by definition, and the pressed point sits
 * `(mercY(centre) - mercY(pin)) * worldPx(zoom)` px above it - so this is the inverse of everything
 * `dropPinCameraTarget` does, computed from the OUTPUT only.
 */
function pinScreenY(
  windowHeight: number,
  pressedLat: number,
  target: { lat: number; zoom: number },
): number {
  return windowHeight / 2 - (mercY(target.lat) - mercY(pressedLat)) * worldPx(target.zoom)
}

/**
 * `DROP_PIN_SIZE` from `map/pins/DropPin`, restated as a literal: that module imports react-native, and this
 * suite is a pure `.ts` unit test with no RN renderer. The marker is anchored at its BOTTOM, so the art
 * occupies `[pinY - 52, pinY]`.
 */
const DROP_PIN_ART = 52

/** Real portrait devices: [label, windowHeight, insets.top]. */
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
        // Inside the visible strip: below the notch, above the sheet's top edge.
        expect(y).toBeGreaterThanOrEqual(safeTop)
        expect(y).toBeLessThanOrEqual(windowHeight - occluded)
        // And exactly CENTRED in it, which is the stated intent rather than merely "not clipped".
        expect(y).toBeCloseTo((safeTop + (windowHeight - occluded)) / 2, 6)
      }
    })

    it(`${label}: without topInset the FULL detent puts the pin UNDER the notch (the bug)`, () => {
      // The old behaviour, preserved verbatim when `topInset` is omitted - which is exactly why it must be
      // passed. If this ever starts failing, the default changed and the back-compat claim is stale.
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
      // FULL leaves only `sheetTopReserve - safeTop` px of usable map (32 on every one of these devices), so
      // the art is TALLER than the strip whatever the camera does. This is the geometry `dropPinFlow` acts
      // on by settling compact at MID - see `dropPinFlow.test.ts`.
      expect(windowHeight - sheetSnapPoints(windowHeight, sheetTopReserve)[2] - safeTop).toBeLessThan(
        DROP_PIN_ART,
      )
    })
  }

  it("centres in the strip under a measured web banner too (no safe-area API there)", () => {
    // Mobile web: reserve is just the 32pt gutter, and the top occluder is the app-download banner's
    // MEASURED height (useAppPromoStore.bannerHeight), which is 0 once dismissed.
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
    // 874/91 -> mid 487; offset (487 - 59)/2 = 214px; at lat 37.7749 / z17 that is 9.074e-4 deg (vs the
    // 1.033e-3 the same press produces with topInset omitted).
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

// --- The same acceptance criterion, LANDSCAPE ---------------------------------------------------------
//
// The mirror of `pinScreenY`: the strip the user can see runs from the chrome's right edge
// (`occlusionLeft`) to the window's, and the pin must land in its CENTRE - not merely "somewhere east of
// the card". This is the test that fails if the camera keeps offsetting by half the CARD (45px too far
// west at every width) or forgets the rail entirely in map mode.

/**
 * The pin's screen x, in px from the left of the window, given the camera the module returned. The camera
 * CENTRE is at `windowWidth / 2` by definition and `mercatorXfromLng` is linear, so this is the exact
 * inverse of the expanded branch, computed from the OUTPUT only.
 */
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
        // Map mode with an empty stack is the card-hidden case; every other view paints the card.
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
      // The latitude is the pressed one, byte-for-byte: nothing occludes vertically in landscape.
      expect(target.lat).toBe(SF.lat)
    })
  }

  it("the OLD half-the-card offset lands the pin 7px west of the strip's centre", () => {
    // Why `occlusionLeft` replaced `sidebarWidth`: half the shell's own left inset is the whole error, at
    // every width. Preserved as a test so the legacy input's behaviour is documented rather than assumed.
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
    // `useSafeAreaInsets()` before the first layout pass / a promo height before the banner paints.
    for (const topInset of [Number.NaN, Number.POSITIVE_INFINITY, -40, undefined]) {
      expect(compact({ topInset })).toEqual(compact({ topInset: 0 }))
    }
  })

  it("clamps an inset TALLER than the visible strip to the sheet's top edge, never below it", () => {
    // Mobile web at FULL with a banner: reserve 32 vs a 72px banner, so the strip is NEGATIVE and no camera
    // can show the pin. The least-bad answer is the sheet's top edge - the pin must not sink UNDER the sheet.
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
    // A 120px banner over a PEEKED (96px) sheet: the visible strip's centre is genuinely BELOW the window's,
    // so the offset is negative and the pin must sit below the window centre - not be left unshifted.
    const target = compact({ sheetDetent: 0, topInset: 120, currentZoom: 17 })
    expect(target.lat).toBeGreaterThan(SF.lat)
    const y = pinScreenY(WINDOW_H, SF.lat, target)
    expect(y).toBeCloseTo((120 + (WINDOW_H - 96)) / 2, 6)
  })

  it("is ignored on expanded (the sidebar occludes horizontally; there is no sheet)", () => {
    expect(expanded({ topInset: 59 })).toEqual(expanded({ topInset: 0 }))
  })
})

// --- THE RESTORE: putting the camera BACK when the pull-up is dismissed ----------------------------
//
// Everything above answers "where must the camera GO for a long press". These answer the mirror question:
// "when the pull-up goes away, may the camera go BACK". The hard part is not the math - `snapshot.from` IS
// the answer - it is telling a DISMISSAL from a COMMITMENT, because both of them take the drop-pin entry
// off the nav stack by the same door.

/** Where the user WAS before the long press: a wider view of a different part of town. */
const FROM: DropPinCameraTarget = { lat: 37.7935, lng: -122.4399, zoom: 13 }

/** The camera the sim device's MID-detent drop-pin fly is ASKED to land on for a long press at SF. */
const FLOWN: DropPinCameraTarget = dropPinCameraTarget({
  ...SF,
  currentZoom: FROM.zoom,
  windowHeight: WINDOW_H,
  sheetTopReserve: TOP_RESERVE,
  topInset: SAFE_TOP,
  sheetDetent: 1,
  mode: "compact",
})

/** A viewport parked exactly on a camera - what `useMapViewport` publishes once a fly settles. */
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
    // DropPinBody.onReport -> useDraftReportStore.setPrefilledLocation (DropPinBody.tsx:98) ->
    // useNavStore.selectView("report") (DropPinBody.tsx:101), and `selectView` EMPTIES the stack - so the
    // drop-pin entry leaves by the very same door Cancel uses. The only tell is that the user is now on
    // another surface, which is what the recorded view catches.
    expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ view: "report" }))).toBe(false)
  })

  it("does NOT restore on the [drop-pin, cleanup] PUBLISH-THEN-DISMISS trap", () => {
    // A create flow stacked over the pin publishes into [drop-pin, cleanup]: `stackAfterFlowPublished`
    // (bodies/composerCreateFlow.ts:125-134) truncates only up to the topmost FLOW kind, leaving
    // [drop-pin, cleanup] - which is exactly why CreateCleanupBody.tsx:357 clears the marker BY HAND
    // there. The drop-pin entry finally leaves the stack when that EVENT detail is dismissed, and
    // restoring then would yank the camera off the event the user just created.
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
    // `openDropPinMenu` uses `push` on expanded (dropPinFlow.ts:106 - the sidebar's panel stack), so the
    // entry lands on TOP of whatever panel was already open. The rule is POSITIONAL - is the drop pin the
    // top of the stack that is going away - not "is it the only entry".
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
    // Both seams call `useMapViewport.getState().clear()` on unmount (Map.native.tsx:113,
    // Map.web.tsx:376). A fly issued then would QUEUE and replay onto the NEXT mounted map - a camera
    // yank on a surface the user has already left.
    expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport: null }))).toBe(false)
  })
})

/** The inverse of `mercY` (maplibre's `latFromMercatorY`), re-derived for the same reason `mercY` is. */
const latFromMercY = (y: number) => {
  const y2 = 180 - y * 360
  return (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90
}

/** Move a camera EAST by `px` screen pixels at its own zoom. Mercator X is linear, so this is exact. */
const nudgeEastPx = (camera: DropPinCameraTarget, px: number) => ({
  center: { lat: camera.lat, lng: camera.lng + (px / worldPx(camera.zoom)) * 360 },
  zoom: camera.zoom,
})

/** Move a camera SOUTH by `px` screen pixels at its own zoom (the inverse of the module's own shift). */
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

  // GUARD (green before this task): before the pan/zoom gate existed, `shouldRestoreDropPinCamera`
  // restored unconditionally once the view/stack/viewport checks passed, so an 11px nudge already
  // returned true with no tolerance math involved at all.
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
    // 4 px at z17 ...
    const degrees = (4 / worldPx(17)) * 360
    const at17: DropPinCameraTarget = { ...FLOWN, zoom: 17 }
    expect(
      shouldRestoreDropPinCamera(
        snapshot({ flownTo: at17 }),
        dismissal({ viewport: { center: { lat: at17.lat, lng: at17.lng + degrees }, zoom: 17 } }),
      ),
    ).toBe(true)
    // ... is 32 px at z20, where the map is 8x more magnified: the SAME degrees are now a real pan.
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
    // Anything the host calls "arrived" must never be called "panned", or the restore silently vanishes.
    expect(DROP_PIN_PAN_ZOOM_TOLERANCE).toBe(0.1)
    expect(
      shouldRestoreDropPinCamera(
        snapshot(),
        dismissal({ viewport: { ...parkedOn(FLOWN), zoom: FLOWN.zoom - 0.09 } }),
      ),
    ).toBe(true)
  })

  // GUARD (green before this task): with no pan/zoom gate yet, any non-null viewport that passed the
  // view/stack checks already restored unconditionally, so a viewport parked on `from` returned true
  // whether or not the module compared against it.
  it("restores when the viewport is still on the PRE-PRESS camera (dismissed MID-FLY)", () => {
    // Map.native publishes to useMapViewport only on settle (handleRegion at :228, wired to
    // onRegionDidChange at :360), so a long press followed immediately by a map tap finds the store still
    // holding the camera we are about to restore TO. Measuring only against `flownTo` would read that as a
    // 214px-or-worse pan and drop the restore for the fastest, most common dismissal there is.
    expect(shouldRestoreDropPinCamera(snapshot(), dismissal({ viewport: parkedOn(FROM) }))).toBe(true)
  })

  it("does NOT let a LOW-ZOOM pre-press camera launder a pan at the drop-pin zoom", () => {
    // The dangerous shape: `from` at z13 is 16x less magnified, so a 160px pan at z17 is only 10px in
    // z13's world - inside the tolerance. Each endpoint must therefore match on ZOOM as well as position.
    const nearbyWideFrom: DropPinCameraTarget = { lat: FLOWN.lat, lng: FLOWN.lng, zoom: 13 }
    expect(
      shouldRestoreDropPinCamera(
        snapshot({ from: nearbyWideFrom }),
        dismissal({ viewport: nudgeEastPx(FLOWN, 160) }),
      ),
    ).toBe(false)
  })

  // GUARD (green before this task): same cause as the sub-threshold-nudge guard above - with no
  // pan/zoom gate yet, no distance math ran at all, so the antimeridian-wrapped viewport already
  // restored regardless of the (not-yet-written) delta calculation.
  it("measures the SHORTEST way round the antimeridian, not the long way", () => {
    // A camera on the dateline with the viewport reported 8px EAST of it, which maplibre wraps to a
    // NEGATIVE longitude. A naive subtraction reads that as ~360 deg and would cancel every restore there.
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

  // GUARD (green before this task): the curvature bound it pins is pure pre-existing math (mercY /
  // worldPx, no new constants), and the final `shouldRestoreDropPinCamera` call needed no tolerance
  // logic either - the unconditional pre-gate restore already returned true for this viewport.
  it("THE TOLERANCE FLOOR: the bbox-midpoint source is a rounding error at the drop-pin zoom", () => {
    // `useMapViewport.center` is the ARITHMETIC bbox midpoint (mapViewportStore.ts:39-42), not the
    // Mercator camera centre. The gap is a second-order curvature term, pi*sin(lat)*H^2/(4*worldPx(z)) px,
    // which on the sim device (874px tall) at z17 is 0.0055px - so 12px is a ~2200x margin. THAT is why a
    // pixel tolerance can be an order of magnitude tighter than mapLifecycle's zoom-blind 1e-4-DEGREE
    // settle epsilon (18.6-23.6px at z17) without becoming flaky. The bound below is 0.02px, ~3.6x the
    // measured value: tight enough that a regression to a degrees-based or zoom-blind source fails here.
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
