/**
 * Deliberately no `language` key: `SuggestPlacesRequestSchema` is `.strict()`, so a backend running an older
 * contract answers 422 and AddressSearch shows an empty dropdown. Send the locale only once every deployed
 * backend accepts and forwards the field.
 */
import type { SuggestPlacesRequest } from "@civfix/shared"

/** The Photon location-bias options AddressSearch derives from the map view (or the device/IP fix). */
export interface AddressSuggestBias {
  proximity?: { lat: number; lng: number } | null
  proximityZoom?: number
}

/** How many suggestions one keystroke asks for (the dropdown shows them all). */
export const ADDRESS_SUGGEST_LIMIT = 6

export function buildSuggestRequest(query: string, bias: AddressSuggestBias = {}): SuggestPlacesRequest {
  return {
    q: query,
    limit: ADDRESS_SUGGEST_LIMIT,
    ...(bias.proximity ? { proximity: bias.proximity } : {}),
    ...(bias.proximityZoom != null ? { proximityZoom: bias.proximityZoom } : {}),
  }
}

export type AddressSearchStatus = "closed" | "results" | "empty" | "failed"

/** Which dropdown the field shows: a failed request is not the same answer as "no matches". */
export function addressSearchStatus(input: {
  open: boolean
  loading: boolean
  failed: boolean
  resultCount: number
  query: string
}): AddressSearchStatus {
  if (!input.open) return "closed"
  if (input.resultCount > 0) return "results"
  if (input.loading || input.query.trim().length === 0) return "closed"
  return input.failed ? "failed" : "empty"
}
