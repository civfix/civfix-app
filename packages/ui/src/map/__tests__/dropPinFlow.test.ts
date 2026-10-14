/**
 * The decline case seeds `create-cleanup` because it is the original, load-bearing flow kind (its
 * meet-location step peeks the sheet to expose a long-pressable map); FLOW_KINDS membership is otherwise
 * volatile, and a kind that later left the set would fail this test for an unrelated reason.
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
 * A raw setState runs no reducer, so `active` and `originView` are written by hand to preserve the store's
 * invariants.
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
  // A module-level subscription left armed would let a later test's nav mutation clear the pin.
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

// The host owns the camera, so the module calls a host-registered callback and never touches maplibre.

/** The same geometry `dropPinCamera.test.ts` measures against. */
const SIM = { windowHeight: 874, sheetTopReserve: 91, topInset: 59 } as const

/** A wide view of a different part of LA. */
const ORIGIN: DropPinCameraTarget = { lat: 34.1, lng: -118.3, zoom: 12 }

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

/** Replays the mobile host's `onLongPressMap` ordering. */
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

function recordRestores(): DropPinCameraTarget[] {
  const restored: DropPinCameraTarget[] = []
  setDropPinCameraRestorer((target) => restored.push(target))
  return restored
}

describe("armDropPinCleanup: the camera restore", () => {
  it("flies the host back to the PRE-PRESS camera on Cancel", () => {
    const restored = recordRestores()
    longPress(34.05, -118.25, ORIGIN)
    // DropPinBody's Cancel.
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
    // stackAfterFlowPublished replaces the flow entry with the event and leaves the drop-pin entry beneath.
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
    // "drop-pin" is not a flow kind, so a second long press is accepted and replaces the entry; `flownTo`
    // must be re-pointed or the pan check compares against a camera the app has already left.
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
