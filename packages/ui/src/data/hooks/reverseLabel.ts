/**
 * `useReverseLabel` - reverse-geocode a {lat,lng} to a human-readable label for the report/location-pick
 * UI. Wraps the SHARED `api.reverseLabel({lat,lng})` (POST /map/reverse-label) in a
 * React Query so a placed pin shows its ADDRESS (the geocoder's `cityStateLabel`, which is the most precise
 * label the server can resolve) instead of just bare coordinates.
 *
 *   - Gated on a present point (`enabled`), keyed on the rounded coordinate so a tiny pin fine-tune reuses
 *     one cache entry (mirrors useResolveJurisdiction's rounding idiom).
 *   - The server replies 200 with an EMPTY `cityStateLabel` when the geocoder cannot place the point, so the
 *     queryFn TRIMS + nulls a blank label rather than surfacing whitespace (matches the mobile
 *     `reverseLabel` helper). Only a not-found resolves to `null`; a network / 429 / 5xx failure rejects so
 *     it is never cached as a 5-minute-fresh "no address". Callers read `data` through `reverseLabelText`,
 *     which renders `undefined` (pending or errored) and `null` alike as the coordinates.
 *
 * The exported `reverseLabelText(label, point)` helper shows the ADDRESS when one resolves, else falls
 * back to the exact coordinates `lat.toFixed(5), lng.toFixed(5)`. Pure (no
 * hooks) so it is unit-testable and reusable by both the report step and the map-pick step.
 *
 * Framework-light: reaches the host API client through the injected data context (useApi); no expo / next /
 * maplibre import.
 */
import { useQuery } from "@tanstack/react-query"
import type { ApiClient } from "@civfix/shared/client"
import { useApi } from "../context"
import { queryKeys } from "../keys"
import { GEOCODE_STALE_MS, isAddressNotFound } from "./resolveAddress"

/** A simple lat/lng the reverse-label query reads. */
export interface ReverseLabelPoint {
  lat: number
  lng: number
}

/** Round a coordinate for the query key so a sub-100m pin fine-tune reuses one cache entry (~5 decimals). */
function roundLabelCoord(n: number): number {
  return Math.round(n * 100000) / 100000
}

/** The exact-coordinate fallback string (5 decimals) shown when no address resolves. */
export function coordsLabel(point: ReverseLabelPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
}

/**
 * Fold the resolved reverse-label + the point into ONE display string (sub-4 decision): the ADDRESS when the
 * geocoder resolved one, otherwise the exact coordinates. `label` is the query's `data`
 * (`string | null | undefined`): a non-empty string is the address; `null` (no coverage) / `undefined` (still
 * loading) fall back to coords so the UI never shows a blank.
 */
export function reverseLabelText(label: string | null | undefined, point: ReverseLabelPoint | null): string {
  if (label && label.trim().length > 0) return label.trim()
  return point ? coordsLabel(point) : ""
}

/** The geocoder's trimmed label for a point, `null` when it cannot be placed; rethrows any other failure. */
export async function fetchReverseLabel(
  api: Pick<ApiClient, "reverseLabel">,
  point: ReverseLabelPoint,
): Promise<string | null> {
  try {
    const res = await api.reverseLabel({ lat: point.lat, lng: point.lng })
    const label = res?.cityStateLabel?.trim() ?? ""
    return label.length > 0 ? label : null
  } catch (err) {
    if (isAddressNotFound(err)) return null
    throw err
  }
}

/**
 * POST /map/reverse-label for a point -> the geocoder's label (trimmed; `null` when the point cannot be
 * placed; an error state on a transient failure). Gated on a present point; retries off so the label paints promptly. Read
 * `data` (`string | null | undefined`) with {@link reverseLabelText} to render the address-or-coords string.
 */
export function useReverseLabel(point: ReverseLabelPoint | null) {
  const api = useApi()
  const lat = point ? roundLabelCoord(point.lat) : 0
  const lng = point ? roundLabelCoord(point.lng) : 0
  return useQuery<string | null>({
    queryKey: queryKeys.reverseLabel(point ? lat : null, point ? lng : null),
    enabled: point !== null,
    queryFn: () => fetchReverseLabel(api, point!),
    retry: false,
    staleTime: GEOCODE_STALE_MS,
  })
}
