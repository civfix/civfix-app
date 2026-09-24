import { z } from "zod"
import { ReportCategorySchema } from "../common.js"
import { pageResponse } from "../common.js"
import { JurisdictionLayerSchema } from "../map.js"
import { AdminListQuerySchema, PrioritySchema } from "./common.js"
import { RoutingContactFields } from "./internal-fields.js"

/**
 * Discovery queue: pins landing where civfix has no routing contact yet. Saving contacts and routing
 * lives in jurisdictions.ts because it writes the jurisdiction contacts.
 */

/** A per-category waiting-report count map (category -> count of waiting reports for the GEOID). */
export const PerCategoryCountsSchema = z.record(
  ReportCategorySchema,
  z.number().int().nonnegative(),
)
export type PerCategoryCounts = z.infer<typeof PerCategoryCountsSchema>

/** An operator note left on a discovery task for the next operator ("@who - when" + text). */
export const DiscoveryNoteSchema = z
  .object({
    text: z.string(),
    who: z.string(),
    when: z.string(),
  })
  .strict()
export type DiscoveryNote = z.infer<typeof DiscoveryNoteSchema>

/** Which report categories are already routed vs still missing a contact for this jurisdiction. */
export const ContactStateSchema = z
  .object({
    routed: z.array(ReportCategorySchema),
    missing: z.array(ReportCategorySchema),
  })
  .strict()
export type ContactState = z.infer<typeof ContactStateSchema>

/** A sample report pin shown on the jurisdiction mini-map (category + position + needs-attention). */
export const DiscoverySamplePinSchema = z
  .object({
    category: ReportCategorySchema,
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    draft: z.boolean(),
  })
  .strict()
export type DiscoverySamplePin = z.infer<typeof DiscoverySamplePinSchema>

/**
 * A discovery queue row. `category` is the dominant waiting category (drives the leading pin);
 * `perCategoryCounts` is the full per-category breakdown. `reports` is the total waiting count. `pop`
 * is the jurisdiction population. `overSla` flags the 24h discovery SLA
 * breach. `notes` carries the operator-note history.
 */
export const DiscoveryTaskDTOSchema = z
  .object({
    id: z.string(),
    geoid: z.string(),
    place: z.string(),
    // The jurisdiction TYPE (city/county/state/federal land/tribal).
    layer: JurisdictionLayerSchema,
    category: ReportCategorySchema,
    catLabel: z.string(),
    pop: z.number().int().nonnegative(),
    reports: z.number().int().nonnegative(),
    perCategoryCounts: PerCategoryCountsSchema,
    lastReport: z.string(),
    age: z.string(),
    overSla: z.boolean(),
    priority: PrioritySchema,
    contactState: ContactStateSchema,
    notes: z.array(DiscoveryNoteSchema),
  })
  .strict()
export type DiscoveryTaskDTO = z.infer<typeof DiscoveryTaskDTOSchema>

/**
 * Discovery list query: search matches place or GEOID; `filter` is the attention facet
 * (all|attention|clear); `sort` is pop|reports (default pop).
 */
export const DiscoveryListQuerySchema = AdminListQuerySchema.extend({
  filter: z.enum(["all", "attention", "clear"]).optional(),
  sort: z.enum(["pop", "reports"]).optional(),
})
export type DiscoveryListQuery = z.infer<typeof DiscoveryListQuerySchema>

export const DiscoveryListResponseSchema = pageResponse(DiscoveryTaskDTOSchema)
export type DiscoveryListResponse = z.infer<typeof DiscoveryListResponseSchema>

/** An existing per-category routing contact for the jurisdiction (email per category). */
export const DiscoveryContactSchema = z
  .object({
    category: ReportCategorySchema,
    email: z.string().email().nullable(),
  })
  .strict()
export type DiscoveryContact = z.infer<typeof DiscoveryContactSchema>

/**
 * Discovery detail: the full task plus the existing per-category contacts, the place geometry
 * (GeoJSON, kept loose), and sample report pins for the mini-map.
 */
export const DiscoveryTaskDetailDTOSchema = DiscoveryTaskDTOSchema.extend({
  contacts: z.array(DiscoveryContactSchema),
  // The jurisdiction place geometry as GeoJSON; kept loose (validated server-side) so the contract
  // does not pin a GeoJSON shape. Nullable when no geometry is on file (a text label is shown).
  placeGeojson: z.unknown().nullable(),
  samplePins: z.array(DiscoverySamplePinSchema),
  // The mini-map center ([lat, lng]) and zoom.
  center: z.tuple([z.number(), z.number()]).nullable(),
  zoom: z.number().nullable(),
}).strict()
export type DiscoveryTaskDetailDTO = z.infer<typeof DiscoveryTaskDetailDTOSchema>

export const GetDiscoveryTaskResponseSchema = DiscoveryTaskDetailDTOSchema
export type GetDiscoveryTaskResponse = z.infer<typeof GetDiscoveryTaskResponseSchema>

/**
 * Append an operator note to a discovery task. `id` fills the :id path param (the client reads it from
 * the body and the server reads it from the path).
 */
export const AddNoteRequestSchema = z
  .object({
    id: z.string(),
    text: z.string().min(1).max(2000),
  })
  .strict()
export type AddNoteRequest = z.infer<typeof AddNoteRequestSchema>

/** Flag a discovery task / jurisdiction for review. */
export const FlagDiscoveryRequestSchema = z
  .object({
    id: z.string(),
    reason: z.string().max(500).optional(),
  })
  .strict()
export type FlagDiscoveryRequest = z.infer<typeof FlagDiscoveryRequestSchema>

/** Save the routing-contact draft; the same fields as SaveContactsRequest, but nothing is routed. */
export const SaveDraftRequestSchema = z
  .object({
    id: z.string(),
    ...RoutingContactFields,
  })
  .strict()
export type SaveDraftRequest = z.infer<typeof SaveDraftRequestSchema>
