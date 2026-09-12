import { z } from "zod"
import {
  BroadcastKindSchema,
  IdSchema,
  ISODateSchema,
  RegistrationSourceSchema,
} from "../common.js"
import { CleanupStatusSchema } from "../entities.js"


export const MAX_INSIGHTS_TREND_DAYS = 400
export const MAX_INSIGHTS_TICKET_TYPES = 50
export const MAX_INSIGHTS_BROADCASTS = 50
export const MAX_INSIGHTS_ARRIVAL_BUCKETS = 96

export const EventPhaseSchema = z.enum(["upcoming", "live", "ended", "cancelled"])
export type EventPhase = z.infer<typeof EventPhaseSchema>

export const SeatPointSchema = z.object({
  day: z.string(),
  seats: z.number().int(),
})
export type SeatPoint = z.infer<typeof SeatPointSchema>

export const ArrivalOffsetBucketSchema = z.object({
  offsetMin: z.number().int(),
  seats: z.number().int().nonnegative(),
})
export type ArrivalOffsetBucket = z.infer<typeof ArrivalOffsetBucketSchema>

export const InsightsTicketTypeSchema = z.object({
  ticketTypeId: IdSchema,
  name: z.string(),
  registered: z.number().int().nonnegative(),
  capacity: z.number().int().nonnegative().nullable(),
  waitlisted: z.number().int().nonnegative(),
  checkedIn: z.number().int().nonnegative(),
})
export type InsightsTicketType = z.infer<typeof InsightsTicketTypeSchema>

export const InsightsSourceCountSchema = z.object({
  source: RegistrationSourceSchema,
  seats: z.number().int().nonnegative(),
})
export type InsightsSourceCount = z.infer<typeof InsightsSourceCountSchema>

export const InsightsBroadcastSchema = z.object({
  id: IdSchema,
  kind: BroadcastKindSchema,
  finishedAt: ISODateSchema.nullable(),
  recipients: z.number().int().nonnegative(),
  sent: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  suppressed: z.number().int().nonnegative(),
})
export type InsightsBroadcast = z.infer<typeof InsightsBroadcastSchema>

export const EventInsightsClockSchema = z.object({
  status: CleanupStatusSchema,
  startsAt: ISODateSchema,
  endsAt: ISODateSchema.nullable(),
  completedAt: ISODateSchema.nullable(),
  registrationClosesAt: ISODateSchema.nullable(),
  timezone: z.string(),
})
export type EventInsightsClock = z.infer<typeof EventInsightsClockSchema>

export const EventInsightsSeatsSchema = z.object({
  registered: z.number().int().nonnegative(),
  capacity: z.number().int().nonnegative().nullable(),
  waitlisted: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  checkedIn: z.number().int().nonnegative(),
  noShow: z.number().int().nonnegative(),
  unmarked: z.number().int().nonnegative(),
})
export type EventInsightsSeats = z.infer<typeof EventInsightsSeatsSchema>

export const EventInsightsHoursSchema = z.object({
  credited: z.number().nonnegative(),
  attendeesCredited: z.number().int().nonnegative(),
  attendeesCheckedIn: z.number().int().nonnegative(),
})
export type EventInsightsHours = z.infer<typeof EventInsightsHoursSchema>

export const EventInsightsMoneySchema = z.object({
  currency: z.literal("USD"),
  donationCount: z.number().int().nonnegative(),
  grossMinor: z.number().int().nonnegative(),
  netMinor: z.number().int(),
  refundedMinor: z.number().int().nonnegative(),
  lastChargedAt: ISODateSchema.nullable(),
})
export type EventInsightsMoney = z.infer<typeof EventInsightsMoneySchema>

export const EventInsightsReturningSchema = z.object({
  seats: z.number().int().nonnegative(),
  ofRegistered: z.number().int().nonnegative(),
})
export type EventInsightsReturning = z.infer<typeof EventInsightsReturningSchema>

const EventInsightsObjectSchema = z.object({
  generatedAt: ISODateSchema,
  phase: EventPhaseSchema,
  clock: EventInsightsClockSchema,
  seats: EventInsightsSeatsSchema,
  registrationTrend: z.array(SeatPointSchema).max(MAX_INSIGHTS_TREND_DAYS).default([]),
  byTicketType: z.array(InsightsTicketTypeSchema).max(MAX_INSIGHTS_TICKET_TYPES).default([]),
  bySource: z.array(InsightsSourceCountSchema).default([]),
  broadcasts: z.array(InsightsBroadcastSchema).max(MAX_INSIGHTS_BROADCASTS).default([]),
  arrivals: z.array(ArrivalOffsetBucketSchema).max(MAX_INSIGHTS_ARRIVAL_BUCKETS).default([]),
  hours: EventInsightsHoursSchema,
  money: EventInsightsMoneySchema.nullable(),
  returning: EventInsightsReturningSchema.nullable(),
})
export type EventInsights = z.infer<typeof EventInsightsObjectSchema>

export const EventInsightsSchema: z.ZodType<EventInsights, z.ZodTypeDef, unknown> =
  EventInsightsObjectSchema

export const GetEventInsightsRequestSchema = z.object({ id: IdSchema }).strict()
export type GetEventInsightsRequest = z.infer<typeof GetEventInsightsRequestSchema>

export const GetEventInsightsResponseSchema: z.ZodType<EventInsights, z.ZodTypeDef, unknown> =
  EventInsightsObjectSchema
export type GetEventInsightsResponse = EventInsights
