import { z } from "zod"
import { ReportCategorySchema } from "../common.js"
import { pageResponse } from "../common.js"
import {
  AdminListQuerySchema,
  ModerationDestinationKindSchema,
  ModerationKindSchema,
  ModerationSubjectTypeSchema,
  ModerationToneSchema,
  PrioritySchema,
} from "./common.js"
import { AdminMediaRefSchema } from "./internal-fields.js"

/** Moderation queue. An item clears from the queue once an operator acts on it. */

/** A single signal cell in the moderation detail grid (label, value, tone). */
export const ModerationSignalSchema = z
  .object({
    label: z.string(),
    val: z.string(),
    tone: ModerationToneSchema,
  })
  .strict()
export type ModerationSignal = z.infer<typeof ModerationSignalSchema>

/** The user-context snapshot shown on a moderation item (priors + device). */
export const ModerationUserSchema = z
  .object({
    // The user's id, so the admin can deep-link from the moderation item to their account. Nullable
    // because not every moderation item resolves to a known user (e.g. an anonymous-session subject).
    id: z.string().nullable(),
    handle: z.string(),
    name: z.string(),
    joined: z.string(),
    priorReports: z.number().int().nonnegative(),
    priorRemovals: z.number().int().nonnegative(),
    strikes: z.number().int().nonnegative(),
    device: z.string(),
  })
  .strict()
export type ModerationUser = z.infer<typeof ModerationUserSchema>

/** A similar/related moderation item ("Same block, resolved as valid"). */
export const ModerationSimilarSchema = z
  .object({
    id: z.string(),
    note: z.string(),
    when: z.string(),
  })
  .strict()
export type ModerationSimilar = z.infer<typeof ModerationSimilarSchema>

/** A held media reference shown in the moderation detail (the actual asset, by kind). */
export const ModerationMediaSchema = AdminMediaRefSchema
export type ModerationMedia = z.infer<typeof ModerationMediaSchema>

/**
 * A moderation queue row. `flag` is the label; `reporter` the who; `reason` the why; `kind` what the
 * item is about; `priority` the band. `category` can be null for non-report items (appeals).
 */
export const ModerationListItemDTOSchema = z
  .object({
    id: z.string(),
    flag: z.string(),
    reporter: z.string(),
    category: ReportCategorySchema.nullable(),
    reason: z.string(),
    age: z.string(),
    priority: PrioritySchema,
    kind: ModerationKindSchema,
    // What KIND of subject this item points at (chiefly for citizen `user_report` items). Optional so an
    // older server still parses.
    subjectType: ModerationSubjectTypeSchema.optional(),
    // The id of the reported SUBJECT (report/user/event/comment/…, per `subjectType`). This remains the
    // real content id even when navigation requires a different parent entity.
    subjectId: z.string(),
    // Explicit admin navigation target. Chat/photo subjects resolve to a parent report/event only when
    // repository metadata proves that relationship; standalone content keeps both fields null. Defaulted so
    // an older server still parses.
    destinationKind: ModerationDestinationKindSchema.nullable().default(null),
    destinationId: z.string().nullable().default(null),
    // The id of the REPORTER (the who behind `reporter`), so their name can link to their account. Null
    // for anonymous/system-originated reports.
    reporterId: z.string().nullable(),
  })
  .strict()
export type ModerationListItemDTO = z.infer<typeof ModerationListItemDTOSchema>

/**
 * Moderation list query: search matches flag/reporter/reason; `filter` narrows by kind/priority.
 * `user_report` is the human-reported facet (a neighbor flagged the content), as opposed to the
 * automated signals.
 */
export const ModerationListQuerySchema = AdminListQuerySchema.extend({
  filter: z
    .enum(["all", "image", "pattern", "appeal", "gps", "duplicate", "high", "user_report"])
    .optional(),
})
export type ModerationListQuery = z.infer<typeof ModerationListQuerySchema>

export const ModerationListResponseSchema = pageResponse(ModerationListItemDTOSchema)
export type ModerationListResponse = z.infer<typeof ModerationListResponseSchema>

/**
 * Full moderation detail: the list shape plus the description, the auto-action banner, the place, the
 * signals grid, the user-context snapshot, similar items, and the held media references.
 */
export const ModerationItemDTOSchema = ModerationListItemDTOSchema.extend({
  desc: z.string(),
  autoAction: z.string().nullable(),
  place: z.string().nullable(),
  signals: z.array(ModerationSignalSchema),
  user: ModerationUserSchema,
  similar: z.array(ModerationSimilarSchema),
  media: z.array(ModerationMediaSchema),
}).strict()
export type ModerationItemDTO = z.infer<typeof ModerationItemDTOSchema>

export const GetModerationItemResponseSchema = ModerationItemDTOSchema
export type GetModerationItemResponse = z.infer<typeof GetModerationItemResponseSchema>

/** Approve / publish a held item. */
export const ApproveModerationRequestSchema = z
  .object({
    id: z.string(),
    note: z.string().max(2000).optional(),
  })
  .strict()
export type ApproveModerationRequest = z.infer<typeof ApproveModerationRequestSchema>

/** Remove / reject a held item. */
export const RemoveModerationRequestSchema = z
  .object({
    id: z.string(),
    reason: z.string().max(2000).optional(),
  })
  .strict()
export type RemoveModerationRequest = z.infer<typeof RemoveModerationRequestSchema>

export const HoldModerationRequestSchema = z
  .object({
    id: z.string(),
    note: z.string().max(2000).optional(),
  })
  .strict()
export type HoldModerationRequest = z.infer<typeof HoldModerationRequestSchema>

/** Decide an appeal: uphold the original action or overturn it. */
export const AppealModerationRequestSchema = z
  .object({
    id: z.string(),
    decision: z.enum(["uphold", "overturn"]),
    note: z.string().max(2000).optional(),
  })
  .strict()
export type AppealModerationRequest = z.infer<typeof AppealModerationRequestSchema>
