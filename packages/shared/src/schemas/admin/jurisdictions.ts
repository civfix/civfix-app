import { z } from "zod"
import { ForwardTemplateBodySchema, ForwardTemplateSubjectSchema } from "./forward-template.js"
import { ReportCategorySchema } from "../common.js"
import { pageResponse } from "../common.js"
import { JurisdictionLayerSchema } from "../map.js"
import { AdminListQuerySchema } from "./common.js"
import { DiscoveryContactSchema, PerCategoryCountsSchema } from "./discovery.js"

/**
 * Jurisdiction routing contacts + the jurisdiction directory. "Save & route" (the core discovery
 * action) persists a per-category contact map + default email(s) + a reporting form URL for a GEOID,
 * routes pending pins, and enqueues throttled outreach. The directory lists every jurisdiction's
 * routing posture (org, dept, email/form, method, status, coverage, lastRouted). See enumeration 2.B,
 * endpoints #13/#14/#15.
 */

/**
 * Save routing contacts for a GEOID and route ("Save & route"). `contacts` is the per-category email
 * map (one email per report category, nullable to clear a category). `defaultEmails` are the
 * fallback/all-categories addresses (the legacy contactEmails[]). `formUrl` is the city's reporting
 * form fallback. At least one contact should be filled for routing; that is enforced server-side.
 */
export const SaveContactsRequestSchema = z
  .object({
    geoid: z.string(),
    contacts: z.record(ReportCategorySchema, z.string().email().nullable()).optional(),
    defaultEmails: z.array(z.string().email()).optional(),
    formUrl: z.string().url().nullable().optional(),
    forwardSubjectTemplate: ForwardTemplateSubjectSchema.nullable().optional(),
    forwardBodyTemplate: ForwardTemplateBodySchema.nullable().optional(),
  })
  .strict()
export type SaveContactsRequest = z.infer<typeof SaveContactsRequestSchema>

/**
 * A jurisdiction's discussion @handle as SET from the admin panel (e.g. "sf" -> "@sf", mentionable in a
 * report discussion). Normalized BEFORE validation: a leading "@" is stripped and the value is trimmed +
 * lowercased. An empty string CLEARS the handle (the server stores NULL). Otherwise it must be 2-40 chars
 * of [a-z0-9_] (underscores allowed anywhere; longer than a user handle because city slugs like
 * "san_francisco" run long). The reserved-word + case-insensitive uniqueness checks are enforced
 * server-side (they need the DB) - this schema only governs shape + normalization.
 */
export const JurisdictionHandleSchema = z
  .string()
  // Trim FIRST so leading space before a typed "@" doesn't defeat the strip, then drop the "@"(s), trim any
  // gap left behind ("@ sf"), and lowercase. (Mirrors the admin client's own normalization order.)
  .transform((s) => s.trim().replace(/^@+/, "").trim().toLowerCase())
  .refine((s) => s === "" || /^[a-z0-9_]{2,40}$/.test(s), {
    message: "Handle must be 2-40 characters using lowercase letters, numbers, or underscores.",
  })
  .transform((s) => (s === "" ? null : s))

/** Routing method on a directory row: a contact email, the city's reporting form, or none yet. */
export const JurisdictionMethodSchema = z.enum(["email", "form", "none"])
export type JurisdictionMethod = z.infer<typeof JurisdictionMethodSchema>

/** Directory routing-contact health (verified vs pending vs a bounced address). */
export const JurisdictionContactStatusSchema = z.enum(["verified", "pending", "bounced"])
export type JurisdictionContactStatus = z.infer<typeof JurisdictionContactStatusSchema>

/**
 * One jurisdiction-directory row (the "Jurisdictions directory" companion to discovery; design
 * govContacts[*]). `coverage` is a human label of which categories route ("All categories", "Trash,
 * Hazard, Water"). `lastRouted` is when a pin last routed to this contact (nullable if never).
 */
