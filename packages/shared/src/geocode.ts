/**
 * Unified forward geocoding for the location pickers (web + mobile): turn what a user types into
 * coordinates, with a live, proximity-biased suggestion list.
 *
 * Two sources, composed by suggestAddresses():
 *   1. parseLatLng    - a raw "lat, lng" pair. Pure + offline, so pasting coordinates always works.
 *   2. a live provider - mapboxSuggest (Geocoding v6) when a token is supplied, else photonSuggest
 *      (OpenStreetMap's Photon), both biased to a proximity point. Photon (unlike Nominatim, whose
 *      policy forbids it) is built for per-keystroke typeahead, and is OSM-based like the CARTO
 *      basemap the maps already use.
 *
 * Platform-agnostic: only global fetch + math. Each app supplies the proximity point from its own
 * geolocation API (browser navigator.geolocation / expo-location) with the civfix API's approximate
 * location as the fallback. Everything degrades gracefully - offline you still get pasted coordinates.
 */
import type { LatLngLike } from "./geo.js"

export type LatLng = LatLngLike

/**
 * Nothing here produces "curated"; it stays in the union to match the wire enum in `GeoSuggestionSchema`,
 * which a deployed server may still emit.
 */
export type SuggestionSource = "coordinate" | "curated" | "photon" | "mapbox"

export interface GeoSuggestion {
  /** Stable-ish list key (source + identity). */
  id: string
  /** Primary line: place / road name, or the raw coordinate. */
  label: string
  /** Secondary line: city, region, country (when known). */
  secondary?: string
  lat: number
  lng: number
  source: SuggestionSource
}

/** Any forward-geocoding suggestion provider. photonSuggest + mapboxSuggest both conform. */
export type SuggestProvider = (query: string, opts?: SuggestOptions) => Promise<GeoSuggestion[]>

export interface SuggestOptions {
  /** Bias point for ranking/Photon (favor geographically close results). */
  proximity?: LatLng | null
  /**
   * Photon `zoom`: the radius around `proximity` to concentrate on, "roughly the map zoom" (Photon's
   * default is 12). Pass the live map zoom so a zoomed-in view focuses tightly and a zoomed-out view
   * stays broad. Ignored unless `proximity` is set.
   */
  proximityZoom?: number
  /**
   * Photon `location_bias_scale` (0..1, Photon default 0.4): how much a result's own prominence still
   * counts versus its closeness to `proximity`. Higher → closeness wins harder (a nearby match outranks
   * a famous far-away namesake). Ignored unless `proximity` is set.
   */
  locationBiasScale?: number
  signal?: AbortSignal
  /** Max suggestions to return (default 5). */
  limit?: number
  /** When set, suggestAddresses uses Mapbox (Geocoding v6) as the primary provider, Photon as fallback. */
  mapboxToken?: string
  /**
   * Language for the suggestion labels (an app locale like "es" / "de" / "ko"), default "en". Mapbox
   * takes it as-is; Photon only ships a handful of languages, so anything it does not support falls
   * back to "en" rather than erroring the request.
   */
  language?: string
  /**
   * ISO-3166-1 alpha-2 country filter for the Mapbox path, default "us". Pass `null` for worldwide
   * results. Ignored by Photon (which has no equivalent filter).
   */
  country?: string | null
}

/** Languages Photon actually serves; anything else is requested as English. */
const PHOTON_LANGS = new Set(["de", "en", "fr", "it"])

/** The `lang` value to send to Photon for a caller-supplied app locale ("es-MX" -> "es" -> "en"). */
function photonLang(language?: string): string {
  const base = (language ?? "en").toLowerCase().split("-")[0] ?? "en"
  return PHOTON_LANGS.has(base) ? base : "en"
}

/** A single signed decimal with at most 3 integer digits (enough for any lat/lng). */
const DECIMAL = /^-?\d{1,3}(?:\.\d+)?$/

/**
 * Parse a raw "lat, lng" (comma- or whitespace-separated) string into a coordinate. Returns null when
 * the input is not exactly two in-range decimals, so callers can fall back to address geocoding. Order
 * is lat-then-lng (the Google Maps convention users paste).
 */
