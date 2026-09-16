import { z } from "zod"
import {
  HostExportKindSchema,
  HostExportStatusSchema,
  IdSchema,
  ISODateSchema,
  PaginationQuerySchema,
  pageResponse,
} from "../common.js"


export { HostExportKindSchema, HostExportStatusSchema } from "../common.js"
export type { HostExportKind, HostExportStatus } from "../common.js"

const HostExportDTOObjectSchema = z.object({
  id: IdSchema,
  cleanupId: IdSchema.nullable().optional(),
  organizationId: IdSchema.nullable().optional(),
  kind: HostExportKindSchema,
  status: HostExportStatusSchema,
  rowCount: z.number().int().nonnegative().nullable().optional(),
  byteSize: z.number().int().nonnegative().nullable().optional(),
  truncated: z.boolean().default(false),
  errorCode: z.string().nullable().optional(),
  requestedAt: ISODateSchema,
  completedAt: ISODateSchema.nullable().optional(),
  expiresAt: ISODateSchema.nullable().optional(),
})
export type HostExportDTO = z.infer<typeof HostExportDTOObjectSchema>
export const HostExportDTOSchema: z.ZodType<HostExportDTO, z.ZodTypeDef, unknown> =
  HostExportDTOObjectSchema

export const HostExportFiltersSchema = z
  .object({
    ticketTypeId: IdSchema.optional(),
    slotId: IdSchema.optional(),
    status: z.string().max(40).optional(),
    from: ISODateSchema.optional(),
    to: ISODateSchema.optional(),
  })
  .strict()
export type HostExportFilters = z.infer<typeof HostExportFiltersSchema>

export const RequestEventExportRequestSchema = z
  .object({
    id: IdSchema,
    kind: HostExportKindSchema,
    filters: HostExportFiltersSchema.optional(),
  })
  .strict()
export type RequestEventExportRequest = z.infer<typeof RequestEventExportRequestSchema>

export const RequestEventExportResponseSchema = HostExportDTOSchema
export type RequestEventExportResponse = z.infer<typeof RequestEventExportResponseSchema>

export const ListEventExportsRequestSchema = PaginationQuerySchema.extend({
  id: IdSchema,
}).strict()
export type ListEventExportsRequest = z.infer<typeof ListEventExportsRequestSchema>

const ListEventExportsResponseObjectSchema = pageResponse(HostExportDTOSchema)
export type ListEventExportsResponse = z.infer<typeof ListEventExportsResponseObjectSchema>
export const ListEventExportsResponseSchema: z.ZodType<ListEventExportsResponse, z.ZodTypeDef, unknown> =
  ListEventExportsResponseObjectSchema

export const GetEventExportRequestSchema = z.object({ id: IdSchema, exportId: IdSchema }).strict()
export type GetEventExportRequest = z.infer<typeof GetEventExportRequestSchema>

export const GetEventExportResponseSchema = HostExportDTOSchema
export type GetEventExportResponse = z.infer<typeof GetEventExportResponseSchema>

export const DownloadHostExportRequestSchema = z.object({ id: IdSchema }).strict()
export type DownloadHostExportRequest = z.infer<typeof DownloadHostExportRequestSchema>

const DownloadHostExportResponseObjectSchema = z.object({
  url: z.string(),
  expiresAt: ISODateSchema,
  filename: z.string(),
})
export type DownloadHostExportResponse = z.infer<typeof DownloadHostExportResponseObjectSchema>
export const DownloadHostExportResponseSchema: z.ZodType<DownloadHostExportResponse, z.ZodTypeDef, unknown> =
  DownloadHostExportResponseObjectSchema
