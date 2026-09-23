/**
 * There is deliberately no fallback coordinate: when the browser gives nothing, the caller reads the
 * server's approximate location (@civfix/ui `useApproximateLocation`), which always answers.
 *
 * One device fix per app, not one per subsystem: the map camera and the web `GeolocationCapability`
 * both await `getSharedBrowserFix()` under the same {@link DEVICE_FIX_TIMEOUT_MS}, so a cold load issues
 * one browser request and settles once instead of kicking off two staggered refetch waves.
 */
import type { LatLng } from "@civfix/shared/geocode"

/**
 * Deliberately the same 4s cap @civfix/ui's `useUserLocation` applies (`DEVICE_FIX_TIMEOUT_MS` in
 * data/hooks/location.ts), so the hook's guard and the map's device attempt expire at the same moment
 * and the camera and the location-keyed queries settle in one wave.
 */
export const DEVICE_FIX_TIMEOUT_MS = 4000

/** Low accuracy with a 10min cache: good enough for centering without the battery and latency of GPS. */
export const GEO_POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 600000,
}

/** Structurally a @civfix/ui `GeoPosition`, so lib/web-geolocation can hand the promise straight through. */
export interface BrowserFix {
  latitude: number
  longitude: number
  accuracy?: number
}

let sharedFix: { at: number; promise: Promise<BrowserFix> } | null = null

/**
 * Every one-shot position request in the app funnels through here, so a cold load issues exactly one
 * browser request (one permission prompt, one settle point) no matter how many subsystems ask.
 *
 * Rejects on denial, unavailability or timeout: the capability contract tells a granted fix from a
 * denial by the rejection, so it must survive.
 *
 * A success is reused for `maximumAge`, the same window the browser itself allows. A failure leaves the
 * cache once it settles: concurrent boot-time callers still share the one in-flight rejection, but a
 * later deliberate retry (the Locate button) gets a fresh attempt. The browser remembers the permission
 * decision, so a re-ask after a hard denial does not re-prompt.
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
  // Also keeps a consumer-less rejection from surfacing as an unhandled-promise error.
  promise.catch(() => {
    if (sharedFix === entry) sharedFix = null
  })
  return promise
}

let preciseCenterPromise: Promise<LatLng | null> | null = null

/** Resolved at most once per session so remounts and multiple maps never re-prompt. Never rejects. */
export function resolvePreciseCenter(): Promise<LatLng | null> {
  if (!preciseCenterPromise) preciseCenterPromise = getBrowserPosition()
  return preciseCenterPromise
}

export function getBrowserPosition(): Promise<LatLng | null> {
  return getSharedBrowserFix().then(
    (fix) => ({ lat: fix.latitude, lng: fix.longitude }),
    () => null,
  )
}

async function geolocationPermissionState(): Promise<PermissionState | null> {
  if (typeof navigator === "undefined" || !navigator.permissions) return null
  const status = await navigator.permissions.query({ name: "geolocation" }).catch(() => null)
  return status?.state ?? null
}

export async function resolvePreciseCenterAfterPrompt(): Promise<{
  precise: LatLng | null
  prompted: boolean
}> {
  const before = await geolocationPermissionState()
  const precise = await resolvePreciseCenter()
  if (before !== "prompt") return { precise, prompted: false }
  const after = await geolocationPermissionState()
  return { precise, prompted: after === "granted" }
}
