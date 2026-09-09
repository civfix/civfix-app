import { z } from "zod"
import {
  IdSchema,
  ContentReportSubjectSchema,
  ContentReportReasonSchema,
} from "./common.js"

/**
 * User-facing "report this content" flow (POST /content-reports): a citizen flags a piece of UGC (a
 * report, a comment, a chat message, an event, a profile, or a photo) with a reason and optional free-text
 * detail. The subject is identified by (subjectType, subjectId); the server fans this into the moderation
 * queue. Strict - the wire contract for the endpoint registry.
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
