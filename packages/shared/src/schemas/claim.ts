import { z } from "zod"
import { IdSchema } from "./common.js"
import { ReportDTOSchema } from "./entities.js"

export const ClaimNudgeRequestSchema = z
  .object({
    anonToken: z.string().optional(),
  })
  .strict()
export type ClaimNudgeRequest = z.infer<typeof ClaimNudgeRequestSchema>

export const ClaimNudgeResponseSchema = z.object({
  claimCode: z.string(),
  reportId: IdSchema,
})
export type ClaimNudgeResponse = z.infer<typeof ClaimNudgeResponseSchema>

export const ClaimReportRequestSchema = z
  .object({
    claimCode: z.string().min(1),
  })
  .strict()
export type ClaimReportRequest = z.infer<typeof ClaimReportRequestSchema>

export const ClaimReportResponseSchema = z.object({
  report: ReportDTOSchema,
})
export type ClaimReportResponse = z.infer<typeof ClaimReportResponseSchema>
