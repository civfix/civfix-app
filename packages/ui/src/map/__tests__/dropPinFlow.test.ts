/**
 * Unit tests for the drop-pin nav seam (`map/dropPinFlow`). Pure zustand + plain functions, so vitest
 * drives it with no React Native renderer.
 *
 * THE CONTRACT UNDER TEST is `openDropPinMenu`'s BOOLEAN RETURN. Both hosts fly a camera after calling it,
 * and before the return value existed they flew that camera UNCONDITIONALLY - so a long press it declined
 * still zoomed to z17 and offset the centre for a pin and a menu that were never created. These tests pin
 * both branches: false + nothing mutated on a declined press, true + pin dropped + sheet opened otherwise.
 *
 * AND THE SETTLED DETENT, which is geometry, not taste: a FULL sheet leaves exactly `sheetTopReserve` px of
 * map above it (`sheetSnapPoints` clamps `full` to `windowHeight - topReserve`), of which the first
 * `insets.top` are the notch - 32 usable px on every notched phone, against a 52pt DropPin teardrop. No
 * camera offset can show a pin there, so this module brings the sheet down to MID and `dropPinCamera` centres
 * in the 328px strip that leaves. `dropPinCamera.test.ts` holds the matching screen-y assertions.
 *
 * WHY THE DECLINE CASE SEEDS `create-cleanup` AND NOT SOME OTHER KIND: the guard reads
 * `nav/flowKinds.FLOW_KINDS`, whose membership is deliberately volatile (kinds have joined and left it as
 * their bodies gained or lost a draft to protect). `create-cleanup` is the
 * ORIGINAL, load-bearing member: it is the host-an-event form whose meet-location step collapses the sheet
 * to peek precisely so the map underneath is long-pressable, which is the whole reason the guard exists. A
 * test seeded with a kind that later leaves the set would fail for a reason that has nothing to do with
 * this module.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { useNavStore } from "../../nav"
import type { DetailEntry } from "../../nav"
import { stackAfterFlowPublished } from "../../bodies/composerCreateFlow"
import { useDroppedPin, type DroppedPin } from "../droppedPinStore"
import { useMapViewport } from "../mapViewportStore"
import { dropPinCameraTarget, type DropPinCameraTarget } from "../dropPinCamera"
import {
  armDropPinCleanup,
  captureDropPinCamera,
  disarmDropPinCleanup,
  openDropPinMenu,
  setDropPinCameraRestorer,
} from "../dropPinFlow"

/**
 * Reset the singletons. This is a RAW setState (no reducer runs), so `active` and `originView` are written
 * by hand to preserve the store's invariants - see nav/__tests__/nav.test.ts for the same helper.
 */
function seedNav(stack: DetailEntry[], mode: "compact" | "expanded" = "compact", snap: 0 | 1 | 2 = 0): void {
  useNavStore.setState({
    view: "map",
    stack,
    active: stack.at(-1) ?? null,
    snap,
    snapAnimated: true,
    query: "",
    mode,
    originView: stack.length > 0 ? "map" : null,
  })
}

beforeEach(() => {
  // The cleanup subscription is a MODULE-level singleton; leaving one armed would let a later test's nav
  // mutation clear the pin mid-assertion. `disarmDropPinCleanup` also drops the armed camera snapshot.
  disarmDropPinCleanup()
  setDropPinCameraRestorer(null)
  seedNav([])
  useDroppedPin.setState({ pin: null })
  useMapViewport.setState({ viewport: null })
})

afterEach(() => {
  disarmDropPinCleanup()
  setDropPinCameraRestorer(null)
})

describe("openDropPinMenu: the accepted press", () => {
  it("returns true, drops the pin and opens the sheet", () => {
    expect(openDropPinMenu(34.05, -118.25)).toBe(true)
    expect(useDroppedPin.getState().pin).toEqual({ lat: 34.05, lng: -118.25 })
    const nav = useNavStore.getState()
    expect(nav.active).toMatchObject({ kind: "drop-pin", lat: 34.05, lng: -118.25 })
    // MID - the one detent the camera math offsets for, and the only one a dropped pin is viewable at.
    expect(nav.snap).toBe(1)
  })

  it("SETTLES A FULL SHEET AT MID - a 52pt pin cannot be seen in the 32px strip FULL leaves", () => {
    seedNav([], "compact", 2)
    expect(openDropPinMenu(34.05, -118.25)).toBe(true)
    expect(useNavStore.getState().snap).toBe(1)
  })

  it("lands at MID from EVERY starting detent (the one detent the camera math is aimed at)", () => {
    for (const from of [0, 1, 2] as const) {
      seedNav([], "compact", from)
      expect(openDropPinMenu(34.05, -118.25)).toBe(true)
      expect(useNavStore.getState().snap).toBe(1)
      // Animated, so a full sheet visibly travels down rather than snapping.
      expect(useNavStore.getState().snapAnimated).toBe(true)
    }
  })

  it("leaves the sheet alone on EXPANDED (no sheet there - the sidebar occludes horizontally)", () => {
    seedNav([{ kind: "cleanups" }], "expanded", 2)
    expect(openDropPinMenu(34.05, -118.25)).toBe(true)
    expect(useNavStore.getState().snap).toBe(2)
  })

  it("carries the ROUNDED coordinate onto the nav entry (6dp, so marker and menu agree)", () => {
    expect(openDropPinMenu(37.77491234567, -122.41939876543)).toBe(true)
    expect(useNavStore.getState().active).toMatchObject({ lat: 37.774912, lng: -122.419399 })
  })

  it("REPLACES a previous drop-pin on compact (lateral map browsing accumulates no back-stack)", () => {
    expect(openDropPinMenu(34.05, -118.25)).toBe(true)
    expect(openDropPinMenu(34.06, -118.26)).toBe(true)
    expect(useNavStore.getState().stack).toHaveLength(1)
  })

  it("APPENDS on expanded (the sidebar's panel stack)", () => {
    seedNav([{ kind: "cleanups" }], "expanded", 1)
    expect(openDropPinMenu(34.05, -118.25)).toBe(true)
    expect(useNavStore.getState().stack).toHaveLength(2)
  })
})

