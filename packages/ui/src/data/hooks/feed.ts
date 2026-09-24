/**
 * Read hooks behind the home FeedBody (the compact-sheet home view): nearby/upcoming events and recent
 * in-app notifications. Both cache a FLAT list with `limit` in the key, because FeedBody only ever shows a
 * short preview. They are read-only; FeedBody navigates to the relevant detail instead of mutating.
 */
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { CleanupDTO, LatLng, NotificationDTO } from "@civfix/shared"
import { haversineMeters } from "@civfix/shared"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"

/**
 * Radius for the "events near you" LIST: only events within this many METERS of the viewer are shown.
 * 50 km keeps the list to a reasonable local commute while still surfacing events in neighboring towns.
 *
 * It is the DEFAULT of `useNearbyCleanups`, not a law: it was designed for the feed/sidebar "near you"
 * previews. A MAP marker layer wants the nearest N events at ANY distance (a rural viewer must still see
 * pins), so the map hosts pass `{ radiusM: null }` to opt out (see the option's doc below).
 */
export const NEARBY_RADIUS_M = 50_000

/**
 * Round a coordinate to ~1.1 km (2 decimals) so a jittery GPS fix - or a re-locate a few streets over -
 * reuses ONE `cleanupsNearby` cache entry instead of starting a fresh one (a fresh entry means another
 * /cleanups request, and one more permuted key kept in the 24 h persisted cache). A cell this coarse is
 * still an order of magnitude finer than the 50 km "near you" radius and barely moves the server's
 * distance ordering. The REQUEST still carries the exact `near`; only the key is quantized.
 */
function roundCoord(n: number): number {
  return Math.round(n * 100) / 100
}

export interface NearbyCleanupsOptions {
  /**
   * The client-side proximity cutoff (METERS) applied to a `near`-biased list, or `null` for NO cutoff
   * (the server's distance-ordered nearest-`limit`, uncapped). Defaults to `NEARBY_RADIUS_M` (50 km).
   *
   * Only the "events near you" LIST surfaces want a cutoff: an empty list there reads as "nothing is
   * happening near me", which is the intended message. A MAP marker layer must not silently drop pins:
   * the list is anchored to the VIEWER, not the viewport, so a filtered-out event can never be brought
   * back by panning. Both map hosts therefore render the uncapped list (`radiusM: null`), matching the web
   * map's unbiased `useCleanups("upcoming")`.
   *
   * Ignored without `near` (an unbiased list is never distance-filtered).
   */
  radiusM?: number | null
}

/**
 * Keep only the events within `radiusM` of `near`, preferring the server-computed `dist` (meters) and
 * falling back to a haversine from the viewer to the event's own lat/lng when an older server omitted it.
 * Pure + exported for the unit test (the package has no React renderer).
 */
export function filterCleanupsWithinRadius(
  items: readonly CleanupDTO[],
  near: LatLng,
  radiusM: number,
): CleanupDTO[] {
  return items.filter((c) => {
    const meters = c.dist ?? haversineMeters(near, { lat: c.lat, lng: c.lng })
    return meters <= radiusM
  })
}

/**
 * GET /cleanups?when=upcoming - upcoming events as a flat list. Auth-OPTIONAL so the home feed shows events
 * to signed-out visitors too.
 *
 * Pass `near` (the viewer's `LatLng`, e.g. from `useUserLocation`) to bias by proximity: it is sent as the
 * server `near` (distance-sort) and keyed on `queryKeys.cleanupsNearby` so it does not clobber the shared
 * global list. The proximity CUTOFF is a per-consumer view (`options.radiusM`, default `NEARBY_RADIUS_M`,
 * `null` = uncapped) applied in `select`, NOT in `queryFn`: the cache entry holds the raw server list, so
 * two surfaces asking for the same point with different radii can never overwrite each other's data.
 *
 * Omit `near` for the unbiased list: no bias, no filter, keyed on
 * `queryKeys.cleanups("upcoming", limit)`, the same entry `useCleanups("upcoming", limit)` reads for an
 * IDENTICAL limit (differing limits are deliberately distinct entries; see the note on the key factory).
 *
 * `placeholderData: (prev) => prev` keeps the PREVIOUS list on screen across a key change: the cache key
 * flips from the unbiased `cleanups(...)` to `cleanupsNearby(...)` the moment the location resolves (and
 * again whenever a re-locate crosses a rounded cell). Without it `data` is `undefined` until the new fetch
 * lands, which blanks every event marker on the map a few seconds into each cold launch.
 */
export function useNearbyCleanups(
  limit = 10,
  near?: LatLng | null,
  options?: NearbyCleanupsOptions,
) {
  const api = useApi()
  const bias = near ? { lat: roundCoord(near.lat), lng: roundCoord(near.lng) } : null
  const radiusM = options?.radiusM === undefined ? NEARBY_RADIUS_M : options.radiusM
  // Memoized on PRIMITIVES: react-query recomputes `select` (and hands consumers a fresh array identity)
  // whenever the select function's identity changes, and a new marker array re-runs the shared Map's
  // supercluster reconcile. `undefined` when there is nothing to filter, so the raw list passes through
  // with a stable identity.
  const biasLat = bias?.lat
  const biasLng = bias?.lng
  const select = useMemo(() => {
    if (biasLat === undefined || biasLng === undefined || radiusM === null) return undefined
    const center = { lat: biasLat, lng: biasLng }
    return (items: CleanupDTO[]) => filterCleanupsWithinRadius(items, center, radiusM)
  }, [biasLat, biasLng, radiusM])
  return useQuery<CleanupDTO[]>({
    // `limit` is part of BOTH keys: a sidebar preview (8), a search surface (10) and the events page's
    // own `useCleanups("upcoming", 50)` must not share one entry, or whichever refetched last
    // would overwrite it and silently truncate the other's list.
    queryKey: bias
      ? queryKeys.cleanupsNearby("upcoming", limit, bias.lat, bias.lng)
      : queryKeys.cleanups("upcoming", limit),
    // `.items ?? []` + filter: the un-validated client (client.ts returns `data as Res`) means a drifted
    // envelope or null entries could otherwise reach the bodies and crash a row. Coerce to a non-null array.
    queryFn: async () =>
      (
        (await api.listCleanups({ when: "upcoming", limit, ...(near ? { near } : {}) })).items ?? []
      ).filter((c): c is CleanupDTO => c != null),
    select,
    placeholderData: (prev) => prev,
  })
}

/**
 * GET /notifications - recent in-app notifications, as a flat list. Auth-REQUIRED, so it is gated on
 * `isAuthenticated` and never fires a guaranteed-401 while signed out. `limit` is part of the key so a
 * short feed preview and a fuller list keep separate cache entries.
 */
export function useFeedNotifications(limit = 20) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<NotificationDTO[]>({
    queryKey: queryKeys.notifications(limit),
    enabled: isAuthenticated,
    // Same non-null coercion as useNearbyCleanups (the client does not validate responses).
    queryFn: async () =>
      ((await api.listNotifications({ limit })).items ?? []).filter((n) => n != null),
  })
}
