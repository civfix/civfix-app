import { useEffect, useMemo, useState, useCallback } from "react"
import * as Location from "expo-location"
import type { LatLng } from "@civfix/shared/geocode"
import { GPS_TIMEOUT_MS, LAST_KNOWN_MAX_AGE_MS, withTimeout } from "@/lib/withTimeout"

export type LocationPermission = "undetermined" | "granted" | "denied"

export interface UserLocationState {
  permission: LocationPermission
  permissionResolved: boolean
  coords: LatLng | null
  resolve: () => Promise<LatLng | null>
  refresh: () => Promise<LatLng | null>
}

export function useUserLocation(): UserLocationState {
  const [permission, setPermission] = useState<LocationPermission>("undetermined")
  const [permissionResolved, setPermissionResolved] = useState(false)
  const [coords, setCoords] = useState<LatLng | null>(null)

  const readFix = useCallback(async (): Promise<LatLng | null> => {
    try {
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })) ??
        (await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          GPS_TIMEOUT_MS,
        ))
      if (!pos) return null
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setCoords(next)
      return next
    } catch {
      return null
    }
  }, [])

  const refresh = useCallback(async (): Promise<LatLng | null> => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    setPermissionResolved(true)
    if (status !== Location.PermissionStatus.GRANTED) {
      setPermission("denied")
      return null
    }
    setPermission("granted")
    return readFix()
  }, [readFix])

  useEffect(() => {
    let active = true
    void (async () => {
      const current = await Location.getForegroundPermissionsAsync().catch(() => null)
      if (!active) return
      if (current?.status === Location.PermissionStatus.GRANTED) {
        setPermission("granted")
        void readFix()
      } else if (current?.status === Location.PermissionStatus.DENIED) {
        setPermission("denied")
      }
      setPermissionResolved(true)
    })()
    return () => {
      active = false
    }
  }, [readFix])

  return useMemo(
    () => ({
      permission,
      permissionResolved,
      coords,
      resolve: refresh,
      refresh,
    }),
    [permission, permissionResolved, coords, refresh],
  )
}
