import { z } from "zod"
import { IdSchema, ISODateSchema, ReportStatusSchema } from "./common.js"
import { ReportContentFields, ReportMediaAndHoneypotFields } from "./internal-fields.js"

export const AnonReportRequestSchema = z
  .object({
    idempotencyKey: IdSchema,
    turnstileToken: z.string().min(1),
    ...ReportContentFields,
    ...ReportMediaAndHoneypotFields,
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
