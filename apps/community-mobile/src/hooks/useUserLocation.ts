import { useEffect, useMemo, useState, useCallback } from "react"
import * as Location from "expo-location"
import type { LatLng } from "@civfix/shared/geocode"
import { FIRST_FIX_TIMEOUT_MS, GPS_TIMEOUT_MS, LAST_KNOWN_MAX_AGE_MS, withTimeout } from "@/lib/withTimeout"

export type LocationPermission = "undetermined" | "granted" | "denied"

export interface LocationRefreshResult {
  coords: LatLng | null
  prompted: boolean
}

export interface UserLocationState {
  permission: LocationPermission
  permissionResolved: boolean
  coords: LatLng | null
  resolve: () => Promise<LocationRefreshResult>
  refresh: () => Promise<LocationRefreshResult>
  awaitFirstFix: () => Promise<LatLng | null>
}

export function useUserLocation(): UserLocationState {
  const [permission, setPermission] = useState<LocationPermission>("undetermined")
  const [permissionResolved, setPermissionResolved] = useState(false)
  const [coords, setCoords] = useState<LatLng | null>(null)

  const readFix = useCallback(async (timeoutMs: number = GPS_TIMEOUT_MS): Promise<LatLng | null> => {
    try {
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })) ??
        (await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          timeoutMs,
        ))
      if (!pos) return null
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setCoords(next)
      return next
    } catch {
      return null
    }
  }, [])

  const refresh = useCallback(async (): Promise<LocationRefreshResult> => {
    const before = await Location.getForegroundPermissionsAsync().catch(() => null)
    const { status } = await Location.requestForegroundPermissionsAsync()
    setPermissionResolved(true)
    if (status !== Location.PermissionStatus.GRANTED) {
      setPermission("denied")
      return { coords: null, prompted: false }
    }
    setPermission("granted")
    const prompted = before !== null && before.status !== Location.PermissionStatus.GRANTED
    return { coords: await readFix(), prompted }
  }, [readFix])

  const awaitFirstFix = useCallback(() => readFix(FIRST_FIX_TIMEOUT_MS), [readFix])

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
      awaitFirstFix,
    }),
    [permission, permissionResolved, coords, refresh, awaitFirstFix],
  )
}
