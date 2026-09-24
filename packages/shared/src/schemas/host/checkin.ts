import { z } from "zod"
import {
  CheckinMethodSchema,
  IdSchema,
  ISODateSchema,
  RegistrationStatusSchema,
} from "../common.js"
import { EventRegistrationDTOSchema, EventSeatDTOSchema } from "../entities.js"
import { GuestManageTokenSchema } from "../internal-fields.js"
import { TICKET_TOKEN_MAX, TICKET_TOKEN_MIN } from "./ticket-token.js"

export { CheckinMethodSchema } from "../common.js"
export type { CheckinMethod } from "../common.js"

export { TICKET_TOKEN_MAX, TICKET_TOKEN_MIN } from "./ticket-token.js"
export const TicketTokenSchema = z.string().trim().min(TICKET_TOKEN_MIN).max(TICKET_TOKEN_MAX)

export const MyEventTicketSeatSchema = z.object({
  id: IdSchema,
  seatIndex: z.number().int().nonnegative(),
  ticketToken: z.string(),
  holderName: z.string().nullable().optional(),
  checkedInAt: ISODateSchema.nullable().optional(),
})
export type MyEventTicketSeat = z.infer<typeof MyEventTicketSeatSchema>

const MyEventTicketDTOObjectSchema = z.object({
  cleanupId: IdSchema,
  title: z.string(),
  startsAt: ISODateSchema,
  endsAt: ISODateSchema.nullable().optional(),
  timezone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  registrationId: IdSchema,
  ticketTypeName: z.string().nullable().optional(),
  status: RegistrationStatusSchema,
  waitlistPosition: z.number().int().positive().nullable().optional(),
  seats: z.array(MyEventTicketSeatSchema).default([]),
  canCancel: z.boolean().default(true),
  icsUrl: z.string().nullable().optional(),
})
export type MyEventTicketDTO = z.infer<typeof MyEventTicketDTOObjectSchema>
export const MyEventTicketDTOSchema: z.ZodType<MyEventTicketDTO, z.ZodTypeDef, unknown> =
  MyEventTicketDTOObjectSchema

export const GetMyEventTicketRequestSchema = z.object({ id: IdSchema }).strict()
export type GetMyEventTicketRequest = z.infer<typeof GetMyEventTicketRequestSchema>

export const GetMyEventTicketResponseSchema = MyEventTicketDTOSchema
export type GetMyEventTicketResponse = z.infer<typeof GetMyEventTicketResponseSchema>

export const GetGuestEventTicketRequestSchema = z
  .object({
    token: GuestManageTokenSchema,
  })
  .strict()
export type GetGuestEventTicketRequest = z.infer<typeof GetGuestEventTicketRequestSchema>

export const GetGuestEventTicketResponseSchema = MyEventTicketDTOSchema
export type GetGuestEventTicketResponse = z.infer<typeof GetGuestEventTicketResponseSchema>

export const CheckinOutcomeSchema = z.enum([
  "checked_in",
  "already",
  "cancelled",
  "no_show",
  "wrong_event",
  "waitlisted",
  "unknown_token",
])
export type CheckinOutcome = z.infer<typeof CheckinOutcomeSchema>

const CheckinResultDTOObjectSchema = z.object({
  outcome: CheckinOutcomeSchema,
  firstTime: z.boolean().default(false),
  seat: EventSeatDTOSchema.nullable(),
  registration: EventRegistrationDTOSchema.nullable(),
  attendeeName: z.string().nullable().optional(),
  ticketTypeName: z.string().nullable().optional(),
  partySize: z.number().int().positive().nullable().optional(),
  checkedInAt: ISODateSchema.nullable().optional(),
})
export type CheckinResultDTO = z.infer<typeof CheckinResultDTOObjectSchema>
export const CheckinResultDTOSchema: z.ZodType<CheckinResultDTO, z.ZodTypeDef, unknown> =
  CheckinResultDTOObjectSchema

export const ScanEventTicketRequestSchema = z
  .object({
    id: IdSchema,
    token: TicketTokenSchema,
    scannedAt: ISODateSchema.optional(),
  })
  .strict()
