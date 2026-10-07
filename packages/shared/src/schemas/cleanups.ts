import { z } from "zod"
import {
  IdSchema,
  ISODateSchema,
  LatLngFields,
  LatLngSchema,
  BBoxSchema,
  EMAIL_MAX_LENGTH,
  EventVisibilitySchema,
  PaginationQuerySchema,
  MAX_PARTY_SIZE,
} from "./common.js"
import { OtpCodeSchema } from "./auth.js"
import {
  AttendeeDTOSchema as AttendeeDTOSchemaInternal,
  CleanupDTOSchema,
  CleanupTypeSchema,
  EventAddressSourceSchema,
  EventKindSchema,
  EventRegistrationDTOSchema,
  HostEventEmailSchema,
  HttpsUrlSchema,
} from "./entities.js"
import {
  GuestManageTokenSchema,
  IdempotencyKeySchema,
  OkResponseSchema,
  PageLimitSchema,
  SortOrderInputSchema,
} from "./internal-fields.js"
import { AccessCodeSchema } from "./host/tickets.js"
import { EventAnswerInputSchema, MAX_EVENT_QUESTIONS } from "./host/questions.js"
import { EventConsentInputSchema, RegisterOutcomeSchema } from "./host/registrations.js"
import { PageSlugSchema } from "./host/pages.js"
import { EventTeamRoleSchema } from "./host/team.js"


export { CleanupDTOSchema, CleanupTypeSchema, CleanupStatusSchema } from "./entities.js"
export type { CleanupDTO, CleanupType, CleanupStatus } from "./entities.js"
export { EventKindSchema, EVENT_KIND_VALUES, EVENT_KIND_LABELS } from "./entities.js"
export type { EventKind } from "./entities.js"
export { PersonDTOSchema, AttendeeDTOSchema } from "./entities.js"
export type { PersonDTO, AttendeeDTO } from "./entities.js"
export { CleanupMemberRoleSchema } from "./common.js"
export type { CleanupMemberRole } from "./common.js"

export const MAX_EVENT_SLOTS = 20
export const MAX_SLOT_TITLE = 80
export const MAX_SLOT_DESCRIPTION = 200
export const MAX_SLOT_CAPACITY = 999
export const MIN_SLOT_DURATION_MINUTES = 15
export const MAX_GENERATED_SHIFTS = 4
export const MAX_BRING_ITEMS = 30
export const MAX_LINKED_REPORTS = 200
export const MAX_EVENT_ADDRESS_LENGTH = 200
export const MIN_EVENT_DURATION_MINUTES = 15
export const MAX_EVENT_DURATION_MINUTES = 1440
export const MAX_EVENT_TITLE = 120
export const MAX_EVENT_DESCRIPTION = 2000
export const MAX_EVENT_CANCEL_REASON = 500
export const MAX_EVENT_RESOURCES_MESSAGE = 2000
export { DEFAULT_EVENT_DURATION_MINUTES } from "./event-duration.js"

const EventSlotInputObjectSchema = z
  .object({
    id: IdSchema.optional(),
    title: z.string().trim().min(1).max(MAX_SLOT_TITLE),
    description: z.string().max(MAX_SLOT_DESCRIPTION).nullable().optional(),
    capacity: z.number().int().positive().max(MAX_SLOT_CAPACITY).nullable().optional(),
    sortOrder: SortOrderInputSchema,
    startsAt: ISODateSchema.nullable().optional(),
    endsAt: ISODateSchema.nullable().optional(),
  })
  .strict()

export const EventSlotInputSchema = EventSlotInputObjectSchema.superRefine((slot, ctx) => {
  const starts = slot.startsAt ?? null
  const ends = slot.endsAt ?? null
  if ((starts === null) !== (ends === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [starts === null ? "startsAt" : "endsAt"],
      message: "set both a start and an end, or neither",
    })
    return
  }
  if (starts === null || ends === null) return
  if (Date.parse(ends) - Date.parse(starts) < MIN_SLOT_DURATION_MINUTES * 60_000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAt"],
      message: `must be at least ${MIN_SLOT_DURATION_MINUTES} minutes after startsAt`,
    })
  }
})
export type EventSlotInput = z.infer<typeof EventSlotInputSchema>

export const MAX_EVENT_GALLERY_MEDIA = 12
export const MAX_EVENT_REMINDER_OFFSETS = 3
export const MAX_EVENT_REMINDER_OFFSET_MINUTES = 20160
export const MAX_EVENT_TIMEZONE_LENGTH = 64

