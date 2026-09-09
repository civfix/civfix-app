import { z } from "zod"
import {
  IdSchema,
  ISODateSchema,
  LatLngFields,
  LatLngSchema,
  BBoxSchema,
  EventVisibilitySchema,
  PaginationQuerySchema,
} from "./common.js"
import { OtpCodeSchema } from "./auth.js"
import {
  AttendeeDTOSchema as AttendeeDTOSchemaInternal,
  CleanupDTOSchema,
  EventKindSchema,
  EventRegistrationDTOSchema,
  HostEventEmailSchema,
} from "./entities.js"
import { AccessCodeSchema, MAX_PARTY_SIZE } from "./host/tickets.js"
import { EventAnswerInputSchema } from "./host/questions.js"
import { EventConsentInputSchema, RegisterOutcomeSchema } from "./host/registrations.js"
import { HttpsUrlSchema } from "./host/organizations.js"
import { PageSlugSchema } from "./host/pages.js"


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
export const MAX_BRING_ITEMS = 30
export const MAX_LINKED_REPORTS = 200

export const EventSlotInputSchema = z
  .object({
    id: IdSchema.optional(),
    title: z.string().trim().min(1).max(MAX_SLOT_TITLE),
    description: z.string().max(MAX_SLOT_DESCRIPTION).nullable().optional(),
    capacity: z.number().int().positive().max(MAX_SLOT_CAPACITY).nullable().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .strict()
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
    title: z.string().min(1).max(120),
    type: z.enum(["site", "route"]),
    eventKind: EventKindSchema.default("cleanup"),
    description: z.string().max(2000).optional(),
    ...LatLngFields,
    scheduledAt: ISODateSchema,
    bring: z.array(z.string()).max(MAX_BRING_ITEMS).optional(),
    address: z.string().max(200).optional(),
    linkedReportIds: z.array(IdSchema).max(MAX_LINKED_REPORTS).optional(),
    slots: z.array(EventSlotInputSchema).max(MAX_EVENT_SLOTS).optional(),
    ...HostEventFields,
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict()
export type CreateCleanupRequest = z.infer<typeof CreateCleanupRequestSchema>

export const UpdateCleanupRequestSchema = z
  .object({
    id: IdSchema,
    title: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    eventKind: EventKindSchema.optional(),
    type: z.enum(["site", "route"]).optional(),
    scheduledAt: ISODateSchema.optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    address: z.string().max(200).optional(),
    bring: z.array(z.string()).max(MAX_BRING_ITEMS).optional(),
    linkedReportIds: z.array(IdSchema).max(MAX_LINKED_REPORTS).optional(),
    slots: z.array(EventSlotInputSchema).max(MAX_EVENT_SLOTS).optional(),
    ...HostEventFields,
  })
  .strict()
export type UpdateCleanupRequest = z.infer<typeof UpdateCleanupRequestSchema>

export const CancelCleanupRequestSchema = z
  .object({
    id: IdSchema,
    reason: z.string().max(500).optional(),
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
    limit: z.coerce.number().int().positive().max(50).optional(),
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
    message: z.string().min(1).max(2000),
  })
  .strict()
export type RequestEventResourcesRequest = z.infer<typeof RequestEventResourcesRequestSchema>

export const RequestEventResourcesResponseSchema = z.object({ ok: z.literal(true) })
export type RequestEventResourcesResponse = z.infer<typeof RequestEventResourcesResponseSchema>

export const SetMemberRoleRequestSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    role: z.enum(["cohost", "staff", "member"]),
  })
  .strict()
export type SetMemberRoleRequest = z.infer<typeof SetMemberRoleRequestSchema>

export const SetMemberRoleResponseSchema = z.object({ ok: z.literal(true) })
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

export const GUEST_MANAGE_TOKEN_MIN_LENGTH = 20
export const GUEST_MANAGE_TOKEN_MAX_LENGTH = 128

export const GUEST_OTP_ERROR_FIELD = "otp"

export const GuestOtpErrorReason = {
  invalidCode: "invalid_code",
  attemptsExhausted: "attempts_exhausted",
  lockedOut: "locked_out",
} as const
export type GuestOtpErrorReason = (typeof GuestOtpErrorReason)[keyof typeof GuestOtpErrorReason]

export const GuestPhoneSchema = z.string().regex(/^\+1[2-9]\d{9}$/)

const GuestEmailSchema = z.string().email().max(254).toLowerCase()

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
  answers: z.array(EventAnswerInputSchema).max(20).optional(),
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
  manageToken: z.string().min(GUEST_MANAGE_TOKEN_MIN_LENGTH).max(GUEST_MANAGE_TOKEN_MAX_LENGTH),
  registration: EventRegistrationDTOSchema.nullable().optional(),
  registrationOutcome: RegisterOutcomeSchema.nullable().optional(),
  ticketTokens: z.array(z.string()).default([]),
})
export type GuestRsvpVerifyResponse = z.infer<typeof GuestRsvpVerifyResponseSchema>

export const GuestRsvpCancelRequestSchema = z
  .object({
    token: z.string().min(GUEST_MANAGE_TOKEN_MIN_LENGTH).max(GUEST_MANAGE_TOKEN_MAX_LENGTH),
  })
  .strict()
export type GuestRsvpCancelRequest = z.infer<typeof GuestRsvpCancelRequestSchema>

export const GuestRsvpCancelResponseSchema = z.object({ ok: z.literal(true) })
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
