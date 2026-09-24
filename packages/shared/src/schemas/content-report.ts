import { z } from "zod"
import {
  IdSchema,
  ContentReportSubjectSchema,
  ContentReportReasonSchema,
} from "./common.js"

/**
 * POST /content-reports: a citizen flags a piece of UGC with a reason and optional free-text detail.
 * The subject is identified by (subjectType, subjectId), which the server fans into the moderation queue.
 */
export const ReportContentRequestSchema = z
  .object({
    subjectType: ContentReportSubjectSchema,
    subjectId: IdSchema,
    reason: ContentReportReasonSchema,
    details: z.string().trim().max(1000).optional(),
  })
  .strict()
export type ReportContentRequest = z.infer<typeof ReportContentRequestSchema>

export const ReportContentResponseSchema = z.object({ ok: z.literal(true) })
export type ReportContentResponse = z.infer<typeof ReportContentResponseSchema>
