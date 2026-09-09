import { z } from "zod"
import { IdSchema, ISODateSchema } from "../common.js"
import { CursorSchema } from "../common.js"
import { pageResponse } from "../common.js"

/**
 * Audit log view: every admin write is recorded in audit_log with a stable dotted action
 * (e.g. report.status_changed, user.banned, gov_claim.approved). The view filters by actor / action /
 * target. See enumeration 3 #67.
 */

/** One audit-log row. `meta` is the action's structured context (kept loose). */
export const AuditLogEntryDTOSchema = z
  .object({
    id: IdSchema,
    actorId: IdSchema.nullable(),
    actorName: z.string().nullable().optional(),
    action: z.string(),
    target: z.string(),
    meta: z.record(z.unknown()),
    createdAt: ISODateSchema,
  })
  .strict()
export type AuditLogEntryDTO = z.infer<typeof AuditLogEntryDTOSchema>

/** Audit list query: filter by actor / action / target, with cursor pagination. */
export const AuditListQuerySchema = z
  .object({
    actor: z.string().optional(),
    action: z.string().optional(),
    target: z.string().optional(),
    cursor: CursorSchema.optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict()
export type AuditListQuery = z.infer<typeof AuditListQuerySchema>

export const AuditListResponseSchema = pageResponse(AuditLogEntryDTOSchema)
export type AuditListResponse = z.infer<typeof AuditListResponseSchema>
