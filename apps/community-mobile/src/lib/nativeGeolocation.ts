import * as Location from "expo-location"
import type { GeolocationCapability, GeoPosition } from "@civfix/ui/capabilities"
import { withTimeout } from "@civfix/shared"
import { GPS_TIMEOUT_MS, LAST_KNOWN_MAX_AGE_MS } from "@/lib/locationTimeouts"

async function foregroundPermissionGranted(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync().catch(() => null)
  return current?.status === Location.PermissionStatus.GRANTED
}

export const nativeGeolocation: GeolocationCapability = {
  isAvailable(): boolean {
    return true
  },

  async requestPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync()
    return status === Location.PermissionStatus.GRANTED
  },

  async getCurrentPosition(): Promise<GeoPosition> {
    if (!(await foregroundPermissionGranted())) throw new Error("location permission denied")
    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
    }).catch(() => null)
    const pos =
      lastKnown ??
      (await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        GPS_TIMEOUT_MS,
      ))
    if (!pos) throw new Error("location fix unavailable")
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
    }
  },

  watchPosition(onChange: (pos: GeoPosition) => void): () => void {
    let subscription: Location.LocationSubscription | null = null
    let cancelled = false
    void (async () => {
      try {
        if (!(await foregroundPermissionGranted()) || cancelled) return
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced },
          (pos) =>
            onChange({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy ?? undefined,
            }),
        )
        if (cancelled) {
          sub.remove()
          return
        }
        subscription = sub
      } catch {
        // The live watch is best-effort; getCurrentPosition reports failures and callers keep their last fix.
      }
    })()
    return () => {
      cancelled = true
      subscription?.remove()
      subscription = null
    }
  },
}