export { HostEventEmailSchema } from "./entities.js"

const HostEventFields = {
  endsAt: ISODateSchema.nullable().optional(),
  timezone: z.string().trim().min(1).max(MAX_EVENT_TIMEZONE_LENGTH).nullable().optional(),
  visibility: EventVisibilitySchema.optional(),
  coverMediaId: IdSchema.nullable().optional(),
  galleryMediaIds: z.array(IdSchema).max(MAX_EVENT_GALLERY_MEDIA).optional(),
  donationUrl: HttpsUrlSchema.nullable().optional(),
  pageSlug: PageSlugSchema.nullable().optional(),
  registrationOpensAt: ISODateSchema.nullable().optional(),
  registrationClosesAt: ISODateSchema.nullable().optional(),
  organizationId: IdSchema.nullable().optional(),
  reminderOffsetsMinutes: z
    .array(z.number().int().positive().max(MAX_EVENT_REMINDER_OFFSET_MINUTES))
    .max(MAX_EVENT_REMINDER_OFFSETS)
    .nullable()
    .optional(),
  hostReplyTo: HostEventEmailSchema.nullable().optional(),
} as const

export const CreateCleanupRequestSchema = z
  .object({
    title: z.string().min(1).max(MAX_EVENT_TITLE),
    type: CleanupTypeSchema,
    eventKind: EventKindSchema.default("cleanup"),
    description: z.string().max(MAX_EVENT_DESCRIPTION).optional(),
    ...LatLngFields,
    scheduledAt: ISODateSchema,
    bring: z.array(z.string()).max(MAX_BRING_ITEMS).optional(),
    address: z.string().max(MAX_EVENT_ADDRESS_LENGTH).optional(),
    addressSource: EventAddressSourceSchema.optional(),
    linkedReportIds: z.array(IdSchema).max(MAX_LINKED_REPORTS).optional(),
    slots: z.array(EventSlotInputSchema).max(MAX_EVENT_SLOTS).optional(),
    ...HostEventFields,
    idempotencyKey: IdempotencyKeySchema.optional(),
  })
  .strict()
export type CreateCleanupRequest = z.infer<typeof CreateCleanupRequestSchema>

export const UpdateCleanupRequestSchema = z
  .object({
    id: IdSchema,
    title: z.string().min(1).max(MAX_EVENT_TITLE).optional(),
    description: z.string().max(MAX_EVENT_DESCRIPTION).optional(),
    eventKind: EventKindSchema.optional(),
    type: CleanupTypeSchema.optional(),
    scheduledAt: ISODateSchema.optional(),
    lat: LatLngFields.lat.optional(),
    lng: LatLngFields.lng.optional(),
    address: z.string().max(MAX_EVENT_ADDRESS_LENGTH).optional(),
    addressSource: EventAddressSourceSchema.optional(),
    bring: z.array(z.string()).max(MAX_BRING_ITEMS).optional(),
    linkedReportIds: z.array(IdSchema).max(MAX_LINKED_REPORTS).optional(),
    slots: z.array(EventSlotInputSchema).max(MAX_EVENT_SLOTS).optional(),
    ...HostEventFields,
  })
  .strict()
export type UpdateCleanupRequest = z.infer<typeof UpdateCleanupRequestSchema>

/**
 * POST /cleanups/:id/duplicate (DECISIONS §34). Copies the source event's content into a new draft
 * at `scheduledAt`. The copy resets everything that identifies the original occurrence (page slug,
 * reference code, status, counts) and carries no registrations, team or broadcasts. `id` consumes the
 * path param. Ticket types and registration questions travel with a recurring event; a published
 * event page does not (it has its own slug and analytics), so that flag defaults off.
 */
export const DuplicateCleanupRequestSchema = z
  .object({
    id: IdSchema,
    scheduledAt: ISODateSchema,
    endsAt: ISODateSchema.nullable().optional(),
    includeTicketTypes: z.boolean().default(true),
    includeQuestions: z.boolean().default(true),
    includePage: z.boolean().default(false),
  })
  .strict()
export type DuplicateCleanupRequest = z.infer<typeof DuplicateCleanupRequestSchema>

export const CancelCleanupRequestSchema = z
  .object({
    id: IdSchema,
    reason: z.string().max(MAX_EVENT_CANCEL_REASON).optional(),
  })
  .strict()
