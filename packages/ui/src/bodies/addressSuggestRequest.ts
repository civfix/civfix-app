/**
 * The POST /map/suggest request body AddressSearch puts on the wire, split out of the component so the
 * wire contract unit-tests without mounting the field (which pulls the map + geocoder in).
 *
 * DELIBERATELY NO `language` KEY (2026-07-25). `SuggestPlacesRequestSchema` is `.strict()`, and the
 * DEPLOYED backend still runs a published @civfix/shared whose copy of that schema has no `language`
 * field — an unknown key there is a zod `unrecognized_keys` error, which the route's parse helper turns
 * into a 422. AddressSearch swallows the failure into an empty dropdown, so sending `language` before
 * the server accepts it kills address autocomplete outright (only "lat, lng" paste survives), and the
 * skew is the DEFAULT rollout order here: @civfix/ui + @civfix/shared publish from CI while backend
 * deploys are manual on-box, and a shipped mobile build can never be re-sequenced per user.
 *
 * The schema field and the geocode plumbing (SuggestOptions.language -> photonLang / mapbox `language`)
 * stay in place — they are backward-compatible and inert until the backend both upgrades @civfix/shared
 * AND forwards the field from its map route (today it destructures only q/proximity/proximityZoom/limit).
 * Re-enable by threading the app locale in here, in the SAME release train as that backend deploy.
 */
import type { SuggestPlacesRequest } from "@civfix/shared"

/** The Photon location-bias options AddressSearch derives from the map view (or the device/IP fix). */
export interface AddressSuggestBias {
  proximity?: { lat: number; lng: number } | null
  proximityZoom?: number
}

/** How many suggestions one keystroke asks for (the dropdown shows them all). */
export const ADDRESS_SUGGEST_LIMIT = 6

/** The request body for one autocomplete keystroke: the trimmed query, the cap, and the bias (if any). */
export function buildSuggestRequest(query: string, bias: AddressSuggestBias = {}): SuggestPlacesRequest {
  return {
    q: query,
    limit: ADDRESS_SUGGEST_LIMIT,
    ...(bias.proximity ? { proximity: bias.proximity } : {}),
    ...(bias.proximityZoom != null ? { proximityZoom: bias.proximityZoom } : {}),
  }
}
