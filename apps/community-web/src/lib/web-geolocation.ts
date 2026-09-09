"use client"

/**
 * Web GEOLOCATION capability impl - the platform-seam realization of `@civfix/ui/capabilities`
 * GeolocationCapability for the browser. It wraps `navigator.geolocation` so the shared report wizard's
 * LocationPicker (initial center) and the nearby-events precise-permission gate can read a REAL device
 * position instead of the fake (which never resolves a fix).
 *
 *   - isAvailable()        : whether the browser exposes geolocation at all.
 *   - getCurrentPosition() : one-shot fix; RESOLVES {latitude,longitude,accuracy} on success and REJECTS
 *                            on denial / unavailable / timeout. The reject (not a null resolve) is how the
 *                            precise-permission gate distinguishes a granted fix from a denial. It is the
 *                            SHARED app-wide fix (lib/locate.ts `getSharedBrowserFix`): the same underlying
 *                            `navigator.geolocation` request the initial map camera awaits, so a cold load
 *                            issues ONE browser position request and `useUserLocation`'s location-keyed
 *                            queries settle in the same wave as the camera instead of a second, staggered
 *                            one (the old split - 8s options here vs the camera's own 6s call - was half of
 *                            the "everything loads twice" bug).
 *   - watchPosition()      : subscribe to position updates; the returned unsubscribe clears the watch (and
 *                            is a no-op when geolocation is unavailable). Streams stay per-subscriber; only
 *                            the one-shot is deduped.
 */
import type { GeolocationCapability, GeoPosition } from "@civfix/ui/capabilities"

import { GEO_POSITION_OPTIONS as GEO_OPTIONS, getSharedBrowserFix } from "@/lib/locate"

function isAvailable(): boolean {
  return typeof navigator !== "undefined" && !!navigator.geolocation
}

/** The web GeolocationCapability singleton (built once for the app lifetime). */
export const webGeolocation: GeolocationCapability = {
  isAvailable,

  getCurrentPosition(): Promise<GeoPosition> {
    // `BrowserFix` is structurally a `GeoPosition`; the shared promise's rejection (denial/timeout/
    // unavailable, including the missing-`navigator.geolocation` case) passes through untouched.
    return getSharedBrowserFix()
  },

  watchPosition(onChange: (pos: GeoPosition) => void): () => void {
    if (!isAvailable()) return () => {}
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        onChange({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
        }),
      undefined,
      GEO_OPTIONS,
    )
    return () => {
      navigator.geolocation.clearWatch(id)
    }
  },
}
