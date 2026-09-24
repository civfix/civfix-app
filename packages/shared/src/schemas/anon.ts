import { z } from "zod"
import {
  IdSchema,
  ISODateSchema,
  ReportCategorySchema,
  ReportTypeSchema,
  GeomSourceSchema,
  ReportStatusSchema,
} from "./common.js"
import { MAX_REPORT_ADDR_LENGTH } from "./reports.js"

export const AnonReportRequestSchema = z
  .object({
    idempotencyKey: IdSchema,
    turnstileToken: z.string().min(1),
    category: ReportCategorySchema,
    type: ReportTypeSchema,
    title: z.string().max(120).optional(),
    description: z.string().max(2000).optional(),
    // Display label only; lat/lng stays canonical.
    addr: z.string().max(MAX_REPORT_ADDR_LENGTH).optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    geomSource: GeomSourceSchema,
    mediaUploadIds: z.array(IdSchema).max(5),
    honeypot: z.string().optional(),
    anonToken: z.string().optional(),
  })
  .strict()
export type AnonReportRequest = z.infer<typeof AnonReportRequestSchema>

export const AnonReportResponseSchema = z.object({
  reportId: IdSchema,
  status: z.enum(["held", "published"]),
  claimCode: z.string(),
})
export type AnonReportResponse = z.infer<typeof AnonReportResponseSchema>

export const AnonReportStatusRequestSchema = z
  .object({
    reportId: IdSchema,
    claimCode: z.string().min(1),
  })
  .strict()
export type AnonReportStatusRequest = z.infer<typeof AnonReportStatusRequestSchema>

export const AnonReportStatusResponseSchema = z.object({
  status: ReportStatusSchema,
  publishedAt: ISODateSchema.nullable().optional(),
})
export type AnonReportStatusResponse = z.infer<typeof AnonReportStatusResponseSchema>
