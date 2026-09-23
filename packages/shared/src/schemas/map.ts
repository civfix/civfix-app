import { z } from "zod"
import { IdSchema, ISODateSchema, BBoxSchema, LatLngFields, LatLngSchema } from "./common.js"
import { AddressPrecisionSchema, EventKindSchema } from "./entities.js"

export const TileInfoResponseSchema = z.object({
  pmtilesUrl: z.string(),
  // Optional fallbacks to pmtiles: a raster XYZ tile template or a full style JSON URL.
  rasterUrl: z.string().nullable().optional(),
  styleUrl: z.string().nullable().optional(),
  attribution: z.string(),
  minZoom: z.number(),
  maxZoom: z.number(),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
})
export type TileInfoResponse = z.infer<typeof TileInfoResponseSchema>

export const ResolveJurisdictionRequestSchema = LatLngSchema
export type ResolveJurisdictionRequest = z.infer<typeof ResolveJurisdictionRequestSchema>

export const JurisdictionLayerSchema = z.enum(["place", "county", "state", "federal", "tribal"])
export type JurisdictionLayer = z.infer<typeof JurisdictionLayerSchema>

export const JurisdictionDTOSchema = z.object({
  geoid: z.string(),
  name: z.string(),
  layer: JurisdictionLayerSchema,
  cityStateLabel: z.string(),
  // The {JURCODE} segment of a report/event reference code; absent means unallocated.
  code: z.number().int().optional(),
  /**
   * Whether civfix has a routing contact on file for this jurisdiction. When false the report flow
   * shows the manual-review state with a suggest-a-contact box. The contact address itself is never
   * exposed publicly.
   */
  routable: z.boolean(),
})
export type JurisdictionDTO = z.infer<typeof JurisdictionDTOSchema>

export const ReverseLabelRequestSchema = LatLngSchema
export type ReverseLabelRequest = z.infer<typeof ReverseLabelRequestSchema>

export const ReverseLabelResponseSchema = z.object({
  cityStateLabel: z.string(),
})
export type ReverseLabelResponse = z.infer<typeof ReverseLabelResponseSchema>

export const ResolveAddressRequestSchema = LatLngSchema
export type ResolveAddressRequest = z.infer<typeof ResolveAddressRequestSchema>

export const ResolveAddressResponseSchema = z.object({
  address: z.string().nullable(),
  precision: AddressPrecisionSchema.nullable(),
  cityStateLabel: z.string(),
})
export type ResolveAddressResponse = z.infer<typeof ResolveAddressResponseSchema>

/**
 * Forward address autocomplete (POST /map/suggest). The server proxies the active geocoder provider
 * so no provider key is ever shipped to the client. `proximity` (plus optional `proximityZoom`)
 * biases results toward the user's current map view. Mirrors @civfix/shared/geocode SuggestOptions.
 */
export const SuggestPlacesRequestSchema = z
  .object({
    q: z.string().min(1),
    proximity: LatLngSchema.optional(),
    proximityZoom: z.number().optional(),
    limit: z.number().int().positive().max(20).optional(),
    /**
     * Preferred label language (the caller's app locale). Optional so older clients keep working. The
     * server defaults to "en" and, for Photon, falls back to English for any language it does not serve.
     */
    language: z.string().min(2).max(10).optional(),
  })
  .strict()
export type SuggestPlacesRequest = z.infer<typeof SuggestPlacesRequestSchema>

/**
 * One forward-geocode suggestion, structurally matching @civfix/shared/geocode `GeoSuggestion` (a plain
 * TS type, so the wire contract needs its own schema). `source` drives the Mapbox attribution in the UI.
 */
export const GeoSuggestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  secondary: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  source: z.enum(["coordinate", "curated", "photon", "mapbox"]),
})
export type GeoSuggestionDTO = z.infer<typeof GeoSuggestionSchema>

export const SuggestPlacesResponseSchema = z.object({
  suggestions: z.array(GeoSuggestionSchema),
})
export type SuggestPlacesResponse = z.infer<typeof SuggestPlacesResponseSchema>

/**
 * Public "suggest a routing contact" for an unmapped jurisdiction. Stored for operator review in the
 * discovery queue; it never auto-routes. `geoid` fills the path param (the client reads it from this
 * object; the server reads it from the path).
 */
export const SuggestContactRequestSchema = z
  .object({
    geoid: z.string().min(1),
    email: z.string().email().optional(),
    formUrl: z.string().url().optional(),
    note: z.string().max(2000).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.email) || Boolean(v.formUrl), {
    message: "Provide a contact email or a reporting-form URL.",
    path: ["email"],
  })
export type SuggestContactRequest = z.infer<typeof SuggestContactRequestSchema>

export const SuggestContactResponseSchema = z.object({ ok: z.literal(true) })
export type SuggestContactResponse = z.infer<typeof SuggestContactResponseSchema>

/** A lightweight cleanup pin for the map view; the full CleanupDTO lives in entities.ts. */
export const CleanupPinDTOSchema = z.object({
  id: IdSchema,
  ...LatLngFields,
  scheduledAt: ISODateSchema,
  going: z.number().int().nonnegative(),
  // Lets the map branch the marker. Defaults to "cleanup" so an older server still parses.
  eventKind: EventKindSchema.default("cleanup"),
})
export type CleanupPinDTO = z.infer<typeof CleanupPinDTOSchema>

export const ListCleanupsInBBoxRequestSchema = z
  .object({
    bbox: BBoxSchema,
    when: z.enum(["upcoming", "past"]).optional(),
  })
  .strict()
export type ListCleanupsInBBoxRequest = z.infer<typeof ListCleanupsInBBoxRequestSchema>

export const MapCleanupsResponseSchema = z.object({
  pins: z.array(CleanupPinDTOSchema),
})
export type MapCleanupsResponse = z.infer<typeof MapCleanupsResponseSchema>