export const JurisdictionDirectoryDTOSchema = z
  .object({
    geoid: z.string(),
    org: z.string(),
    dept: z.string().nullable(),
    email: z.string().email().nullable(),
    form: z.string().url().nullable(),
    method: JurisdictionMethodSchema,
    status: JurisdictionContactStatusSchema,
    coverage: z.string(),
    lastRouted: z.string().nullable(),
    // The jurisdiction TYPE (city/county/state/federal land/tribal). Drives the directory type chip and
    // lets a federal-land / tribal jurisdiction be told apart from a municipality at a glance.
    layer: JurisdictionLayerSchema,
    // TIGER/Census population (0 when unknown); shown in the detail stats card next to reports waiting.
    population: z.number().int().nonnegative(),
    // Total open reports in this jurisdiction still waiting on a routing contact (0 once fully routed).
    reportsWaiting: z.number().int().nonnegative(),
    // Per-category breakdown of the waiting reports; drives the per-type counts in the routing grid.
    perCategoryCounts: PerCategoryCountsSchema,
    // The existing per-category routing contacts, so the grid prefills when an operator opens the row.
    contacts: z.array(DiscoveryContactSchema),
    // When an operator flagged this jurisdiction for review (ISO/relative string), or null if not flagged.
    flaggedAt: z.string().nullable(),
    // The jurisdiction's discussion @handle (the "@sf" mentionable in a report discussion), or null when
    // unset. Editable from the directory detail (PATCH handle); seeds the detail's handle field.
    handle: z.string().nullable(),
    // ISO timestamp of the OLDEST report still waiting on a routing contact in this jurisdiction, or null
    // when nothing is waiting. Backs the "oldest" sort + the "waiting since" age chip in the directory.
    oldestReportAt: z.string().nullable(),
    // Per-jurisdiction custom forward-email template overrides (subject + body). Null on either => fall
    // back to the built-in default template for that part. The `{token}` palette is
    // FORWARD_TEMPLATE_VARIABLES; interpolateForwardTemplate renders them. Edited via PatchJurisdiction.
    forwardSubjectTemplate: z.string().nullable(),
    forwardBodyTemplate: z.string().nullable(),
  })
  .strict()
export type JurisdictionDirectoryDTO = z.infer<typeof JurisdictionDirectoryDTOSchema>

/**
 * Directory list query: `q` matches org/geoid (server-side ILIKE), `filter` narrows by routing posture,
 * `layer` narrows by jurisdiction TYPE, `sort` orders the whole table (server-side), and `cursor`/`limit`
 * page it. `routed` = any contact on file (email or form); `none` = nothing yet (the operator action
 * list); `needs_mapping` = has waiting reports AND no routing contact (the "map these next" worklist).
 * `sort` accepts `population` (default, biggest first), `reports` (most waiting first), `name` (A→Z), or
 * `oldest` (longest-waiting report first). `layer` narrows to one type — `state` | `county` | `place`
 * (city) | `federal` | `tribal` — and combines with `filter` (the two are independent dimensions); omit
 * it for every type.
 */
export const JurisdictionListQuerySchema = AdminListQuerySchema.extend({
  filter: z.enum(["all", "email", "form", "none", "routed", "needs_mapping"]).optional(),
  sort: z.enum(["population", "reports", "name", "oldest"]).optional(),
  layer: JurisdictionLayerSchema.optional(),
})
export type JurisdictionListQuery = z.infer<typeof JurisdictionListQuerySchema>

/**
 * Facet counts for the directory filter chips, scoped to the active search (`q`) but NOT to the active
 * `filter`, so the chips show how the search result splits by routing posture. `routed` + `unrouted`
 * sum to the total matching jurisdictions.
 */
export const JurisdictionDirectoryFacetsSchema = z
  .object({
    routed: z.number().int().nonnegative(),
    unrouted: z.number().int().nonnegative(),
  })
  .strict()
export type JurisdictionDirectoryFacets = z.infer<typeof JurisdictionDirectoryFacetsSchema>

