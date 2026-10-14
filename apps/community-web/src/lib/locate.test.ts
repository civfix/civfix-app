import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { DEVICE_FIX_TIMEOUT_MS } from "@civfix/shared"

/**
 * The module caches at module level, so each test re-imports a fresh module via `vi.resetModules()`
 * and a dynamic import.
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

async function freshModules() {
  vi.resetModules()
  const {
    GEO_POSITION_OPTIONS,
    getBrowserPosition,
    getSharedBrowserFix,
    resolvePreciseCenter,
    resolvePreciseCenterAfterPrompt,
  } = await import("@/lib/locate")
  const { webGeolocation } = await import("@/lib/web-geolocation")
  return {
    GEO_POSITION_OPTIONS,
    getBrowserPosition,
    getSharedBrowserFix,
    resolvePreciseCenter,
    resolvePreciseCenterAfterPrompt,
    webGeolocation,
  }
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

  it("asks the browser under the ONE aligned timeout policy (useUserLocation's 4s, not a 6s/8s split)", async () => {
    const { getSharedBrowserFix, GEO_POSITION_OPTIONS } = await freshModules()
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

describe("resolvePreciseCenterAfterPrompt counts a grant as prompted only on a prompt -> granted transition", () => {
  function stubPermissions(query: ReturnType<typeof vi.fn>) {
    vi.stubGlobal("navigator", { geolocation: geo.geolocation, permissions: { query } })
  }

  function sequence(...states: string[]) {
    const query = vi.fn()
    for (const state of states) query.mockResolvedValueOnce({ state })
    return query
  }

  async function settle(resolveFix: boolean) {
    const { resolvePreciseCenterAfterPrompt } = await freshModules()
    const pending = resolvePreciseCenterAfterPrompt()
    await vi.waitFor(() => expect(geo.calls).toHaveLength(1))
    if (resolveFix) geo.calls[0]!.resolve(34.05, -118.24)
    else geo.calls[0]!.reject()
    return pending
  }

  it("is prompted when the state was prompt before the request and granted after the fix", async () => {
    const query = sequence("prompt", "granted")
    stubPermissions(query)
    await expect(settle(true)).resolves.toEqual({ precise: { lat: 34.05, lng: -118.24 }, prompted: true })
    expect(query).toHaveBeenCalledTimes(2)
    expect(query).toHaveBeenCalledWith({ name: "geolocation" })
  })

  it("reads the before state ahead of the browser request", async () => {
    const query = sequence("prompt", "granted")
    stubPermissions(query)
    const { resolvePreciseCenterAfterPrompt } = await freshModules()
    const pending = resolvePreciseCenterAfterPrompt()
    await vi.waitFor(() => expect(geo.calls).toHaveLength(1))
    expect(query).toHaveBeenCalledTimes(1)
    geo.calls[0]!.resolve(34.05, -118.24)
    await pending
    expect(query).toHaveBeenCalledTimes(2)
  })

  it("is not prompted when WebKit still says prompt after the fix, since no dialog was answered", async () => {
    stubPermissions(sequence("prompt", "prompt"))
    await expect(settle(true)).resolves.toMatchObject({ prompted: false })
  })

  it("is not prompted when the second query rejects", async () => {
    const query = vi.fn().mockResolvedValueOnce({ state: "prompt" }).mockRejectedValueOnce(new TypeError("nope"))
    stubPermissions(query)
    await expect(settle(true)).resolves.toMatchObject({ prompted: false })
  })

  it("is not prompted for a permission already granted or denied before the request, and never re-queries", async () => {
    for (const state of ["granted", "denied"]) {
      geo = makeGeoStub()
      const query = sequence(state, "granted")
      stubPermissions(query)
      await expect(settle(state === "granted")).resolves.toMatchObject({ prompted: false })
      expect(query).toHaveBeenCalledTimes(1)
    }
  })

  it("is not prompted when the prompt was answered with Block", async () => {
    stubPermissions(sequence("prompt", "denied"))
    await expect(settle(false)).resolves.toEqual({ precise: null, prompted: false })
  })

  it("is not prompted without a Permissions API, or when the first query rejects", async () => {
    await expect(settle(true)).resolves.toMatchObject({ prompted: false })
    geo = makeGeoStub()
    stubPermissions(vi.fn().mockRejectedValue(new TypeError("nope")))
    await expect(settle(true)).resolves.toMatchObject({ prompted: false })
  })
})
