import { z } from "zod"
import {
  CleanupMemberRoleSchema,
  ReportCategorySchema,
  ISODateSchema,
  IdSchema,
  OrganizationMemberRoleSchema,
} from "../common.js"
import { pageResponse } from "../common.js"
import { AvatarPairSchema } from "../entities.js"
import { RoleSchema } from "../../types/roles.js"
import {
  AdminListQuerySchema,
  AdminReportStatusSchema,
  RiskSchema,
  UserStatusSchema,
} from "./common.js"

/**
 * A user list row. `reports`/`cleanups` are derived counts; `removals`/`strikes` come from the
 * moderation side table; `risk` is the moderation risk band; `flagged`/`flagReason` the abuse marker.
 */
export const AdminUserListItemDTOSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    handle: z.string(),
    city: z.string(),
    joined: z.string(),
    // Mirrors PersonDTO/UserProfileDTO so admin renders an IDENTICAL avatar to web/mobile: `avatar` is the
    // deterministic [from, to] hex pair seeding the monogram fallback (see avatar.ts), `avatarUrl` the
    // uploaded/provider photo. Absent avatarUrl => render the monogram from `avatar`.
    avatar: AvatarPairSchema,
    avatarUrl: z.string().nullable().optional(),
    status: UserStatusSchema,
    reports: z.number().int().nonnegative(),
    cleanups: z.number().int().nonnegative(),
    removals: z.number().int().nonnegative(),
    strikes: z.number().int().nonnegative(),
    risk: RiskSchema,
    lastActive: z.string(),
    flagged: z.boolean(),
    flagReason: z.string().nullable(),
    // When the user self-deleted (tombstoned) their account; null/omitted => a live account. Admin keeps
    // the real name/handle/email; only the public DTOs render "Deleted User". Optional so an older server
    // still parses.
    deletedAt: ISODateSchema.nullable().optional(),
  })
  .strict()
export type AdminUserListItemDTO = z.infer<typeof AdminUserListItemDTOSchema>

/**
 * Users list query: search matches name/handle/city; `filter` is active|suspended|flagged|deleted|banned.
 * `deleted` is the tombstoned (self-deleted) set, `banned` the permanently barred set - both orthogonal
 * to `suspended`, which is the reversible status.
 */
export const AdminUserListQuerySchema = AdminListQuerySchema.extend({
  filter: z.enum(["all", "active", "suspended", "flagged", "deleted", "banned"]).optional(),
})
export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>

/**
 * Per-facet account totals for the filter chips, computed server-side over the SEARCHED set (so the chip
 * numbers are accurate + stable across the facet rather than capped to the first keyset page). `suspended`
 * counts the explicit suspended status (matching the `suspended` facet); `flagged` is the abuse marker.
 */
export const AdminUserCountsSchema = z
  .object({
    all: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    suspended: z.number().int().nonnegative(),
    flagged: z.number().int().nonnegative(),
    deleted: z.number().int().nonnegative().optional(),
    banned: z.number().int().nonnegative().optional(),
  })
  .strict()
export type AdminUserCounts = z.infer<typeof AdminUserCountsSchema>

export const AdminUserListResponseSchema = pageResponse(AdminUserListItemDTOSchema).extend({
  // Computed only on the FIRST page (cursor === null) and omitted on later keyset pages, so a consumer
  // must read the chip totals from page one.
  counts: AdminUserCountsSchema.optional(),
})
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>

/**
 * Full user detail. Same shape as the list row plus the assigned role(s) and the `messages` count (the
 * Messages tab badge - only computed on the detail, not in the list, to keep the list query cheap).
 */
export const AdminUserDTOSchema = AdminUserListItemDTOSchema.extend({
  role: RoleSchema,
  messages: z.number().int().nonnegative(),
  // Whether the user has earned the report-verified state. Optional so older servers parse.
  reportVerified: z.boolean().optional(),
  // The user's organizations (badge fields only), so affiliations show without a second call. Optional
  // so older servers parse.
  organizations: z
    .array(
      z.object({
        id: IdSchema,
        slug: z.string(),
        name: z.string(),
        role: OrganizationMemberRoleSchema,
      }),
    )
    .optional(),
}).strict()
export type AdminUserDTO = z.infer<typeof AdminUserDTOSchema>