/**
 * The directory page. `nextCursor` drives infinite scroll (null at the end). `total` is the count of
 * jurisdictions matching the search, type, and active routing filter (so the header shows the real count,
 * not the page size); `facets` backs the routing chip split for the search/type result. Both are optional
 * and only returned on the first page (cursor absent), so a mid-scroll page omits them and a pre-this-change
 * client still parses.
 */
export const JurisdictionDirectoryResponseSchema = pageResponse(JurisdictionDirectoryDTOSchema).extend({
  total: z.number().int().nonnegative().optional(),
  facets: JurisdictionDirectoryFacetsSchema.optional(),
})
export type JurisdictionDirectoryResponse = z.infer<typeof JurisdictionDirectoryResponseSchema>

/** A GeoJSON Polygon/MultiPolygon geometry (passthrough — only `type`/`coordinates` are read clientside). */
export const GeoJsonGeometrySchema = z
  .object({
    type: z.string(),
    coordinates: z.array(z.unknown()),
  })
  .passthrough()
export type GeoJsonGeometry = z.infer<typeof GeoJsonGeometrySchema>

/** Path params for fetching one jurisdiction's boundary geometry. */
export const JurisdictionGeometryRequestSchema = z.object({ geoid: z.string() }).strict()
export type JurisdictionGeometryRequest = z.infer<typeof JurisdictionGeometryRequestSchema>

/**
 * One jurisdiction's boundary, for the directory's verification map: a simplified GeoJSON geometry plus
 * its bounding box ([west, south, east, north], for fit-bounds) and a representative interior point
 * ([lng, lat], guaranteed inside the polygon). The geometry is server-simplified so a large county/state
 * polygon stays a small payload. Returned only when the jurisdiction has a stored boundary.
 */
export const JurisdictionGeometryResponseSchema = z
  .object({
    geoid: z.string(),
    name: z.string(),
    layer: JurisdictionLayerSchema,
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    centroid: z.tuple([z.number(), z.number()]),
    geometry: GeoJsonGeometrySchema,
  })
  .strict()
export type JurisdictionGeometryResponse = z.infer<typeof JurisdictionGeometryResponseSchema>

/**
 * Patch a jurisdiction's contact / notes / reporting-form URL ("Fix routing contact" from Mail, and
 * inline edits in the directory). All fields optional; only the provided ones change.
 */
export const PatchJurisdictionRequestSchema = z
  .object({
    geoid: z.string(),
    contacts: z.record(ReportCategorySchema, z.string().email().nullable()).optional(),
    defaultEmails: z.array(z.string().email()).optional(),
    formUrl: z.string().url().nullable().optional(),
    notes: z.string().max(2000).optional(),
    // Flag / unflag this jurisdiction for operator review (the Directory "Flag for review" action).
    // `flagged: true` stamps flagged_at + stores flagReason; `flagged: false` clears both.
    flagged: z.boolean().optional(),
    flagReason: z.string().max(500).optional(),
    // Set / clear the discussion @handle. Normalized + shape-checked by JurisdictionHandleSchema; the
    // value resolves to a bare lowercase slug or null (empty string -> null = clear). Reserved-word +
    // uniqueness are enforced server-side. Omit to leave the handle unchanged.
    handle: JurisdictionHandleSchema.nullable().optional(),
    // Set / clear the per-jurisdiction custom forward-email template override (subject + body). Explicit
    // null clears the override (=> use the built-in default); an empty string is also treated as clear
    // (mirrors the `handle` convention) - that coercion is applied server-side. `{token}` palette is
    // FORWARD_TEMPLATE_VARIABLES. Omit to leave a template unchanged.
    forwardSubjectTemplate: ForwardTemplateSubjectSchema.nullable().optional(),
    forwardBodyTemplate: ForwardTemplateBodySchema.nullable().optional(),
  })
  .strict()
export type PatchJurisdictionRequest = z.infer<typeof PatchJurisdictionRequestSchema>
