import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { BBox } from "@civfix/shared"

import {
  CAMERA_SNAPSHOT_KEY,
  readCameraSnapshot,
  writeCameraSnapshot,
  clearCameraSnapshot,
} from "@/features/map/camera-snapshot"

/**
 * The persisted last-settled camera is what lets a returning visitor's map boot AT their metro (the
 * shared Map's `initialCenter` seed) so the load-time region fetch is the ONLY one - the fix for the
 * "map loads twice" cold-boot double fetch. These tests run in the node env (no jsdom), so we stub
 * `window` with a Map-backed fake storage - the auth-snapshot.test.ts pattern - and pin the contract:
 * write derives the bbox midpoint, the read path is self-healing (any corrupt/drifted value returns
 * null AND clears the key, so a poisoned snapshot cannot strand the boot camera off-globe), and every
 * function is an inert no-op with no window (the static-export build).
 */

/** A downtown-LA-ish settled viewport; midpoint (34.05, -118.25). */
const VIEWPORT: BBox = { west: -118.35, south: 33.95, east: -118.15, north: 34.15 }

/** Minimal Storage stand-in backed by a Map (the subset camera-snapshot touches). */
function makeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string): string | null => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string): void => {
      map.set(key, value)
    },
    removeItem: (key: string): void => {
      map.delete(key)
    },
    map,
  }
}

let storage: ReturnType<typeof makeStorage>

beforeEach(() => {
  storage = makeStorage()
  vi.stubGlobal("window", { localStorage: storage })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("camera-snapshot write/read round-trip", () => {
  it("persists the settled viewport's midpoint + zoom and reads it back", () => {
    writeCameraSnapshot(VIEWPORT, 12.5)
    expect(readCameraSnapshot()).toEqual({ lat: 34.05, lng: -118.25, zoom: 12.5 })
  })

  it("returns null on a first-ever visit (nothing written)", () => {
    expect(readCameraSnapshot()).toBeNull()
  })

  it("the latest settle wins - the snapshot is 'where the map last sat'", () => {
    writeCameraSnapshot(VIEWPORT, 12.5)
    writeCameraSnapshot({ west: -122.5, south: 37.7, east: -122.3, north: 37.9 }, 10)
    expect(readCameraSnapshot()).toEqual({ lat: 37.8, lng: -122.4, zoom: 10 })
  })

  it("clear removes the stored key", () => {
    writeCameraSnapshot(VIEWPORT, 12.5)
    clearCameraSnapshot()
    expect(storage.map.has(CAMERA_SNAPSHOT_KEY)).toBe(false)
    expect(readCameraSnapshot()).toBeNull()
  })
})

describe("camera-snapshot write refuses a camera that would strand the boot", () => {
  it("skips a non-finite viewport (transient NaN mid-teardown) without clobbering the last good one", () => {
    writeCameraSnapshot(VIEWPORT, 12.5)
    writeCameraSnapshot({ west: Number.NaN, south: 33.95, east: -118.15, north: 34.15 }, 12.5)
    expect(readCameraSnapshot()).toEqual({ lat: 34.05, lng: -118.25, zoom: 12.5 })
  })

  it("skips an off-globe midpoint and a zoom outside maplibre's range", () => {
    writeCameraSnapshot({ west: -190, south: 33.95, east: -185, north: 34.15 }, 12.5)
    expect(readCameraSnapshot()).toBeNull()
    writeCameraSnapshot(VIEWPORT, -1)
    expect(readCameraSnapshot()).toBeNull()
    writeCameraSnapshot(VIEWPORT, 25)
    expect(readCameraSnapshot()).toBeNull()
  })
})

describe("camera-snapshot read is self-healing", () => {
  it("returns null and clears the key on corrupt JSON (never throws)", () => {
    storage.setItem(CAMERA_SNAPSHOT_KEY, "{ not json")
    expect(() => readCameraSnapshot()).not.toThrow()
    expect(readCameraSnapshot()).toBeNull()
    expect(storage.map.has(CAMERA_SNAPSHOT_KEY)).toBe(false)
  })

  it("returns null and clears the key on a version mismatch", () => {
    storage.setItem(CAMERA_SNAPSHOT_KEY, JSON.stringify({ v: 2, lat: 34, lng: -118, zoom: 12 }))
    expect(readCameraSnapshot()).toBeNull()
    expect(storage.map.has(CAMERA_SNAPSHOT_KEY)).toBe(false)
  })

  it("returns null and clears the key on a hand-edited out-of-range value", () => {
    storage.setItem(CAMERA_SNAPSHOT_KEY, JSON.stringify({ v: 1, lat: 934.05, lng: -118.25, zoom: 12 }))
    expect(readCameraSnapshot()).toBeNull()
    expect(storage.map.has(CAMERA_SNAPSHOT_KEY)).toBe(false)
  })

  it("returns null and clears the key when a field is the wrong type", () => {
    storage.setItem(CAMERA_SNAPSHOT_KEY, JSON.stringify({ v: 1, lat: "34.05", lng: -118.25, zoom: 12 }))
    expect(readCameraSnapshot()).toBeNull()
    expect(storage.map.has(CAMERA_SNAPSHOT_KEY)).toBe(false)
  })
})

describe("camera-snapshot is SSR-safe (no window)", () => {
  beforeEach(() => {
    // Override the suite-wide window stub: with no window, every function must be an inert no-op.
    vi.stubGlobal("window", undefined)
  })

  it("read returns null and write/clear do not throw", () => {
    expect(readCameraSnapshot()).toBeNull()
    expect(() => writeCameraSnapshot(VIEWPORT, 12)).not.toThrow()
    expect(() => clearCameraSnapshot()).not.toThrow()
  })
})
