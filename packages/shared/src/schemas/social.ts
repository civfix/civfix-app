import { z } from "zod"
import { IdSchema, PaginationQuerySchema, pageResponse } from "./common.js"
import {
  PersonDTOSchema,
  CleanupDTOSchema,
  AvatarPairSchema,
  HttpsUrlSchema,
  SocialLinksSchema,
} from "./entities.js"
import { UserDTOSchema, LocaleEnum } from "./auth.js"


export { PersonDTOSchema } from "./entities.js"
export type { PersonDTO } from "./entities.js"

export const ListPeopleRequestSchema = PaginationQuerySchema.extend({
  q: z.string().optional(),
}).strict()
export type ListPeopleRequest = z.infer<typeof ListPeopleRequestSchema>

export const ListPeopleResponseSchema = pageResponse(PersonDTOSchema)
export type ListPeopleResponse = z.infer<typeof ListPeopleResponseSchema>

export const ConnectionsListQuerySchema = z.object({
  id: z.string(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
})
export type ConnectionsListQuery = z.infer<typeof ConnectionsListQuerySchema>

export const FollowPersonResponseSchema = z.object({
  isFollowing: z.boolean(),
  followers: z.number().int().nonnegative(),
})
export type FollowPersonResponse = z.infer<typeof FollowPersonResponseSchema>

export const UserProfileDTOSchema = PersonDTOSchema.extend({
  pastEvents: z.array(CleanupDTOSchema),
  stats: z.object({
    reports: z.number().int().nonnegative(),
    fixed: z.number().int().nonnegative().default(0),
    cleanups: z.number().int().nonnegative(),
  }),
  volunteerHours: z.number().nonnegative().optional(),
  // Present on the viewer's own profile and, when false, on another user's profile alongside an absent
  // `volunteerHours`, which is how the UI tells "hidden" apart from "genuinely zero". Absent means true.
  showVolunteerHours: z.boolean().optional(),
  socialLinks: SocialLinksSchema.nullable().optional(),
  blockedByMe: z.boolean().optional(),
  upcomingEvents: z.array(CleanupDTOSchema).optional(),
  pastEventsCursor: z.string().nullable().optional(),
})
export type UserProfileDTO = z.infer<typeof UserProfileDTOSchema>

export const GetProfileResponseSchema = z.object({
  profile: UserProfileDTOSchema,
})
export type GetProfileResponse = z.infer<typeof GetProfileResponseSchema>

export const ProfileEventsRequestSchema = PaginationQuerySchema.extend({
  id: z.string(),
}).strict()
export type ProfileEventsRequest = z.infer<typeof ProfileEventsRequestSchema>

export const ProfileEventsResponseSchema = pageResponse(CleanupDTOSchema)
export type ProfileEventsResponse = z.infer<typeof ProfileEventsResponseSchema>


export const HANDLE_REGEX = /^[a-zA-Z0-9_]{3,20}$/
export function isValidHandle(handle: string): boolean {
  return HANDLE_REGEX.test(handle.trim())
}
export const HandleSchema = z.string().trim().regex(HANDLE_REGEX)

export const MAX_BIO_LENGTH = 500

export const UpdateProfileRequestSchema = z
  .object({
    handle: HandleSchema,
    displayName: z.string().trim().min(1).max(80),
    bio: z.string().trim().max(MAX_BIO_LENGTH).nullable().optional(),
    avatarUploadId: IdSchema.optional(),
    socialLinks: SocialLinksSchema.nullable().optional(),
    donationUrl: HttpsUrlSchema.nullable().optional(),
  })
  .strict()
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>

export const UpdateProfileResponseSchema = z.object({
  user: UserDTOSchema,
})
export type UpdateProfileResponse = z.infer<typeof UpdateProfileResponseSchema>

export const HandleAvailableRequestSchema = z.object({ handle: z.string() }).strict()
export type HandleAvailableRequest = z.infer<typeof HandleAvailableRequestSchema>

export const HandleAvailableResponseSchema = z.object({
  available: z.boolean(),
  reason: z.enum(["taken", "invalid", "reserved"]).nullable().optional(),
})
export type HandleAvailableResponse = z.infer<typeof HandleAvailableResponseSchema>


/**
 * GET /users/follow-suggestions: people to follow for the signed-in viewer, ranked nearby-first with
 * event hosts ahead of ordinary nearby users. Excludes self, already-followed and blocked users.
 */
export const FollowSuggestionsRequestSchema = z
  .object({
    limit: z.coerce.number().int().positive().max(20).optional(),
  })
  .strict()
export type FollowSuggestionsRequest = z.infer<typeof FollowSuggestionsRequestSchema>

export const FollowSuggestionsResponseSchema = z.object({
  results: z.array(PersonDTOSchema),
})
export type FollowSuggestionsResponse = z.infer<typeof FollowSuggestionsResponseSchema>

export const SearchUsersRequestSchema = z
  .object({
    q: z.string().trim().min(1).max(40),
    limit: z.coerce.number().int().positive().max(20).optional(),
  })
  .strict()
export type SearchUsersRequest = z.infer<typeof SearchUsersRequestSchema>

export const UserSearchResultDTOSchema = z.object({
  id: IdSchema,
  handle: z.string(),
  displayName: z.string(),
  avatar: AvatarPairSchema,
  avatarUrl: z.string().nullable().optional(),
})
export type UserSearchResultDTO = z.infer<typeof UserSearchResultDTOSchema>

export const SearchUsersResponseSchema = z.object({
  results: z.array(UserSearchResultDTOSchema),
})
export type SearchUsersResponse = z.infer<typeof SearchUsersResponseSchema>

export const MentionSearchRequestSchema = z
  .object({
    q: z.string().min(1).max(64),
  })
  .strict()
export type MentionSearchRequest = z.infer<typeof MentionSearchRequestSchema>


export const UpdateSettingsRequestSchema = z
  .object({
    allowDirectMessages: z.boolean().optional(),
    locale: LocaleEnum.optional(),
    // Defaults to true server-side. When false the public profile omits volunteerHours and the
    // per-event breakdown, and the user drops off the jurisdiction leaderboard; the owner still sees them.
    showVolunteerHours: z.boolean().optional(),
    // The organization published as the affiliation badge (DECISIONS §34). Must be one the user belongs
    // to; null falls back to the earliest membership.
    primaryOrganizationId: IdSchema.nullable().optional(),
  })
  .strict()
export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequestSchema>

export const UpdateSettingsResponseSchema = z.object({
  user: UserDTOSchema,
})
export type UpdateSettingsResponse = z.infer<typeof UpdateSettingsResponseSchema>


export const DeleteAccountRequestSchema = z
  .object({
    emailOtp: z.string().regex(/^\d{6}$/),
  })
  .strict()
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>

export const DeleteAccountResponseSchema = z.object({ ok: z.literal(true) })
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>

export const RequestDataExportResponseSchema = z.object({
  ok: z.literal(true),
  email: z.string().email().nullable().optional(),
})
export type RequestDataExportResponse = z.infer<typeof RequestDataExportResponseSchema>


export const BlockUserResponseSchema = z.object({
  blocked: z.boolean(),
})
export type BlockUserResponse = z.infer<typeof BlockUserResponseSchema>

export const ListBlocksResponseSchema = z.object({
  blocked: z.array(PersonDTOSchema),
  // Additive cursor: absent for the last page and ignored by pre-pagination clients.
  nextCursor: z.string().nullable().optional(),
})
export type ListBlocksResponse = z.infer<typeof ListBlocksResponseSchema>

