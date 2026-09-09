import { z } from "zod"
import {
  ConsentSurfaceSchema,
  IdSchema,
  ISODateSchema,
  PaginationQuerySchema,
} from "../common.js"
import { EventAnswerDTOSchema, EventRegistrationDTOSchema } from "../entities.js"
import { AccessCodeSchema, MAX_PARTY_SIZE } from "./tickets.js"
import { EventAnswerInputSchema } from "./questions.js"


export {
  EventRegistrationDTOSchema,
  EventSeatDTOSchema,
  EventAnswerDTOSchema,
  RegistrantKindSchema,
  MyEventRegistrationRefSchema,
} from "../entities.js"
export type {
  EventRegistrationDTO,
  EventSeatDTO,
  EventAnswerDTO,
  RegistrantKind,
  MyEventRegistrationRef,
} from "../entities.js"
export { RegistrationSourceSchema, RegistrationStatusSchema, SeatStatusSchema } from "../common.js"
export type { RegistrationSource, RegistrationStatus, SeatStatus } from "../common.js"

export const MAX_ATTENDEE_NAME = 80
export const MAX_HOST_NOTE = 1000

export const EventConsentInputSchema = z
  .object({
    termsVersion: z.string().min(1).max(32),
    disclosureVersion: z.string().min(1).max(32),
    hostContactOptIn: z.boolean(),
    smsOptIn: z.boolean().optional(),
    surface: ConsentSurfaceSchema.optional(),
  })
  .strict()
export type EventConsentInput = z.infer<typeof EventConsentInputSchema>

export const RegisterOutcomeSchema = z.enum([
  "registered",
  "replayed",
  "already_registered",
  "waitlisted",
  "full",
  "party_too_large",
  "sales_closed",
  "registration_closed",
  "ticket_type_not_found",
  "access_code_required",
  "access_code_invalid",
  "answers_invalid",
  "banned",
  "closed",
  "not_found",
])
export type RegisterOutcome = z.infer<typeof RegisterOutcomeSchema>

export const RegisterForEventRequestSchema = z
  .object({
    id: IdSchema,
    idempotencyKey: z.string().min(8).max(128),
    ticketTypeId: IdSchema.optional(),
    partySize: z.number().int().min(1).max(MAX_PARTY_SIZE).default(1),
    attendeeNames: z.array(z.string().trim().min(1).max(MAX_ATTENDEE_NAME)).max(MAX_PARTY_SIZE).optional(),
    accessCode: AccessCodeSchema.optional(),
    answers: z.array(EventAnswerInputSchema).max(20).optional(),
    consent: EventConsentInputSchema.optional(),
    slotId: IdSchema.nullable().optional(),
    joinWaitlistIfFull: z.boolean().default(false),
  })
  .strict()
export type RegisterForEventRequest = z.infer<typeof RegisterForEventRequestSchema>

const RegisterForEventResponseObjectSchema = z.object({
  outcome: RegisterOutcomeSchema,
  registration: EventRegistrationDTOSchema.nullable(),
  ticketTokens: z.array(z.string()).default([]),
  waitlistPosition: z.number().int().positive().nullable().optional(),
  going: z.number().int().nonnegative().optional(),
  fields: z.record(z.string()).optional(),
})
export type RegisterForEventResponse = z.infer<typeof RegisterForEventResponseObjectSchema>
export const RegisterForEventResponseSchema: z.ZodType<RegisterForEventResponse, z.ZodTypeDef, unknown> =
  RegisterForEventResponseObjectSchema

export const RegistrationRosterFilterSchema = z.enum([
  "all",
  "registered",
  "waitlisted",
  "cancelled",
  "checked_in",
  "not_checked_in",
  "no_show",
  "guests",
  "members",
])
export type RegistrationRosterFilter = z.infer<typeof RegistrationRosterFilterSchema>

export const RegistrationRosterSortSchema = z.enum([
  "registered_at_desc",
  "registered_at_asc",
  "name_asc",
  "checked_in_at_desc",
])
export type RegistrationRosterSort = z.infer<typeof RegistrationRosterSortSchema>

export const ListEventRegistrationsRequestSchema = PaginationQuerySchema.extend({
  id: IdSchema,
  filter: RegistrationRosterFilterSchema.optional(),
  ticketTypeId: IdSchema.optional(),
  slotId: IdSchema.optional(),
  sort: RegistrationRosterSortSchema.optional(),
  q: z.string().trim().max(120).optional(),
}).strict()
export type ListEventRegistrationsRequest = z.infer<typeof ListEventRegistrationsRequestSchema>