describe("openDropPinMenu: the DECLINED press", () => {
  it("returns false while a creation flow owns the stack", () => {
    seedNav([{ kind: "create-cleanup" }])
    expect(openDropPinMenu(34.05, -118.25)).toBe(false)
  })

  it("mutates NOTHING on a declined press - no pin, no stack change, no snap change", () => {
    seedNav([{ kind: "create-cleanup" }], "compact", 0)
    openDropPinMenu(34.05, -118.25)
    expect(useDroppedPin.getState().pin).toBeNull()
    const nav = useNavStore.getState()
    expect(nav.stack).toEqual([{ kind: "create-cleanup" }])
    expect(nav.snap).toBe(0)
  })

  it("declines even when the flow is BURIED under another entry", () => {
    seedNav([{ kind: "create-cleanup" }, { kind: "person", id: "u1" }])
    expect(openDropPinMenu(34.05, -118.25)).toBe(false)
  })
})

describe("armDropPinCleanup", () => {
  it("clears the pin once the drop-pin entry leaves the stack", () => {
    expect(openDropPinMenu(34.05, -118.25)).toBe(true)
    useNavStore.getState().back()
    expect(useDroppedPin.getState().pin).toBeNull()
  })

  it("is idempotent, so a StrictMode double-mount cannot double-clear", () => {
    expect(openDropPinMenu(34.05, -118.25)).toBe(true)
    armDropPinCleanup()
    armDropPinCleanup()
    expect(useDroppedPin.getState().pin).toEqual({ lat: 34.05, lng: -118.25 })
  })
})

// --- THE CAMERA RESTORE ---------------------------------------------------------------------------
//
// `armDropPinCleanup` is the ONE subscription that already fires exactly once when the drop-pin entry
// leaves the stack, covering every dismissal route including the ones that never enter DropPinBody (sheet
// drag, map tap, Android back). The restore rides it. THE HOST OWNS THE CAMERA (dropPinCamera.ts:64-68),
// so the module calls a host-registered callback and never touches maplibre - which is also what makes
// this testable with no renderer.

/** The sim device's geometry - the same numbers `dropPinCamera.test.ts` measures against. */
const SIM = { windowHeight: 874, sheetTopReserve: 91, topInset: 59 } as const

/** Where the map was before any of this: a wide view of a different part of LA. */
const ORIGIN: DropPinCameraTarget = { lat: 34.1, lng: -118.3, zoom: 12 }

/** Publish a settled map camera exactly as both Map seams do via `useMapViewport.setRegion`. */
function publishViewport(camera: DropPinCameraTarget): void {
  useMapViewport.setState({
    viewport: {
      center: { lat: camera.lat, lng: camera.lng },
      zoom: camera.zoom,
      bbox: {
        north: camera.lat + 0.01,
        south: camera.lat - 0.01,
        east: camera.lng + 0.01,
        west: camera.lng - 0.01,
      },
    },
  })
}

/**
 * Replay the mobile host's `onLongPressMap`: read the pre-press camera and the already-open guard BEFORE
 * `openDropPinMenu`, compute the target from the detent the sheet SETTLED at, arm the snapshot, then fly
 * (publishing the new camera the way a settle would). Returns the camera it flew to.
 */
function longPress(lat: number, lng: number, from: DropPinCameraTarget): DropPinCameraTarget {
  const nav = useNavStore.getState()
  const menuAlreadyOpen = nav.stack.some((entry) => entry.kind === "drop-pin")
  const view = nav.view
  publishViewport(from)
  expect(openDropPinMenu(lat, lng)).toBe(true)
  const flownTo = dropPinCameraTarget({
    lat,
    lng,
    currentZoom: from.zoom,
    ...SIM,
    sheetDetent: useNavStore.getState().snap,
    mode: "compact",
  })
  captureDropPinCamera({ from, flownTo, view }, menuAlreadyOpen)
  publishViewport(flownTo)
  return flownTo
}

