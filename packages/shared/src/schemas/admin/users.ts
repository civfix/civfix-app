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
 * Admin users surface: every neighbor + what they have contributed. List (filter active/suspended/
 * flagged + search), detail (profile + counts + risk), the three sub-activity lists
 * (reports / events / messages, each paginated), and operator actions: flag/unflag, set status
 * (active|suspended|review|banned; banning revokes sessions), set role (gov provisioning). See
 * enumeration 2.F.
 */

// ---------------------------------------------------------------------------
// List item
// ---------------------------------------------------------------------------

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
    // Avatar fields, mirroring PersonDTO/UserProfileDTO/UserSearchResultDTO so admin renders an IDENTICAL
    // avatar to web/mobile: `avatar` is the deterministic [from, to] hex pair seeding the monogram
    // fallback (see avatar.ts), `avatarUrl` is the uploaded/provider photo URL (now canonicalized into
    // users.avatar_url). Both additive + optional so an older server that does not yet project them still
    // parses; absent avatarUrl => render the solid-color + letter monogram from `avatar`.
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
    // When the user self-deleted (tombstoned) their account; null/omitted => a live account. Lets an
    // operator SEE an account is tombstoned while still showing the real name/handle/email (admin keeps the
    // real identity - only the public DTOs render "Deleted User"). Additive + optional so an older server
    // that does not yet compute it still parses. Inherited by AdminUserDTO via .extend.
    deletedAt: ISODateSchema.nullable().optional(),
  })
  .strict()
export type AdminUserListItemDTO = z.infer<typeof AdminUserListItemDTOSchema>

/** Users list query: search matches name/handle/city; `filter` is active|suspended|flagged. */
export const AdminUserListQuerySchema = AdminListQuerySchema.extend({
  filter: z.enum(["all", "active", "suspended", "flagged"]).optional(),
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
  })
  .strict()
export type AdminUserCounts = z.infer<typeof AdminUserCountsSchema>

export const AdminUserListResponseSchema = pageResponse(AdminUserListItemDTOSchema).extend({
  // Optional: the facet counts are computed only on the FIRST page (cursor === null) and omitted on
  // later keyset pages, so a consumer must read the chip totals from page one. Optional so both halves
  // (a server that omits it on later pages, an older client that always expects it) still parse.
  counts: AdminUserCountsSchema.optional(),
})
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

/**
 * Full user detail. Same shape as the list row plus the assigned role(s) and the `messages` count (the
 * Messages tab badge - only computed on the detail, not in the list, to keep the list query cheap).
 */
export const AdminUserDTOSchema = AdminUserListItemDTOSchema.extend({
  role: RoleSchema,
  messages: z.number().int().nonnegative(),
  // Whether the user has earned the report-verified state (drives the report-verified badge +
  // toggle). Optional + additive so older servers parse.
  reportVerified: z.boolean().optional(),
  // 0.43.0: the organizations this user belongs to, so the Users page can show affiliations without a
  // second call. The badge fields only (name links to the org detail); optional + additive.
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

// ---------------------------------------------------------------------------
// Sub-activity lists (paginated)
// ---------------------------------------------------------------------------

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
    // The user's membership role in that event (organizer|cohost|member) - shares the canonical enum.
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
    // When the user themselves deleted (tombstoned) this message; null/omitted => not user-deleted. Lets the
    // admin UI label it "[deleted by user]" while STILL showing the original text (operators keep full
    // visibility). Additive + optional so an older server that does not yet compute it still parses.
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

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Flag / unflag a user ("Flag account"). */
export const FlagUserRequestSchema = z
  .object({
    id: z.string(),
    reason: z.string().max(500).optional(),
  })
  .strict()
export type FlagUserRequest = z.infer<typeof FlagUserRequestSchema>

/** Set account status ("Ban account" et al.); banning revokes all of the user's sessions. */
export const SetUserStatusRequestSchema = z
  .object({
    id: z.string(),
    status: UserStatusSchema,
    reason: z.string().max(500).optional(),
  })
  .strict()
export type SetUserStatusRequest = z.infer<typeof SetUserStatusRequestSchema>

/** Set the user's role (gov provisioning: citizen|gov_user|gov_admin|operator). */
export const SetRoleRequestSchema = z
  .object({
    id: z.string(),
    role: RoleSchema,
  })
  .strict()
export type SetRoleRequest = z.infer<typeof SetRoleRequestSchema>

/**
 * Set the user's "report-verified" state (POST /admin/users/:id/report-verify). `value:true` marks the
 * account report-verified; `value:false` clears it. `id` consumes the path param. Returns the shared
 * AdminOkResponse.
 */
export const SetUserReportVerifiedRequestSchema = z
  .object({
    id: z.string(),
    value: z.boolean(),
  })
  .strict()
export type SetUserReportVerifiedRequest = z.infer<typeof SetUserReportVerifiedRequestSchema>

/**
 * POST /admin/users/:id/messages/:messageId/remove: an operator removes one of a user's chat messages
 * (audited). `id` + `messageId` consume the path params; `reason` (optional) is the audited removal note,
 * mirroring RemoveDiscussionMessageRequest. Strict. Returns the shared AdminOkResponse.
 */
export const RemoveUserMessageRequestSchema = z
  .object({
    id: IdSchema,
    messageId: IdSchema,
    reason: z.string().max(500).optional(),
  })
  .strict()
export type RemoveUserMessageRequest = z.infer<typeof RemoveUserMessageRequestSchema>