export const GetAdminUserResponseSchema = AdminUserDTOSchema
export type GetAdminUserResponse = z.infer<typeof GetAdminUserResponseSchema>

/**
 * Query for the three user sub-activity lists (reports / events / messages). `id` fills the :id path
 * param (the client reads it from the input and omits it from the serialized query); `cursor`/`limit`
 * are cursor pagination. Non-strict so the path-param echo is tolerated.
 */
export const UserSubListQuerySchema = z.object({
  id: z.string(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})
export type UserSubListQuery = z.infer<typeof UserSubListQuerySchema>

/** A row in the user's Reports tab. */
export const UserReportItemDTOSchema = z
  .object({
    id: z.string(),
    category: ReportCategorySchema,
    title: z.string(),
    place: z.string(),
    status: AdminReportStatusSchema,
    age: z.string(),
  })
  .strict()
export type UserReportItemDTO = z.infer<typeof UserReportItemDTOSchema>

export const UserReportsResponseSchema = pageResponse(UserReportItemDTOSchema)
export type UserReportsResponse = z.infer<typeof UserReportsResponseSchema>

/** A row in the user's Events tab (organized vs joined a cleanup). */
export const UserEventItemDTOSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    place: z.string(),
    role: CleanupMemberRoleSchema,
    attendees: z.number().int().nonnegative(),
    when: z.string(),
  })
  .strict()
export type UserEventItemDTO = z.infer<typeof UserEventItemDTOSchema>

export const UserEventsResponseSchema = pageResponse(UserEventItemDTOSchema)
export type UserEventsResponse = z.infer<typeof UserEventsResponseSchema>

/** A row in the user's Messages tab (a chat message + the thread it was in). */
export const UserMessageItemDTOSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    thread: z.string(),
    when: z.string(),
    // When the user themselves deleted (tombstoned) this message; null/omitted => not user-deleted.
    // Operators keep full visibility of the original text. Optional so an older server still parses.
    deletedAt: ISODateSchema.nullable().optional(),
    // `chat` is cleanup/event chat; `group` is a standalone group or channel. They intentionally remain
    // distinct because only cleanup chat has an admin event destination.
    source: z.enum(["chat", "group", "dm", "report"]).optional(),
    // The id of the origin entity: cleanup for `chat`, group for `group`, report for `report`, and null
    // for `dm`. Consumers must choose navigation from `source`, not sourceId presence alone.
    sourceId: z.string().nullable(),
  })
  .strict()
export type UserMessageItemDTO = z.infer<typeof UserMessageItemDTOSchema>

export const UserMessagesResponseSchema = pageResponse(UserMessageItemDTOSchema)
export type UserMessagesResponse = z.infer<typeof UserMessagesResponseSchema>

export const FlagUserRequestSchema = z
  .object({
    id: z.string(),
    reason: z.string().max(500).optional(),
  })
  .strict()
export type FlagUserRequest = z.infer<typeof FlagUserRequestSchema>

/** Set account status; banning revokes all of the user's sessions. */
export const SetUserStatusRequestSchema = z
  .object({
    id: z.string(),
    status: UserStatusSchema,
    reason: z.string().max(500).optional(),
  })
  .strict()
export type SetUserStatusRequest = z.infer<typeof SetUserStatusRequestSchema>

/** Set the user's role (gov provisioning). */
export const SetRoleRequestSchema = z
  .object({
    id: z.string(),
    role: RoleSchema,
  })
  .strict()
export type SetRoleRequest = z.infer<typeof SetRoleRequestSchema>

/** Set (`value: true`) or clear the user's "report-verified" state. `id` fills the path param. */
export const SetUserReportVerifiedRequestSchema = z
  .object({
    id: z.string(),
    value: z.boolean(),
  })
  .strict()
export type SetUserReportVerifiedRequest = z.infer<typeof SetUserReportVerifiedRequestSchema>

/**
 * An operator removes one of a user's chat messages (audited). `id` + `messageId` fill the path params;
 * `reason` is the audited removal note.
 */
export const RemoveUserMessageRequestSchema = z
  .object({
    id: IdSchema,
    messageId: IdSchema,
    reason: z.string().max(500).optional(),
  })
  .strict()
export type RemoveUserMessageRequest = z.infer<typeof RemoveUserMessageRequestSchema>
