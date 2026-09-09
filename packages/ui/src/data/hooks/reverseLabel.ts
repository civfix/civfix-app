/**
 * `useReverseLabel` - reverse-geocode a {lat,lng} to a human-readable label for the report/location-pick
 * UI (issue #61 sub-task 4). Wraps the SHARED `api.reverseLabel({lat,lng})` (POST /map/reverse-label) in a
 * React Query so a placed pin shows its ADDRESS (the geocoder's `cityStateLabel`, which is the most precise
 * label the server can resolve) instead of just bare coordinates.
 *
 *   - Gated on a present point (`enabled`), keyed on the rounded coordinate so a tiny pin fine-tune reuses
 *     one cache entry (mirrors useResolveJurisdiction's rounding idiom).
 *   - The server replies 200 with an EMPTY `cityStateLabel` when the geocoder cannot place the point, so the
 *     queryFn TRIMS + nulls a blank label rather than surfacing whitespace (matches the mobile
 *     `reverseLabel` helper). Errors resolve to `null` (no address) rather than throwing, so a caller cleanly
 *     distinguishes "still resolving" (`isPending`) from "no address" (`data === null`).
 *
 * The exported `reverseLabelText(label, point)` helper folds the user decision (sub-4): show the ADDRESS
 * when one resolves, else fall back to the exact coordinates `lat.toFixed(5), lng.toFixed(5)`. Pure (no
 * hooks) so it is unit-testable and reusable by both the report step and the map-pick step.
 *
 * Framework-light: reaches the host API client through the injected data context (useApi); no expo / next /
 * maplibre import. Does NOT edit @civfix/shared (reuses the existing reverseLabel endpoint).
 */
import { useQuery } from "@tanstack/react-query"
import { useApi } from "../context"

/** A simple lat/lng the reverse-label query reads. */
export interface ReverseLabelPoint {
  lat: number
  lng: number
}

/** Round a coordinate for the query key so a sub-100m pin fine-tune reuses one cache entry (~5 decimals). */
function roundLabelCoord(n: number): number {
  return Math.round(n * 100000) / 100000
}

/** The exact-coordinate fallback string (sub-4: 5 decimals) shown when no address resolves. */
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

/**
 * POST /map/reverse-label for a point -> the geocoder's label (trimmed; `null` when the point cannot be
 * placed or the request errors). Gated on a present point; retries off so the label paints promptly. Read
 * `data` (`string | null | undefined`) with {@link reverseLabelText} to render the address-or-coords string.
 */
export function useReverseLabel(point: ReverseLabelPoint | null) {
  const api = useApi()
  const lat = point ? roundLabelCoord(point.lat) : 0
  const lng = point ? roundLabelCoord(point.lng) : 0
  return useQuery<string | null>({
    queryKey: ["reverse-label", point ? lat : null, point ? lng : null] as const,
    enabled: point !== null,
    queryFn: async () => {
      try {
        const res = await api.reverseLabel({ lat: point!.lat, lng: point!.lng })
        const label = res.cityStateLabel?.trim() ?? ""
        return label.length > 0 ? label : null
      } catch {
        // The geocoder errored / the point is unplaceable: treat as "no address" (coords fallback) not an error.
        return null
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}