export type CancelCleanupRequest = z.infer<typeof CancelCleanupRequestSchema>

export const CompleteCleanupRequestSchema = z
  .object({
    id: IdSchema,
    note: z.string().max(500).optional(),
  })
  .strict()
export type CompleteCleanupRequest = z.infer<typeof CompleteCleanupRequestSchema>

export const ClaimEventSlotRequestSchema = z
  .object({
    id: IdSchema,
    slotId: IdSchema.nullable(),
  })
  .strict()
export type ClaimEventSlotRequest = z.infer<typeof ClaimEventSlotRequestSchema>

export const ListCleanupsRequestSchema = z
  .object({
    bbox: BBoxSchema.optional(),
    near: LatLngSchema.optional(),
    when: z.enum(["upcoming", "past", "attending"]).optional(),
    cursor: z.string().optional(),
    limit: PageLimitSchema,
  })
  .strict()
export type ListCleanupsRequest = z.infer<typeof ListCleanupsRequestSchema>

export const GetCleanupResponseSchema = CleanupDTOSchema
export type GetCleanupResponse = z.infer<typeof GetCleanupResponseSchema>

export const CleanupMembershipResponseSchema = z.object({
  joined: z.boolean(),
  going: z.number().int().nonnegative(),
})

export const JoinCleanupResponseSchema = CleanupMembershipResponseSchema
export type JoinCleanupResponse = z.infer<typeof JoinCleanupResponseSchema>

export const LeaveCleanupResponseSchema = CleanupMembershipResponseSchema
export type LeaveCleanupResponse = z.infer<typeof LeaveCleanupResponseSchema>

export const CleanupAttendeesResponseSchema = z.object({
  attendees: z.array(AttendeeDTOSchemaInternal),
  going: z.number().int().nonnegative(),
  scope: z.enum(["all", "following"]),
})
export type CleanupAttendeesResponse = z.infer<typeof CleanupAttendeesResponseSchema>

export const RequestEventResourcesRequestSchema = z
  .object({
    id: IdSchema,
    message: z.string().min(1).max(MAX_EVENT_RESOURCES_MESSAGE),
  })
  .strict()
export type RequestEventResourcesRequest = z.infer<typeof RequestEventResourcesRequestSchema>

export const RequestEventResourcesResponseSchema = OkResponseSchema
export type RequestEventResourcesResponse = z.infer<typeof RequestEventResourcesResponseSchema>

export const SetMemberRoleRequestSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    role: z.enum([...EventTeamRoleSchema.options, "member"]),
  })
  .strict()
export type SetMemberRoleRequest = z.infer<typeof SetMemberRoleRequestSchema>

export const SetMemberRoleResponseSchema = OkResponseSchema
export type SetMemberRoleResponse = z.infer<typeof SetMemberRoleResponseSchema>

export const RemoveMemberRequestSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
  })
  .strict()
export type RemoveMemberRequest = z.infer<typeof RemoveMemberRequestSchema>

export const RemoveMemberResponseSchema = z.object({
  ok: z.literal(true),
  going: z.number().int().nonnegative(),
})
export type RemoveMemberResponse = z.infer<typeof RemoveMemberResponseSchema>


export const GuestContactChannelSchema = z.enum(["email", "sms"])
export type GuestContactChannel = z.infer<typeof GuestContactChannelSchema>

export const MAX_GUEST_NAME = 80

export { GUEST_MANAGE_TOKEN_MIN_LENGTH, GUEST_MANAGE_TOKEN_MAX_LENGTH } from "./common.js"

export const GUEST_OTP_ERROR_FIELD = "otp"

export const GuestOtpErrorReason = {
  invalidCode: "invalid_code",
  attemptsExhausted: "attempts_exhausted",
  lockedOut: "locked_out",
} as const
export type GuestOtpErrorReason = (typeof GuestOtpErrorReason)[keyof typeof GuestOtpErrorReason]

export const GUEST_REGISTRATION_ERROR_FIELD = "registration"

export const GuestRegistrationRefusalReason = {
  soldOut: "sold_out",
  registrationClosed: "registration_closed",
  salesClosed: "sales_closed",
  eventClosed: "event_closed",
  partyTooLarge: "party_too_large",
  ticketTypeUnavailable: "ticket_type_unavailable",
  accessCodeRequired: "access_code_required",
  accessCodeInvalid: "access_code_invalid",
  answersInvalid: "answers_invalid",
} as const
export type GuestRegistrationRefusalReason =
  (typeof GuestRegistrationRefusalReason)[keyof typeof GuestRegistrationRefusalReason]

