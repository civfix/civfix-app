/**
 * `useUserLocation` - the viewer's one-shot BEST-KNOWN position, shared across the bodies that
 * proximity-bias their data (the home sidebar's "Events near you", Discovery's nearby reports, and the
 * jurisdiction its leaderboard names). It wraps the `useGeolocation()` platform capability in a React
 * Query so the fix is resolved AT MOST ONCE per session and DEDUPED across every consumer (one cache
 * entry, no repeated permission prompts).
 *
 *   - queryKey `queryKeys.userLocation` (`["user-location"]`), shared by all callers.
 *   - `staleTime`/`gcTime` Infinity + `retry: false`: the queryFn runs once, the result is reused forever
 *     for the session, and a rejection (denied/unavailable) is NOT retried (which would re-prompt).
 *   - The queryFn NEVER throws: unavailable / denied / no fix at all resolves to `null` (so the query
 *     lands in `success` with `data: null`), letting consumers cleanly distinguish "still resolving"
 *     (`isPending`) from "no location" (`data === null`) from "have location" (`data` is a `LatLng`).
 *
 * DEGRADATION ORDER (without a fallback past device GPS there is often no location at all, hence no
 * jurisdiction, and Discovery's leaderboard and nearby reports silently vanish for the whole session):
 *
 *   1. the injected device fix, capped at {@link DEVICE_FIX_TIMEOUT_MS}. The capability has no timeout of
 *      its own and a first fix can hang for many seconds (worst right after launch / indoors / on a
 *      simulator), and with `retry: false` + an infinite staleTime ONE slow fix would be permanent for
 *      the session. The cap is the same 4 s the mobile app's own location hook applies.
 *   2. `fetchApproximateLocation()` - the civfix API's own key-less, permissionless, city-accurate
 *      estimate (`GET /geo/approximate`), sharing one cache entry with `useApproximateLocation()` so the
 *      map and every picker resolve it once. The report wizard's picker centre runs this same
 *      {@link resolveUserLocation}, and AddressSearch's "use my location" follows the same order. Coarse:
 *      consumers should read it as "roughly which city", not "which street".
 *   3. whatever point is ALREADY cached under this key: a host that seeded it (the mobile map home
 *      publishes its own resolved point here) must not be overwritten with `null` by a resolve that
 *      merely lost a race.
 *   4. `null`.
 *
 * IT NEVER REQUESTS ANYTHING ITSELF. Every step above goes through the injected capability or a plain
 * network call, and this hook adds no permission prompt of its own: an eager
 * `requestForegroundPermissionsAsync` on a shared mount path blacks out the report camera.
 *
 * This lives apart from feed.ts (which is deliberately capability-free) because it depends on the platform
 * capability seam; feed.ts stays framework-light and just accepts the resolved `near` as a plain argument.
 */
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { DEVICE_FIX_TIMEOUT_MS, withTimeout, type LatLng } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import { useGeolocation, type GeolocationCapability } from "../../capabilities"
import { useApi } from "../context"
import { fetchApproximateLocation } from "../fetchApproximateLocation"
import { queryKeys } from "../keys"

/**
 * The viewer's best-known position as a shared `LatLng`, or `null` when nothing at all could be resolved.
 * Consumers read `data` (`LatLng | null | undefined`) and `isPending`:
 *   - `isPending` true                 -> still resolving (never flash a proximity section yet).
 *   - `data === null`                  -> denied/unavailable (hide proximity-only UI).
 *   - `data` is a `LatLng`             -> bias + filter by it. May be a city-accurate IP estimate.
 */
export function useUserLocation() {
  const geo = useGeolocation()
  const api = useApi()
  const qc = useQueryClient()
  return useQuery<LatLng | null>({
    queryKey: queryKeys.userLocation,
    // Resolve once and reuse forever this session; never retry a denial (would re-prompt).
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: () => resolveUserLocation(geo, api, qc),
  })
}

/** The queryFn behind {@link queryKeys.userLocation}, for every surface that fetches that entry itself. */
export async function resolveUserLocation(
  geo: GeolocationCapability,
  api: ApiClient,
  qc: QueryClient,
): Promise<LatLng | null> {
  // `withTimeout` swallows the rejection too, so a denial falls through to IP exactly like a hang.
  const fix = geo.isAvailable() ? await withTimeout(geo.getCurrentPosition(), DEVICE_FIX_TIMEOUT_MS) : null
  if (fix) return { lat: fix.latitude, lng: fix.longitude }
  const approximate = await fetchApproximateLocation(api, qc)
  if (approximate) return approximate
  // Never DOWNGRADE a point someone already put in this cache entry (see step 3 above).
  return qc.getQueryData<LatLng | null>(queryKeys.userLocation) ?? null
}
