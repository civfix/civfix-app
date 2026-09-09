import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import * as Location from "expo-location"
import { ipLocate, type LatLng } from "@civfix/shared/geocode"
import { GPS_TIMEOUT_MS, LAST_KNOWN_MAX_AGE_MS, withTimeout } from "@/lib/withTimeout"
import { mergeResolvedLocation, type ResolvedLocation } from "@/lib/locationRank"

export type LocationPermission = "undetermined" | "granted" | "denied"

export type { ResolvedLocation }

export interface UserLocationState {
  permission: LocationPermission
  permissionResolved: boolean
  coords: LatLng | null
  resolved: ResolvedLocation | null
  resolve: () => Promise<ResolvedLocation | null>
  resolveWithoutPrompt: () => Promise<ResolvedLocation | null>
  refresh: () => Promise<LatLng | null>
}

export function useUserLocation(): UserLocationState {
  const [permission, setPermission] = useState<LocationPermission>("undetermined")
  const [permissionResolved, setPermissionResolved] = useState(false)
  const [resolved, setResolved] = useState<ResolvedLocation | null>(null)
  const ipPromiseRef = useRef<Promise<LatLng | null> | null>(null)
  const bestRef = useRef<ResolvedLocation | null>(null)

  const adopt = useCallback((next: ResolvedLocation | null): ResolvedLocation | null => {
    const winner = mergeResolvedLocation(bestRef.current, next)
    bestRef.current = winner
    setResolved(winner)
    return winner
  }, [])

  const refresh = useCallback(async (): Promise<LatLng | null> => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    setPermissionResolved(true)
    if (status !== Location.PermissionStatus.GRANTED) {
      setPermission("denied")
      return null
    }
    setPermission("granted")
    try {
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })) ??
        (await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          GPS_TIMEOUT_MS,
        ))
      if (!pos) return null
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      adopt({ ...next, precise: true })
      return next
    } catch {
      return null
    }
  }, [adopt])

  const resolveIp = useCallback(async (): Promise<ResolvedLocation | null> => {
    if (!ipPromiseRef.current) {
      ipPromiseRef.current = ipLocate().then((p) => {
        if (!p) ipPromiseRef.current = null
        return p
      })
    }
    const ip = await ipPromiseRef.current
    return adopt(ip ? { ...ip, precise: false } : null)
  }, [adopt])

  const resolve = useCallback(async (): Promise<ResolvedLocation | null> => {
    const gps = await refresh()
    if (gps) return { ...gps, precise: true }
    return resolveIp()
  }, [refresh, resolveIp])

  useEffect(() => {
    let active = true
    void (async () => {
      const current = await Location.getForegroundPermissionsAsync().catch(() => null)
      if (!active) return
      if (current?.status === Location.PermissionStatus.GRANTED) {
        setPermission("granted")
        void refresh()
      } else if (current?.status === Location.PermissionStatus.DENIED) {
        setPermission("denied")
      }
      setPermissionResolved(true)
    })()
    return () => {
      active = false
    }
  }, [refresh])

  const coords = useMemo<LatLng | null>(
    () => (resolved ? { lat: resolved.lat, lng: resolved.lng } : null),
    [resolved],
  )

  return useMemo(
    () => ({
      permission,
      permissionResolved,
      coords,
      resolved,
      resolve,
      resolveWithoutPrompt: resolveIp,
      refresh,
    }),
    [permission, permissionResolved, coords, resolved, resolve, resolveIp, refresh],
  )
}
