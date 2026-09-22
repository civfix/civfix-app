import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

/**
 * The app-wide one-shot geolocation dedupe (lib/locate.ts `getSharedBrowserFix`).
 *
 * The regression this pins: the web app used to issue TWO independent
 * `navigator.geolocation.getCurrentPosition` calls on a cold load - the map camera's resolver (6s
 * timeout) and the GeolocationCapability behind @civfix/ui's `useUserLocation` (which caps its own wait
 * at 4s) - so the two settled at different moments and each settle fired its own refetch wave
 * ("everything loads twice"). The contract now: every one-shot consumer funnels through ONE shared
 * browser request under ONE timeout policy ({@link DEVICE_FIX_TIMEOUT_MS} = the 4s `useUserLocation`
 * already enforces), successes are reused for the browser-cache window, and failures do not stick (a
 * later deliberate retry gets a fresh attempt).
 *
 * The module caches at module level, so each test re-imports a FRESH module via `vi.resetModules()` +
 * dynamic import (the same pattern the module-cached `resolvePreciseCenter` forces).
 */

type SuccessCb = (pos: { coords: { latitude: number; longitude: number; accuracy: number | null } }) => void
type ErrorCb = (err: unknown) => void

/** A controllable `navigator.geolocation` stub that records every getCurrentPosition call. */
function makeGeoStub() {
  const calls: { options?: PositionOptions; resolve: (lat: number, lng: number) => void; reject: (err?: unknown) => void }[] = []
  const geolocation = {
    getCurrentPosition: (onOk: SuccessCb, onErr?: ErrorCb, options?: PositionOptions) => {
      calls.push({
        options,
        resolve: (lat: number, lng: number) =>
          onOk({ coords: { latitude: lat, longitude: lng, accuracy: 25 } }),
        reject: (err?: unknown) => onErr?.(err ?? new Error("denied")),
      })
    },
  }
  return { calls, geolocation }
}

let geo: ReturnType<typeof makeGeoStub>

/** Fresh module instances (their module-level caches empty) against the current navigator stub. */
async function freshModules() {
  vi.resetModules()
  const locate = await import("@/lib/locate")
  const webGeo = await import("@/lib/web-geolocation")
  return { ...locate, webGeolocation: webGeo.webGeolocation }
}

