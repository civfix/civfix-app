import { z } from "zod"
import { pageResponse } from "../common.js"
import { AdminListQuerySchema } from "./common.js"

/**
 * Recent activity feed: a union of audit_log entries and recent domain events (pin dropped, cleanup
 * claimed, outreach bounced/opened, mod action, gov onboard). The hue is cosmetic.
 */

/** The kinds of activity row the feed renders (drives the leading icon). */
export const ActivityKindSchema = z.enum([
  "pin",
  "claim",
  "discovery_done",
  "outreach_bounce",
  "mod_action",
  "gov_onboard",
  "outreach_open",
  "cleanup_plan",
])
export type ActivityKind = z.infer<typeof ActivityKindSchema>

/** A single activity-feed item (kind + who + what + where + ts + a cosmetic hue). */
export const ActivityItemDTOSchema = z
  .object({
    kind: ActivityKindSchema,
    who: z.string(),
    what: z.string(),
    where: z.string(),
    ts: z.string(),
    hue: z.string(),
  })
  .strict()
export type ActivityItemDTO = z.infer<typeof ActivityItemDTOSchema>

export const ActivityListQuerySchema = AdminListQuerySchema.extend({
  filter: z.string().optional(),
})
export type ActivityListQuery = z.infer<typeof ActivityListQuerySchema>

export const ActivityListResponseSchema = pageResponse(ActivityItemDTOSchema)
export type ActivityListResponse = z.infer<typeof ActivityListResponseSchema>
