import { z } from "zod"
import {
  IdSchema,
  ISODateSchema,
  ReportCategorySchema,
  ReportTypeSchema,
  GeomSourceSchema,
  ReportStatusSchema,
} from "./common.js"

/**
 * Anonymous (logged-out) report submission, gated by Turnstile, plus claim-code status checks.
 */

export const AnonReportRequestSchema = z
  .object({
    idempotencyKey: IdSchema,
    turnstileToken: z.string().min(1),
    category: ReportCategorySchema,
    // Fine-grained report type (Dump/Encampment/etc), persisted + filterable. Required, mirroring
    // CreateReportRequest - the wizard always supplies it; the anon insert writes it to reports.type.
    type: ReportTypeSchema,
    // Short headline shown as the report title in the operator console (optional; see CreateReportRequest).
    title: z.string().max(120).optional(),
    description: z.string().max(2000).optional(),
    // Reverse-geocoded street address (display label; lat/lng stays canonical; optional).
    addr: z.string().max(300).optional(),
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
