"use client"

/**
 * getCurrentPosition REJECTS (rather than resolving null) on denial, unavailability or timeout: that is
 * how the precise-permission gate tells a granted fix from a denial. It is the app-wide shared fix from
 * lib/locate.ts, so the camera and `useUserLocation` settle in one wave. Watch streams stay
 * per-subscriber; only the one-shot is deduped.
 */
import type { GeolocationCapability, GeoPosition } from "@civfix/ui/capabilities"

import { GEO_POSITION_OPTIONS as GEO_OPTIONS, getSharedBrowserFix } from "@/lib/locate"

function isAvailable(): boolean {
  return typeof navigator !== "undefined" && !!navigator.geolocation
}

export const webGeolocation: GeolocationCapability = {
  isAvailable,

  getCurrentPosition(): Promise<GeoPosition> {
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