beforeEach(() => {
  geo = makeGeoStub()
  vi.stubGlobal("navigator", { geolocation: geo.geolocation })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getSharedBrowserFix dedupes every one-shot consumer onto one browser request", () => {
  it("the camera resolver, the capability and the LatLng helper share ONE getCurrentPosition call", async () => {
    const { resolvePreciseCenter, webGeolocation, getBrowserPosition } = await freshModules()

    // All three cold-load consumers ask concurrently - the exact boot-time shape.
    const camera = resolvePreciseCenter()
    const capability = webGeolocation.getCurrentPosition()
    const latLng = getBrowserPosition()
    expect(geo.calls).toHaveLength(1)

    geo.calls[0]!.resolve(34.05, -118.25)
    await expect(capability).resolves.toEqual({ latitude: 34.05, longitude: -118.25, accuracy: 25 })
    await expect(latLng).resolves.toEqual({ lat: 34.05, lng: -118.25 })
    // Device fix granted -> the camera target is that same precise point (dot-eligible).
    await expect(camera).resolves.toEqual({ lat: 34.05, lng: -118.25 })
  })

  it("asks the browser under the ONE aligned timeout policy (useUserLocation's 4s, not the old 6s/8s split)", async () => {
    const { getSharedBrowserFix, DEVICE_FIX_TIMEOUT_MS, GEO_POSITION_OPTIONS } = await freshModules()
    void getSharedBrowserFix().catch(() => {})
    expect(DEVICE_FIX_TIMEOUT_MS).toBe(4000)
    expect(geo.calls[0]!.options).toMatchObject({
      timeout: DEVICE_FIX_TIMEOUT_MS,
      enableHighAccuracy: false,
      maximumAge: GEO_POSITION_OPTIONS.maximumAge,
    })
  })

  it("reuses a settled SUCCESS (the browser-cache window) instead of re-asking", async () => {
    const { getSharedBrowserFix, getBrowserPosition } = await freshModules()
    const first = getSharedBrowserFix()
    geo.calls[0]!.resolve(34.05, -118.25)
    await first

    await expect(getBrowserPosition()).resolves.toEqual({ lat: 34.05, lng: -118.25 })
    expect(geo.calls).toHaveLength(1)
  })

  it("does NOT cache a failure: concurrent callers share the rejection, a later retry re-asks", async () => {
    const { getSharedBrowserFix, getBrowserPosition, webGeolocation } = await freshModules()

    // Both boot-time callers share the ONE in-flight attempt and the ONE denial...
    const denied = webGeolocation.getCurrentPosition()
    const flattened = getBrowserPosition()
    expect(geo.calls).toHaveLength(1)
    geo.calls[0]!.reject()
    // ...which the capability surfaces as a rejection (the permission gate reads it) and the LatLng
    // helper flattens to null (the camera then falls back to IP).
    await expect(denied).rejects.toBeInstanceOf(Error)
    await expect(flattened).resolves.toBeNull()

    // A later deliberate retry (Locate button / report wizard) gets a FRESH attempt.
    const retried = getSharedBrowserFix()
    expect(geo.calls).toHaveLength(2)
    geo.calls[1]!.resolve(37.8, -122.4)
    await expect(retried).resolves.toMatchObject({ latitude: 37.8, longitude: -122.4 })
  })

  it("resolves the precise centre to null on denial - and never substitutes a coordinate", async () => {
    const { resolvePreciseCenter } = await freshModules()
    const camera = resolvePreciseCenter()
    geo.calls[0]!.reject()
    await expect(camera).resolves.toBeNull()
  })

  it("rejects (capability) / resolves null (helper) when the browser has no geolocation at all", async () => {
    vi.stubGlobal("navigator", {})
    const { webGeolocation, getBrowserPosition } = await freshModules()
    await expect(webGeolocation.getCurrentPosition()).rejects.toBeInstanceOf(Error)
    await expect(getBrowserPosition()).resolves.toBeNull()
  })
})

describe("geolocationPromptPending reports only a still-unanswered prompt", () => {
  it("is true when the Permissions API says prompt, and asks for the geolocation descriptor", async () => {
    const query = vi.fn().mockResolvedValue({ state: "prompt" })
    vi.stubGlobal("navigator", { geolocation: geo.geolocation, permissions: { query } })
    const { geolocationPromptPending } = await freshModules()
    await expect(geolocationPromptPending()).resolves.toBe(true)
    expect(query).toHaveBeenCalledWith({ name: "geolocation" })
  })

  it("is false for an already-granted or denied permission", async () => {
    for (const state of ["granted", "denied"]) {
      vi.stubGlobal("navigator", {
        geolocation: geo.geolocation,
        permissions: { query: vi.fn().mockResolvedValue({ state }) },
      })
      const { geolocationPromptPending } = await freshModules()
      await expect(geolocationPromptPending()).resolves.toBe(false)
    }
  })

  it("is false without a Permissions API, and when the query rejects", async () => {
    vi.stubGlobal("navigator", { geolocation: geo.geolocation })
    await expect((await freshModules()).geolocationPromptPending()).resolves.toBe(false)
    vi.stubGlobal("navigator", {
      geolocation: geo.geolocation,
      permissions: { query: vi.fn().mockRejectedValue(new TypeError("nope")) },
    })
    await expect((await freshModules()).geolocationPromptPending()).resolves.toBe(false)
  })

  it("never touches the one-shot fix, so it cannot raise a prompt of its own", async () => {
    vi.stubGlobal("navigator", {
      geolocation: geo.geolocation,
      permissions: { query: vi.fn().mockResolvedValue({ state: "prompt" }) },
    })
    const { geolocationPromptPending } = await freshModules()
    await geolocationPromptPending()
    expect(geo.calls).toHaveLength(0)
  })
})
