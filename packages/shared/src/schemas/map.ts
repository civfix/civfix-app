import { z } from "zod"
import { IdSchema, ISODateSchema, BBoxSchema, LatLngFields, LatLngSchema } from "./common.js"
import { AddressPrecisionSchema, EventKindSchema } from "./entities.js"

/**
 * Map tile metadata and jurisdiction / reverse-geocode resolution.
 */

export const TileInfoResponseSchema = z.object({
  pmtilesUrl: z.string(),
  // Optional fallbacks to pmtiles: a raster XYZ tile template, or a full style JSON URL. A server may
  // hand either (or neither). Nullable + optional so existing clients that only read pmtilesUrl parse.
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
  // The incremental JURCODE (jurisdictions.code) used as the {JURCODE} segment of a report/event
  // reference code. Optional + additive so older servers/consumers still parse; absent => unallocated.
  code: z.number().int().optional(),
  /**
   * Whether civfix already has a routing contact on file for this jurisdiction (a per-category or
   * default jurisdiction_contacts row, or a legacy contact email). The public report flow shows
   * "routes to {name}" when true, vs a "new area, manual review" state (with a suggest-a-contact box)
   * when false. Derived server-side; the actual contact address is never exposed publicly.
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
 * (Mapbox when MAPBOX_TOKEN is set, else Photon) so no provider key is ever shipped to the client.
 * `proximity` (+ optional `proximityZoom`) biases results toward the user's current map view.
 * Mirrors the @civfix/shared/geocode SuggestOptions the server passes through.
 */
export const SuggestPlacesRequestSchema = z
  .object({
    q: z.string().min(1),
    proximity: LatLngSchema.optional(),
    proximityZoom: z.number().optional(),
    limit: z.number().int().positive().max(20).optional(),
    /**
     * Preferred label language (the caller's app locale, e.g. "es"). Optional so older clients keep
     * working; the server defaults to "en" and, for Photon, falls back to English for any language it
     * does not serve.
     */
    language: z.string().min(2).max(10).optional(),
  })
  .strict()
export type SuggestPlacesRequest = z.infer<typeof SuggestPlacesRequestSchema>

/**
 * One forward-geocode suggestion. Structurally matches the @civfix/shared/geocode `GeoSuggestion`
 * interface (which is a plain TS type, not barrel-exported, so the wire contract needs its own zod
 * schema). `source` records which provider produced it (drives the Mapbox attribution in the UI).
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
 * Public "suggest a routing contact" for an UNMAPPED jurisdiction (the report flow's manual-review
 * state). A reporter offers a contact email and/or a reporting-form URL (at least one required) plus
 * an optional note. Stored for operator review in the discovery queue; it NEVER auto-routes. `geoid`
 * fills the path param (the client reads it from this object; the server reads it from the path).
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

// ---------------------------------------------------------------------------
// Map cleanups (lightweight pins for the map view; the full CleanupDTO lives in entities.ts)
// ---------------------------------------------------------------------------

/** A lightweight cleanup pin for the map (id, position, schedule, RSVP count, event kind). */
export const CleanupPinDTOSchema = z.object({
  id: IdSchema,
  ...LatLngFields,
  scheduledAt: ISODateSchema,
  going: z.number().int().nonnegative(),
  // The event kind so the map can branch the marker (cleanup vs other_volunteer). Defaults to
  // "cleanup" so a server that does not yet supply it, and already-built consumers, still parse.
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