const ListEventRegistrationsResponseObjectSchema = z.object({
  items: z.array(EventRegistrationDTOSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative().optional(),
})
export type ListEventRegistrationsResponse = z.infer<typeof ListEventRegistrationsResponseObjectSchema>
export const ListEventRegistrationsResponseSchema: z.ZodType<ListEventRegistrationsResponse, z.ZodTypeDef, unknown> =
  ListEventRegistrationsResponseObjectSchema

export const GetEventRegistrationRequestSchema = z
  .object({ id: IdSchema, registrationId: IdSchema })
  .strict()
export type GetEventRegistrationRequest = z.infer<typeof GetEventRegistrationRequestSchema>

export const GetEventRegistrationResponseSchema = EventRegistrationDTOSchema
export type GetEventRegistrationResponse = z.infer<typeof GetEventRegistrationResponseSchema>

export const CancelEventRegistrationRequestSchema = z
  .object({
    id: IdSchema,
    registrationId: IdSchema,
    reason: z.string().max(500).optional(),
  })
  .strict()
export type CancelEventRegistrationRequest = z.infer<typeof CancelEventRegistrationRequestSchema>

const CancelEventRegistrationResponseObjectSchema = z.object({
  ok: z.literal(true),
  registration: EventRegistrationDTOSchema.nullable(),
})
export type CancelEventRegistrationResponse = z.infer<typeof CancelEventRegistrationResponseObjectSchema>
export const CancelEventRegistrationResponseSchema: z.ZodType<CancelEventRegistrationResponse, z.ZodTypeDef, unknown> =
  CancelEventRegistrationResponseObjectSchema

export const RemoveEventRegistrationRequestSchema = z
  .object({
    id: IdSchema,
    registrationId: IdSchema,
    ban: z.boolean().default(false),
    reason: z.string().max(500).optional(),
  })
  .strict()
export type RemoveEventRegistrationRequest = z.infer<typeof RemoveEventRegistrationRequestSchema>

const RemoveEventRegistrationResponseObjectSchema = z.object({ ok: z.literal(true) })
export type RemoveEventRegistrationResponse = z.infer<typeof RemoveEventRegistrationResponseObjectSchema>
export const RemoveEventRegistrationResponseSchema: z.ZodType<RemoveEventRegistrationResponse, z.ZodTypeDef, unknown> =
  RemoveEventRegistrationResponseObjectSchema

export const TransferEventRegistrationRequestSchema = z
  .object({
    id: IdSchema,
    registrationId: IdSchema,
    ticketTypeId: IdSchema,
  })
  .strict()
export type TransferEventRegistrationRequest = z.infer<
  typeof TransferEventRegistrationRequestSchema
>

export const TransferEventRegistrationResponseSchema = z.object({
  ok: z.literal(true),
  registration: EventRegistrationDTOSchema,
})
export type TransferEventRegistrationResponse = z.infer<
  typeof TransferEventRegistrationResponseSchema
>

export const CreateWalkupRegistrationRequestSchema = z
  .object({
    id: IdSchema,
    ticketTypeId: IdSchema.optional(),
    name: z.string().trim().min(1).max(MAX_ATTENDEE_NAME),
    partySize: z.number().int().min(1).max(MAX_PARTY_SIZE).default(1),
    checkInNow: z.boolean().default(true),
  })
  .strict()
export type CreateWalkupRegistrationRequest = z.infer<typeof CreateWalkupRegistrationRequestSchema>

export const CreateWalkupRegistrationResponseSchema = z.object({
  outcome: RegisterOutcomeSchema,
  registration: EventRegistrationDTOSchema.nullable(),
})
export type CreateWalkupRegistrationResponse = z.infer<
  typeof CreateWalkupRegistrationResponseSchema
>

export const SetEventRegistrationNoteRequestSchema = z
  .object({
    id: IdSchema,
    registrationId: IdSchema,
    note: z.string().max(MAX_HOST_NOTE).nullable(),
  })
  .strict()
export type SetEventRegistrationNoteRequest = z.infer<typeof SetEventRegistrationNoteRequestSchema>

export const SetEventRegistrationNoteResponseSchema = z.object({ ok: z.literal(true) })
export type SetEventRegistrationNoteResponse = z.infer<
  typeof SetEventRegistrationNoteResponseSchema
>

export const GetEventRegistrationAnswersRequestSchema = z
  .object({ id: IdSchema, registrationId: IdSchema })
  .strict()
export type GetEventRegistrationAnswersRequest = z.infer<
  typeof GetEventRegistrationAnswersRequestSchema
>

export const GetEventRegistrationAnswersResponseSchema = z.object({
  answers: z.array(EventAnswerDTOSchema),
  scrubbedAt: ISODateSchema.nullable().optional(),
})
export type GetEventRegistrationAnswersResponse = z.infer<
  typeof GetEventRegistrationAnswersResponseSchema
>
