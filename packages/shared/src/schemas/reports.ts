import { z } from "zod"
import {
  IdSchema,
  ISODateSchema,
  BBoxSchema,
  LatLngFields,
  ReportCategorySchema,
  ReportTypeSchema,
  GeomSourceSchema,
  PaginationQuerySchema,
  pageResponse,
} from "./common.js"
import { ReportDTOSchema, ReportPinDTOSchema } from "./entities.js"

/**
 * Report creation, retrieval, map querying, and follow.
 * The entity DTOs (ReportDTO, ReportPinDTO, MediaDTO, ReportTimelineEntryDTO) live in entities.ts.
 */

export {
  ReportDTOSchema,
  ReportPinDTOSchema,
  ReportTimelineEntryDTOSchema,
  ReportVisibilitySchema,
  MediaDTOSchema,
} from "./entities.js"
export type {
  ReportDTO,
  ReportPinDTO,
  ReportTimelineEntryDTO,
  ReportVisibility,
  MediaDTO,
} from "./entities.js"

export const CreateReportRequestSchema = z
  .object({
    idempotencyKey: IdSchema,
    category: ReportCategorySchema,
    // The fine-grained persisted report type. REQUIRED: the wizard always supplies one (it also drives
    // the canonical category via REPORT_TYPE_TO_CATEGORY). Distinct from the broader `category` above.
    type: ReportTypeSchema,
    // Short headline shown as the report title in "your reports" and the operator console. Optional:
    // a photo-only report omits it and reads as the category label.
    title: z.string().max(120).optional(),
    description: z.string().max(2000).optional(),
    // Reverse-geocoded street address for the point (display label; lat/lng stays canonical). Optional:
    // a client that cannot resolve one omits it and the operator console falls back to the jurisdiction.
    addr: z.string().max(300).optional(),
    ...LatLngFields,
    geomSource: GeomSourceSchema,
    capturedAt: ISODateSchema.optional(),
    mediaUploadIds: z.array(IdSchema).max(5),
    // Anti-spam honeypot: must be empty/absent for a legitimate submission.
    honeypot: z.string().optional(),
  })
  .strict()
export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>

export const ListReportsInBBoxRequestSchema = z
  .object({
    bbox: BBoxSchema,
    categories: z.array(ReportCategorySchema).optional(),
    // Optional fine-grained report-type filter, trivially parallel to `categories` (the host fine-type
    // filter on the map). Same enum-array shape.
    types: z.array(ReportTypeSchema).optional(),
    zoom: z.number(),
  })
  .strict()
export type ListReportsInBBoxRequest = z.infer<typeof ListReportsInBBoxRequestSchema>

export const ListReportsSearchRequestSchema = z
  .object({
    // Free-text query (title/description/address match, server-defined). Trimmed + length-capped; optional
    // so a category-only search (or an empty search) is valid.
    q: z.string().trim().max(120).optional(),
    // Optional category filter, reusing the same enum array shape as ListReportsInBBoxRequest.categories.
    categories: z.array(ReportCategorySchema).optional(),
    // Optional fine-grained report-type filter (the host's new fine-type filter), alongside `categories`.
    // Same enum-array shape; both may be present (server ANDs/ORs them per its query rules).
    types: z.array(ReportTypeSchema).optional(),
    // Opaque keyset cursor echoed from a prior response's nextCursor; optional on the first page.
    cursor: z.string().optional(),
    // Page size. Coerced because this also validates GET query strings (`?limit=30` -> "30"); defaults to
    // 30 and is clamped to [1, 50] (mirrors PaginationQuerySchema's bounds).
    limit: z.coerce.number().int().min(1).max(50).optional().default(30),
  })
  .strict()
export type ListReportsSearchRequest = z.infer<typeof ListReportsSearchRequestSchema>

export const ListReportsSearchResponseSchema = z.object({
  items: z.array(ReportPinDTOSchema),
  nextCursor: z.string().nullable(),
})
export type ListReportsSearchResponse = z.infer<typeof ListReportsSearchResponseSchema>

export const ReportClusterDTOSchema = z.object({
  ...LatLngFields,
  count: z.number().int().nonnegative(),
})
export type ReportClusterDTO = z.infer<typeof ReportClusterDTOSchema>

export const ReportClusterResponseSchema = z.object({
  clusters: z.array(ReportClusterDTOSchema),
  pins: z.array(ReportPinDTOSchema),
  // Per-category pin counts for the reports filter popover. A typed partial record (a category may be
  // absent). Optional so existing parses that never sent it do not break.
  counts: z.record(ReportCategorySchema, z.number()).optional(),
})
export type ReportClusterResponse = z.infer<typeof ReportClusterResponseSchema>

export const GetReportResponseSchema = ReportDTOSchema
export type GetReportResponse = z.infer<typeof GetReportResponseSchema>

export const ListMyReportsRequestSchema = PaginationQuerySchema
export type ListMyReportsRequest = z.infer<typeof ListMyReportsRequestSchema>

export const ListMyReportsResponseSchema = pageResponse(ReportDTOSchema)
export type ListMyReportsResponse = z.infer<typeof ListMyReportsResponseSchema>

/**
 * POST /reports/:id/resolve - the REPORTER marks their OWN report resolved, or reopens it. `id` consumes
 * the `:id` path param (merged in from the URL by the route). `resolved: true` sets the report status to
 * `resolved`; `resolved: false` reopens it to `published` (the live "not yet forwarded" state). The route
 * is auth-required and owner-only (a non-owner gets 403, a missing report 404). The response is the
 * freshly-updated ReportDTO (new status + a new timeline entry) so the client can replace its cached
 * detail without a second fetch.
 */
export const ResolveReportRequestSchema = z
  .object({
    id: IdSchema,
    resolved: z.boolean(),
  })
  .strict()
export type ResolveReportRequest = z.infer<typeof ResolveReportRequestSchema>

/**
 * POST /reports/:id/unlist - the REPORTER hides their OWN report from the public map/lists, or re-lists it.
 * `unlisted: true` sets reports.visibility='hidden' (gone from map/search/public detail, kept in the city
 * pipeline with its real status); `unlisted: false` re-lists it (visibility='public'). Owner-only (403 for a
 * non-owner, 404 for a missing report). Returns the freshly-updated ReportDTO (new visibility + timeline row).
 * NEVER deletes: the record is retained so the already-forwarded city item never becomes a ghost.
 */
export const UnlistReportRequestSchema = z
  .object({
    id: IdSchema,
    unlisted: z.boolean(),
  })
  .strict()
export type UnlistReportRequest = z.infer<typeof UnlistReportRequestSchema>