/** Collect every camera the flow asks the host to fly. */
function recordRestores(): DropPinCameraTarget[] {
  const restored: DropPinCameraTarget[] = []
  setDropPinCameraRestorer((target) => restored.push(target))
  return restored
}

describe("armDropPinCleanup: the camera restore", () => {
  it("flies the host back to the PRE-PRESS camera on Cancel", () => {
    const restored = recordRestores()
    longPress(34.05, -118.25, ORIGIN)
    // DropPinBody.onCancel (DropPinBody.tsx:132): nav.back().
    useNavStore.getState().back()
    expect(restored).toEqual([ORIGIN])
  })

  it("clears the marker BEFORE it flies, so both land on one frame", () => {
    const seen: (DroppedPin | null)[] = []
    setDropPinCameraRestorer(() => seen.push(useDroppedPin.getState().pin))
    longPress(34.05, -118.25, ORIGIN)
    useNavStore.getState().back()
    expect(seen).toEqual([null])
  })

  it("fires EXACTLY ONCE - collapseToParent is reachable from four routes", () => {
    const restored = recordRestores()
    longPress(34.05, -118.25, ORIGIN)
    useNavStore.getState().back()
    useNavStore.getState().collapseToParent()
    useNavStore.getState().collapseToParent()
    expect(restored).toEqual([ORIGIN])
  })

  it("restores on a sheet drag-down too (collapseToParent, not back)", () => {
    const restored = recordRestores()
    longPress(34.05, -118.25, ORIGIN)
    useNavStore.getState().collapseToParent()
    expect(restored).toEqual([ORIGIN])
  })

  it("does NOT restore on 'Report an issue here' - selectView('report') is a commitment", () => {
    const restored = recordRestores()
    longPress(34.05, -118.25, ORIGIN)
    useNavStore.getState().selectView("report")
    expect(useDroppedPin.getState().pin).toBeNull()
    expect(restored).toEqual([])
  })

  it("does NOT restore on the [drop-pin, cleanup] publish-then-dismiss trap", () => {
    const restored = recordRestores()
    longPress(34.05, -118.25, ORIGIN)
    // "Host an event here": a drill-down ON TOP of the menu, so the pin and the snapshot stay armed.
    useNavStore.getState().push({ kind: "create-cleanup", lat: 34.05, lng: -118.25 })
    expect(useDroppedPin.getState().pin).not.toBeNull()
    // Publish: stackAfterFlowPublished replaces the FLOW entry with the created event and leaves the
    // drop-pin entry underneath - which is why CreateCleanupBody clears the marker by hand there.
    const published = stackAfterFlowPublished(useNavStore.getState().stack, {
      kind: "cleanup",
      id: "c1",
    })
    expect(published?.map((entry) => entry.kind)).toEqual(["drop-pin", "cleanup"])
    useNavStore.getState().setStack(published!)
    useDroppedPin.getState().clear()
    publishViewport({ lat: 34.05, lng: -118.25, zoom: 17 })
    // Minutes later the user drags the EVENT detail away; the drop-pin entry leaves as collateral.
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().stack).toEqual([])
    expect(restored).toEqual([])
  })

  it("does NOT restore after a pan while the menu was open", () => {
    const restored = recordRestores()
    const flownTo = longPress(34.05, -118.25, ORIGIN)
    // The strip of map above the MID sheet is live: 0.002 deg of longitude is 373px at z17.
    publishViewport({ ...flownTo, lng: flownTo.lng + 0.002 })
    useNavStore.getState().back()
    expect(restored).toEqual([])
  })

  it("a SECOND long press keeps the FIRST pre-press camera and re-points the pan check", () => {
    // "drop-pin" is not a FLOW_KIND, so a second long press is ACCEPTED and openDetail replaces the entry.
    // The pre-press camera must not be overwritten with the first fly's - but `flownTo` MUST be, or the
    // pan check compares the live viewport against a camera the app has already left.
    const restored = recordRestores()
    const first = longPress(34.05, -118.25, ORIGIN)
    const second = longPress(34.07, -118.27, first)
    expect(second.lng).not.toBe(first.lng)
    expect(useNavStore.getState().stack).toHaveLength(1)
    useNavStore.getState().back()
    expect(restored).toEqual([ORIGIN])
  })

  it("does not throw when no host registered a restorer (web, today)", () => {
    setDropPinCameraRestorer(null)
    longPress(34.05, -118.25, ORIGIN)
    expect(() => useNavStore.getState().back()).not.toThrow()
    expect(useDroppedPin.getState().pin).toBeNull()
  })

  it("does not restore when nothing was captured (a press with no map viewport)", () => {
    const restored = recordRestores()
    expect(openDropPinMenu(34.05, -118.25)).toBe(true)
    useNavStore.getState().back()
    expect(restored).toEqual([])
  })

  it("disarmDropPinCleanup DROPS the snapshot, so a stale one cannot outlive the subscription", () => {
    const restored = recordRestores()
    longPress(34.05, -118.25, ORIGIN)
    disarmDropPinCleanup()
    armDropPinCleanup()
    useNavStore.getState().back()
    expect(restored).toEqual([])
  })
})