export function parseLatLng(input: string): LatLng | null {
  const raw = input.trim()
  if (!raw) return null
  const parts = raw.includes(",") ? raw.split(",") : raw.split(/\s+/)
  if (parts.length !== 2) return null
  const a = parts[0]?.trim() ?? ""
  const b = parts[1]?.trim() ?? ""
  // Reject empties / non-numerics up front: Number("") is 0, which would otherwise sneak through.
  if (!DECIMAL.test(a) || !DECIMAL.test(b)) return null
  const lat = Number(a)
  const lng = Number(b)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function coordSuggestion(coord: LatLng): GeoSuggestion {
  return {
    id: `coordinate:${coord.lat},${coord.lng}`,
    label: `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`,
    secondary: "Exact coordinates",
    lat: coord.lat,
    lng: coord.lng,
    source: "coordinate",
  }
}

const PHOTON_URL = "https://photon.komoot.io/api/"

interface PhotonProperties {
  name?: string
  housenumber?: string
  street?: string
  city?: string
  district?: string
  state?: string
  country?: string
  osm_id?: number | string
  osm_type?: string
}
interface PhotonFeature {
  geometry?: { coordinates?: [number, number] } // [lon, lat]
  properties?: PhotonProperties
}

function photonLabel(p: PhotonProperties): string {
  if (p.name) return p.name
  const street = [p.housenumber, p.street].filter(Boolean).join(" ")
  return street || p.city || p.state || "Unknown place"
}
function photonSecondary(p: PhotonProperties, label: string): string | undefined {
  const parts = [p.city, p.state, p.country].filter((v): v is string => !!v && v !== label)
  return parts.length ? parts.join(", ") : undefined
}

/**
 * Live address/place autocomplete via Photon. Throws on network/HTTP failure so `suggestAddresses` can
 * degrade. Pass `proximity` to bias results toward a point.
 */
export async function photonSuggest(query: string, opts: SuggestOptions = {}): Promise<GeoSuggestion[]> {
  const q = query.trim()
  if (!q) return []
  const url = new URL(PHOTON_URL)
  url.searchParams.set("q", q)
  url.searchParams.set("limit", String(opts.limit ?? 5))
  url.searchParams.set("lang", photonLang(opts.language))
  if (opts.proximity) {
    url.searchParams.set("lat", String(opts.proximity.lat))
    url.searchParams.set("lon", String(opts.proximity.lng))
    // zoom + location_bias_scale only steer the lat/lon focus, so they ride along only when one is set.
    if (opts.proximityZoom != null) url.searchParams.set("zoom", String(opts.proximityZoom))
    if (opts.locationBiasScale != null) {
      url.searchParams.set("location_bias_scale", String(opts.locationBiasScale))
    }
  }
  const res = await fetch(url.toString(), { signal: opts.signal, headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`Photon request failed: ${res.status}`)
  const data = (await res.json()) as { features?: PhotonFeature[] }
  const features = Array.isArray(data.features) ? data.features : []
  const out: GeoSuggestion[] = []
  for (const f of features) {
    const coords = f.geometry?.coordinates
    if (!coords || coords.length < 2) continue
    const [lng, lat] = coords
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const props = f.properties ?? {}
    const label = photonLabel(props)
    out.push({
      id: `photon:${props.osm_type ?? ""}${props.osm_id ?? `${lat},${lng}`}`,
      label,
      secondary: photonSecondary(props, label),
      lat,
      lng,
      source: "photon",
    })
  }
  return out
}

const MAPBOX_FORWARD_URL = "https://api.mapbox.com/search/geocode/v6/forward"

interface MapboxV6Context {
  address?: { name?: string }
  street?: { name?: string }
  neighborhood?: { name?: string }
  place?: { name?: string }
  region?: { name?: string; region_code?: string }
  postcode?: { name?: string }
  country?: { name?: string; country_code?: string }
}
interface MapboxV6Properties {
  name?: string
  place_formatted?: string
  full_address?: string
  feature_type?: string
  context?: MapboxV6Context
}
interface MapboxV6Feature {
  geometry?: { coordinates?: [number, number] } // [lon, lat]
  properties?: MapboxV6Properties
}

function mapboxLabel(p: MapboxV6Properties): string {
  return p.name || p.full_address || p.place_formatted || "Unknown place"
}
function mapboxSecondary(p: MapboxV6Properties, label: string): string | undefined {
  if (p.place_formatted && p.place_formatted !== label) return p.place_formatted
  const ctx = p.context ?? {}
  const region = ctx.region?.region_code ?? ctx.region?.name
  const parts = [ctx.place?.name, region].filter((v): v is string => !!v && v !== label)
  return parts.length ? parts.join(", ") : undefined
}

/**
 * Live address autocomplete via Mapbox Geocoding v6. Requires opts.mapboxToken (throws if missing).
 * Throws on network/HTTP failure so suggestAddresses can fall back to Photon.
 */
export async function mapboxSuggest(query: string, opts: SuggestOptions = {}): Promise<GeoSuggestion[]> {
  const q = query.trim()
  if (!q) return []
  const token = opts.mapboxToken
  if (!token) throw new Error("mapboxSuggest: missing mapboxToken")
  const url = new URL(MAPBOX_FORWARD_URL)
  url.searchParams.set("q", q)
  url.searchParams.set("access_token", token)
  url.searchParams.set("autocomplete", "true")
  url.searchParams.set("limit", String(opts.limit ?? 5))
  url.searchParams.set("language", opts.language ?? "en")
  // `country: null` opts out of the filter entirely (worldwide results); undefined keeps the US default.
  const country = opts.country === undefined ? "us" : opts.country
  if (country) url.searchParams.set("country", country)
  url.searchParams.set("types", "address,street,place,locality,neighborhood,postcode")
  if (opts.proximity) {
    url.searchParams.set("proximity", `${opts.proximity.lng},${opts.proximity.lat}`)
  }
  const res = await fetch(url.toString(), { signal: opts.signal, headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`Mapbox request failed: ${res.status}`)
  const data = (await res.json()) as { features?: MapboxV6Feature[] }
  const features = Array.isArray(data.features) ? data.features : []
  const out: GeoSuggestion[] = []
  for (const f of features) {
    const coords = f.geometry?.coordinates
    if (!coords || coords.length < 2) continue
    const [lng, lat] = coords
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const props = f.properties ?? {}
    const label = mapboxLabel(props)
    out.push({
      id: `mapbox:${label}:${lat.toFixed(5)},${lng.toFixed(5)}`,
      label,
      secondary: mapboxSecondary(props, label),
      lat,
      lng,
      source: "mapbox",
    })
  }
  return out
}

/**
 * True when a provider rejection is the caller's own abort rather than a real failure. Checks the
 * signal first (RN/browser/Node all surface a differently-shaped error object) and the DOMException
 * name as a fallback for callers that abort a signal we were not given.
 */
function isAbort(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true
  return typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError"
}

/**
 * Address autocomplete: a pasted coordinate short-circuits; then Mapbox when `opts.mapboxToken` is set
 * (falling back to Photon when Mapbox throws OR returns nothing); else Photon. Provider errors degrade
 * to [], but an abort rejects.
 */
export async function suggestAddresses(query: string, opts: SuggestOptions = {}): Promise<GeoSuggestion[]> {
  const q = query.trim()
  if (!q) return []

  const coord = parseLatLng(q)
  if (coord) return [coordSuggestion(coord)]

  if (opts.mapboxToken) {
    try {
      const hits = await mapboxSuggest(q, opts)
      if (hits.length > 0) return hits
    } catch (err) {
      // An abort is the caller cancelling a stale keystroke: reject so the old request cannot resolve []
      // over the newer one's suggestions, and skip a Photon request nobody is waiting on.
      if (isAbort(err, opts.signal)) throw err
      // Mapbox unavailable → fall through to Photon.
    }
  }
  try {
    return await photonSuggest(q, opts)
  } catch (err) {
    if (isAbort(err, opts.signal)) throw err
    return []
  }
}

const GEOJS_URL = "https://get.geojs.io/v1/ip/geo.json"

/**
 * Best-effort IP geolocation (no permission prompt) via GeoJS - a free, CORS-enabled, key-less HTTPS
 * endpoint. Returns null on any failure so callers can fall back to a map center. Used as the proximity
 * source when device location sharing is denied or unavailable.
 *
 * @deprecated since 0.47.0. A third-party data flow with no consumer-plane callers left. Use
 * `GET /geo/approximate` (`getApproximateLocation`, DECISIONS #45).
 */
export async function ipLocate(signal?: AbortSignal): Promise<LatLng | null> {
  try {
    const res = await fetch(GEOJS_URL, { signal, headers: { Accept: "application/json" } })
    if (!res.ok) return null
    const data = (await res.json()) as { latitude?: string | number; longitude?: string | number }
    const lat = Number(data.latitude)
    const lng = Number(data.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
    return { lat, lng }
  } catch {
    return null
  }
}
