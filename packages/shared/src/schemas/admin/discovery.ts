import { z } from "zod"
import { ReportCategorySchema } from "../common.js"
import { pageResponse } from "../common.js"
import { JurisdictionLayerSchema } from "../map.js"
import { AdminListQuerySchema, PrioritySchema } from "./common.js"

/**
 * Discovery / "Jurisdictions" queue: pins landing where civfix has no routing contact yet. The
 * operator researches the jurisdiction (by GEOID), saves a per-category routing contact, and reports
 * start flowing. List (population-sorted), detail, add-note, flag, and save-draft. The "Save & route"
 * action lives in jurisdictions.ts (it writes the jurisdiction contacts). See enumeration 2.B.
 */

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

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

/**
 * Which report categories are already routed vs still missing a contact for this jurisdiction. Drives
 * the "needs contact / routed" pills and the per-type attention flags in the routing-contacts grid.
 */
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

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * A discovery queue row. `category` is the dominant waiting category (drives the leading pin);
 * `perCategoryCounts` is the full per-category breakdown. `reports` is the total waiting count. `pop`
 * is the jurisdiction population (TIGER provenance is cosmetic). `overSla` flags the 24h discovery SLA
 * breach. `notes` carries the operator-note history.
 */
export const DiscoveryTaskDTOSchema = z
  .object({
    id: z.string(),
    geoid: z.string(),
    place: z.string(),
    // The jurisdiction TYPE (city/county/state/federal land/tribal) for the type chip on a queue row.
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
 * (all|attention|clear); `sort` is pop|reports (default pop, population-sorted per spec).
 */
export const DiscoveryListQuerySchema = AdminListQuerySchema.extend({
  filter: z.enum(["all", "attention", "clear"]).optional(),
  sort: z.enum(["pop", "reports"]).optional(),
})
export type DiscoveryListQuery = z.infer<typeof DiscoveryListQuerySchema>

export const DiscoveryListResponseSchema = pageResponse(DiscoveryTaskDTOSchema)
export type DiscoveryListResponse = z.infer<typeof DiscoveryListResponseSchema>

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

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
  // The mini-map center + zoom the design's PinItMap consumes (center [lat,lng]).
  center: z.tuple([z.number(), z.number()]).nullable(),
  zoom: z.number().nullable(),
}).strict()
export type DiscoveryTaskDetailDTO = z.infer<typeof DiscoveryTaskDetailDTOSchema>

export const GetDiscoveryTaskResponseSchema = DiscoveryTaskDetailDTOSchema
export type GetDiscoveryTaskResponse = z.infer<typeof GetDiscoveryTaskResponseSchema>

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Append an operator note to a discovery task ("Add a note for the next operator..."). `id` fills the
 * :id path param (the client reads it from the body and the server reads it from the path).
 */
export const AddNoteRequestSchema = z
  .object({
    id: z.string(),
    text: z.string().min(1).max(2000),
  })
  .strict()
export type AddNoteRequest = z.infer<typeof AddNoteRequestSchema>

/** Flag a discovery task / jurisdiction for review ("Flag for review"). */
export const FlagDiscoveryRequestSchema = z
  .object({
    id: z.string(),
    reason: z.string().max(500).optional(),
  })
  .strict()
export type FlagDiscoveryRequest = z.infer<typeof FlagDiscoveryRequestSchema>

/**
 * Save the routing-contact draft without routing ("Save draft"). A per-category email map plus the
 * optional default email(s) and reporting form URL, mirroring SaveContactsRequest but not routing.
 */
export const SaveDraftRequestSchema = z
  .object({
    id: z.string(),
    contacts: z.record(ReportCategorySchema, z.string().email().nullable()).optional(),
    defaultEmails: z.array(z.string().email()).optional(),
    formUrl: z.string().url().nullable().optional(),
  })
  .strict()
export type SaveDraftRequest = z.infer<typeof SaveDraftRequestSchema>
