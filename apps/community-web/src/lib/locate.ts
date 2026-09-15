/**
 * Precise map centering for the web app (no city hardcoded, and no fallback coordinate at all).
 *
 * Resolves the user's PRECISE browser location ONCE per session for the initial map camera, else null.
 * There is no neutral centre here any more: when the browser gives nothing, the caller reads the
 * server's approximate location (`GET /geo/approximate` via @civfix/ui `useApproximateLocation`), which
 * always answers. The promise is module-cached so multiple maps / remounts never re-prompt or re-fetch,
 * and every surface shares the same resolved point.
 *
 * ONE DEVICE FIX PER APP, not one per subsystem. `navigator.geolocation.getCurrentPosition` used to be
 * called from TWO independent resolvers on a cold load - this module (the map camera, 6s timeout) and
 * the web `GeolocationCapability` (lib/web-geolocation, feeding @civfix/ui's `useUserLocation`, which
 * caps the fix at ITS OWN 4s) - so the two settled at different moments and each settle kicked off its
 * own refetch wave ("everything loads twice"). `getSharedBrowserFix()` below is now the single
 * underlying position request: both resolvers await the SAME promise under the SAME
 * {@link DEVICE_FIX_TIMEOUT_MS} policy, so a cold load settles once, together.
 */
import type { LatLng } from "@civfix/shared/geocode"

/**
 * How long the ONE-SHOT device fix gets before the browser gives up and every consumer falls back
 * (camera -> IP center; `useUserLocation` -> IP bias). This is deliberately the SAME 4s cap
 * @civfix/ui's `useUserLocation` applies on its side (`DEVICE_FIX_TIMEOUT_MS` in data/hooks/location.ts):
 * with the browser call itself capped here, the hook's own guard and the map's device attempt expire at
 * the SAME moment, so the map camera and the location-keyed queries settle in one wave instead of two
 * (4s vs the old 6s) staggered ones.
 */
export const DEVICE_FIX_TIMEOUT_MS = 4000

/**
 * Browser geolocation request options shared with the web GeolocationCapability's `watchPosition`
 * (lib/web-geolocation). Low-accuracy, 10min position cache - good enough for centering without the
 * battery/latency cost of a high-accuracy GPS fix. (The one-shot path in `getSharedBrowserFix` uses
 * the same policy with {@link DEVICE_FIX_TIMEOUT_MS} as its timeout.)
 */
export const GEO_POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 600000,
}

/**
 * A one-shot device fix in the shape the `GeolocationCapability` contract wants (structurally a
 * @civfix/ui `GeoPosition`), so lib/web-geolocation can hand the shared promise straight through.
 */
export interface BrowserFix {
  latitude: number
  longitude: number
  accuracy?: number
}

let sharedFix: { at: number; promise: Promise<BrowserFix> } | null = null

/**
 * THE one-shot `navigator.geolocation.getCurrentPosition` call for the whole app. Every consumer that
 * wants the device's position once (the initial map camera, the Locate button, the
 * `GeolocationCapability.getCurrentPosition` behind `useUserLocation` and the report wizard) funnels
 * through here, so a cold load issues exactly ONE browser position request (one permission prompt, one
 * settle point) no matter how many subsystems ask.
 *
 * REJECTS on denial / unavailability / timeout - the capability contract distinguishes a granted fix
 * from a denial by the rejection, so it must survive; callers that just want "a point or nothing"
 * (`getBrowserPosition`) flatten it to null themselves.
 *
 * CACHING. A settled SUCCESS is reused for `GEO_POSITION_OPTIONS.maximumAge` (10min) - the same window
 * the browser-level `maximumAge` already allowed every caller to receive, so no consumer sees a staler
 * fix than before. A FAILURE is dropped from the cache once it settles: concurrent boot-time callers
 * still share the one in-flight rejection (that is the dedupe that matters), but a later deliberate
 * retry (the Locate button, the report wizard) gets a fresh attempt instead of a canned error - the
 * browser remembers the permission decision, so a re-ask after a hard denial does not re-prompt.
 */
export function getSharedBrowserFix(): Promise<BrowserFix> {
  const now = Date.now()
  if (sharedFix && now - sharedFix.at < (GEO_POSITION_OPTIONS.maximumAge ?? 0)) {
    return sharedFix.promise
  }
  const promise = new Promise<BrowserFix>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation unavailable"))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
        }),
      (err) => reject(err),
      { ...GEO_POSITION_OPTIONS, timeout: DEVICE_FIX_TIMEOUT_MS },
    )
  })
  const entry = { at: now, promise }
  sharedFix = entry
  // Failures don't stick (see above). The no-op catch also keeps a consumer-less rejection from
  // surfacing as an unhandled-promise error.
  promise.catch(() => {
    if (sharedFix === entry) sharedFix = null
  })
  return promise
}

let preciseCenterPromise: Promise<LatLng | null> | null = null

/**
 * The viewer's PRECISE position for the initial map camera, resolved at most once per session: the map
 * prompts for browser geolocation on load and resolves to null on denial / timeout / no support. Never
 * rejects, and never substitutes an estimate of its own - when this is null the caller asks the server
 * for an approximate location instead (@civfix/ui `useApproximateLocation`), which always answers.
 */
export function resolvePreciseCenter(): Promise<LatLng | null> {
  if (!preciseCenterPromise) preciseCenterPromise = getBrowserPosition()
  return preciseCenterPromise
}

/**
 * The shared one-shot fix as a plain `LatLng`, or null on denial/timeout/unsupported (never rejects).
 * Rides `getSharedBrowserFix`, so however many surfaces call this, the browser is asked once.
 */
export function getBrowserPosition(): Promise<LatLng | null> {
  return getSharedBrowserFix().then(
    (fix) => ({ lat: fix.latitude, lng: fix.longitude }),
    () => null,
  )
}