export type ScanEventTicketRequest = z.infer<typeof ScanEventTicketRequestSchema>

export const ScanEventTicketResponseSchema = CheckinResultDTOSchema
export type ScanEventTicketResponse = z.infer<typeof ScanEventTicketResponseSchema>

export const CheckInEventSeatRequestSchema = z
  .object({
    id: IdSchema,
    seatId: IdSchema,
    method: CheckinMethodSchema.default("manual"),
  })
  .strict()
export type CheckInEventSeatRequest = z.infer<typeof CheckInEventSeatRequestSchema>

export const CheckInEventSeatResponseSchema = CheckinResultDTOSchema
export type CheckInEventSeatResponse = z.infer<typeof CheckInEventSeatResponseSchema>

export const UndoEventCheckInRequestSchema = z.object({ id: IdSchema, seatId: IdSchema }).strict()
export type UndoEventCheckInRequest = z.infer<typeof UndoEventCheckInRequestSchema>

const UndoEventCheckInResponseObjectSchema = z.object({
  ok: z.literal(true),
  seat: EventSeatDTOSchema.nullable(),
})
export type UndoEventCheckInResponse = z.infer<typeof UndoEventCheckInResponseObjectSchema>
export const UndoEventCheckInResponseSchema: z.ZodType<UndoEventCheckInResponse, z.ZodTypeDef, unknown> =
  UndoEventCheckInResponseObjectSchema

export const MarkEventNoShowsRequestSchema = z
  .object({
    id: IdSchema,
    seatIds: z.array(IdSchema).max(500).optional(),
    all: z.boolean().default(false),
  })
  .strict()
export type MarkEventNoShowsRequest = z.infer<typeof MarkEventNoShowsRequestSchema>

const MarkEventNoShowsResponseObjectSchema = z.object({
  ok: z.literal(true),
  marked: z.number().int().nonnegative(),
})
export type MarkEventNoShowsResponse = z.infer<typeof MarkEventNoShowsResponseObjectSchema>
export const MarkEventNoShowsResponseSchema: z.ZodType<MarkEventNoShowsResponse, z.ZodTypeDef, unknown> =
  MarkEventNoShowsResponseObjectSchema

export const CheckinTicketTypeCounterSchema = z.object({
  ticketTypeId: IdSchema,
  name: z.string(),
  registered: z.number().int().nonnegative(),
  checkedIn: z.number().int().nonnegative(),
  waitlisted: z.number().int().nonnegative(),
  capacity: z.number().int().nonnegative().nullable(),
})
export type CheckinTicketTypeCounter = z.infer<typeof CheckinTicketTypeCounterSchema>

export const ArrivalBucketSchema = z.object({
  at: ISODateSchema,
  count: z.number().int().nonnegative(),
})
export type ArrivalBucket = z.infer<typeof ArrivalBucketSchema>

const EventCheckinCountersDTOObjectSchema = z.object({
  registered: z.number().int().nonnegative(),
  checkedIn: z.number().int().nonnegative(),
  waitlisted: z.number().int().nonnegative(),
  noShow: z.number().int().nonnegative().default(0),
  capacity: z.number().int().nonnegative().nullable(),
  byTicketType: z.array(CheckinTicketTypeCounterSchema).default([]),
  arrivals: z.array(ArrivalBucketSchema).default([]),
  asOf: ISODateSchema,
})
export type EventCheckinCountersDTO = z.infer<typeof EventCheckinCountersDTOObjectSchema>
export const EventCheckinCountersDTOSchema: z.ZodType<EventCheckinCountersDTO, z.ZodTypeDef, unknown> =
  EventCheckinCountersDTOObjectSchema

export const GetEventCheckinCountersRequestSchema = z.object({ id: IdSchema }).strict()
export type GetEventCheckinCountersRequest = z.infer<typeof GetEventCheckinCountersRequestSchema>

export const GetEventCheckinCountersResponseSchema = EventCheckinCountersDTOSchema
export type GetEventCheckinCountersResponse = z.infer<typeof GetEventCheckinCountersResponseSchema>
