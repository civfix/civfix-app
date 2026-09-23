import { z } from "zod"
import {
  IdSchema,
  ISODateSchema,
  BBoxSchema,
  LatLngFields,
  ReportCategorySchema,
  ReportTypeSchema,
  PaginationQuerySchema,
  pageResponse,
} from "./common.js"
import { ReportDTOSchema, ReportPinDTOSchema } from "./entities.js"
import { ReportContentFields, ReportMediaAndHoneypotFields } from "./internal-fields.js"

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

export { MAX_REPORT_ADDR_LENGTH } from "./internal-fields.js"

export const CreateReportRequestSchema = z
  .object({
    idempotencyKey: IdSchema,
    ...ReportContentFields,
    capturedAt: ISODateSchema.optional(),
    ...ReportMediaAndHoneypotFields,
  })
  .strict()
export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>

export const ListReportsInBBoxRequestSchema = z
  .object({
    bbox: BBoxSchema,
    categories: z.array(ReportCategorySchema).optional(),
    types: z.array(ReportTypeSchema).optional(),
    zoom: z.number(),
  })
  .strict()
export type ListReportsInBBoxRequest = z.infer<typeof ListReportsInBBoxRequestSchema>

export const ListReportsSearchRequestSchema = z
  .object({
    // Optional so a category-only (or empty) search is valid.
    q: z.string().trim().max(120).optional(),
    categories: z.array(ReportCategorySchema).optional(),
    types: z.array(ReportTypeSchema).optional(),
    cursor: z.string().optional(),
    // Coerced because this also validates GET query strings, where every value arrives as a string.
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
  // Per-category pin counts for the reports filter popover; a category may be absent.
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
 * POST /reports/:id/resolve: the reporter marks their own report resolved, or reopens it to `published`.
 * `id` consumes the `:id` path param. Owner-only (403 for a non-owner, 404 for a missing report). The
 * response is the updated ReportDTO so the client can replace its cached detail without a second fetch.
 */
export const ResolveReportRequestSchema = z
  .object({
    id: IdSchema,
    resolved: z.boolean(),
  })
  .strict()
export type ResolveReportRequest = z.infer<typeof ResolveReportRequestSchema>

/**
 * POST /reports/:id/unlist: the reporter hides their own report from the public map, search and detail,
 * or re-lists it. The report stays in the city pipeline with its real status. Owner-only (403 for a
 * non-owner, 404 for a missing report); returns the updated ReportDTO. Never deletes: the record is
 * retained so an already-forwarded city item never becomes a ghost.
 */
export const UnlistReportRequestSchema = z
  .object({
    id: IdSchema,
    unlisted: z.boolean(),
  })
  .strict()
export type UnlistReportRequest = z.infer<typeof UnlistReportRequestSchema>