export const GuestPhoneSchema = z.string().regex(/^\+1[2-9]\d{9}$/)

const GuestEmailSchema = z.string().email().max(EMAIL_MAX_LENGTH).toLowerCase()

const GuestContactFields = {
  channel: GuestContactChannelSchema,
  email: GuestEmailSchema.optional(),
  phone: GuestPhoneSchema.optional(),
} as const

function refineGuestContact(
  value: { channel: GuestContactChannel; email?: string; phone?: string },
  ctx: z.RefinementCtx,
): void {
  const required = value.channel === "email" ? "email" : "phone"
  const forbidden = value.channel === "email" ? "phone" : "email"
  if (value[required] === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [required],
      message: `${required} is required when channel is "${value.channel}"`,
    })
  }
  if (value[forbidden] !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [forbidden],
      message: `${forbidden} must be absent when channel is "${value.channel}"`,
    })
  }
}

const GuestRegistrationFields = {
  ticketTypeId: IdSchema.optional(),
  partySize: z.number().int().min(1).max(MAX_PARTY_SIZE).optional(),
  accessCode: AccessCodeSchema.optional(),
  answers: z.array(EventAnswerInputSchema).max(MAX_EVENT_QUESTIONS).optional(),
  consent: EventConsentInputSchema.optional(),
} as const

export const GuestRsvpRequestRequestSchema = z
  .object({
    id: IdSchema,
    name: z.string().trim().min(1).max(MAX_GUEST_NAME),
    ...GuestContactFields,
    ...GuestRegistrationFields,
    turnstileToken: z.string().min(1).max(2048),
    website: z.string().optional(),
  })
  .strict()
  .superRefine(refineGuestContact)
export type GuestRsvpRequestRequest = z.infer<typeof GuestRsvpRequestRequestSchema>

export const GuestRsvpRequestResponseSchema = z.object({
  sent: z.literal(true),
  resendAfterSec: z.number().int().nonnegative(),
})
export type GuestRsvpRequestResponse = z.infer<typeof GuestRsvpRequestResponseSchema>

export const GuestRsvpVerifyRequestSchema = z
  .object({
    id: IdSchema,
    ...GuestContactFields,
    ...GuestRegistrationFields,
    code: OtpCodeSchema,
  })
  .strict()
  .superRefine(refineGuestContact)
export type GuestRsvpVerifyRequest = z.infer<typeof GuestRsvpVerifyRequestSchema>

export const GuestRsvpVerifyResponseSchema = z.object({
  joined: z.literal(true),
  going: z.number().int().nonnegative(),
  manageToken: GuestManageTokenSchema,
  registration: EventRegistrationDTOSchema.nullable().optional(),
  registrationOutcome: RegisterOutcomeSchema.nullable().optional(),
  ticketTokens: z.array(z.string()).default([]),
})
export type GuestRsvpVerifyResponse = z.infer<typeof GuestRsvpVerifyResponseSchema>

export const GuestRsvpCancelRequestSchema = z
  .object({
    token: GuestManageTokenSchema,
  })
  .strict()
export type GuestRsvpCancelRequest = z.infer<typeof GuestRsvpCancelRequestSchema>

export const GuestRsvpCancelResponseSchema = OkResponseSchema
export type GuestRsvpCancelResponse = z.infer<typeof GuestRsvpCancelResponseSchema>

export const CleanupGuestDTOSchema = z.object({
  id: IdSchema,
  name: z.string(),
  channel: GuestContactChannelSchema,
  email: z.string().nullable(),
  phone: z.string().nullable(),
  joinedAt: ISODateSchema,
  cancelledAt: ISODateSchema.nullable(),
})
export type CleanupGuestDTO = z.infer<typeof CleanupGuestDTOSchema>

export const GetCleanupGuestsRequestSchema = PaginationQuerySchema.extend({
  id: IdSchema,
}).strict()
export type GetCleanupGuestsRequest = z.infer<typeof GetCleanupGuestsRequestSchema>

export const GetCleanupGuestsResponseSchema = z.object({
  guests: z.array(CleanupGuestDTOSchema),
  count: z.number().int().nonnegative(),
  nextCursor: z.string().nullable().optional(),
})
export type GetCleanupGuestsResponse = z.infer<typeof GetCleanupGuestsResponseSchema>
