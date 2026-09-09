import { z } from "zod"
import { BroadcastChannelSchema, IdSchema, ISODateSchema } from "../common.js"


export const ANALYTICS_SUPPRESSION_K = 5

export const AnalyticsRangeSchema = z.enum(["7d", "30d", "90d", "all"])
export type AnalyticsRange = z.infer<typeof AnalyticsRangeSchema>

export const PortfolioAnalyticsRangeSchema = z.enum(["30d", "90d", "365d", "all"])
export type PortfolioAnalyticsRange = z.infer<typeof PortfolioAnalyticsRangeSchema>

export const SeriesPointSchema = z.object({
  day: z.string(),
  value: z.number().int().nonnegative().nullable(),
  suppressed: z.boolean().default(false),
})
export type SeriesPoint = z.infer<typeof SeriesPointSchema>

export const BreakdownRowSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number().int().nonnegative().nullable(),
  suppressed: z.boolean().default(false),
})
export type BreakdownRow = z.infer<typeof BreakdownRowSchema>

export const PanelSchema = z.object({
  panelSuppressed: z.boolean().default(false),
  rows: z.array(BreakdownRowSchema).default([]),
})
export type Panel = z.infer<typeof PanelSchema>

export const SuppressedRateSchema = z.object({
  value: z.number().nullable(),
  numerator: z.number().int().nonnegative().nullable(),
  denominator: z.number().int().nonnegative().nullable(),
  suppressed: z.boolean().default(false),
})
export type SuppressedRate = z.infer<typeof SuppressedRateSchema>

export const FunnelStepSchema = z.object({
  step: z.string(),
  label: z.string(),
  value: z.number().int().nonnegative().nullable(),
  suppressed: z.boolean().default(false),
})
export type FunnelStep = z.infer<typeof FunnelStepSchema>

const AnalyticsEnvelopeFields = {
  generatedAt: ISODateSchema,
  range: AnalyticsRangeSchema,
  k: z.number().int().positive().default(ANALYTICS_SUPPRESSION_K),
} as const

export const EventAnalyticsRequestSchema = z
  .object({ id: IdSchema, range: AnalyticsRangeSchema.optional() })
  .strict()
export type EventAnalyticsRequest = z.infer<typeof EventAnalyticsRequestSchema>

const EventAnalyticsOverviewObjectSchema = z.object({
  ...AnalyticsEnvelopeFields,
  kpis: z.object({
    registered: z.number().int().nonnegative().nullable(),
    checkedIn: z.number().int().nonnegative().nullable(),
    waitlisted: z.number().int().nonnegative().nullable(),
    cancelled: z.number().int().nonnegative().nullable(),
    noShow: z.number().int().nonnegative().nullable(),
    capacity: z.number().int().nonnegative().nullable(),
    pageViews: z.number().int().nonnegative().nullable(),
    donationClicks: z.number().int().nonnegative().nullable(),
  }),
  checkInRate: SuppressedRateSchema,
  noShowRate: SuppressedRateSchema,
  capacityUtilization: SuppressedRateSchema,
  funnel: z.array(FunnelStepSchema).default([]),
})
export type EventAnalyticsOverviewResponse = z.infer<typeof EventAnalyticsOverviewObjectSchema>

export const EventAnalyticsOverviewResponseSchema: z.ZodType<
  EventAnalyticsOverviewResponse,
  z.ZodTypeDef,
  unknown
> = EventAnalyticsOverviewObjectSchema

const EventAnalyticsRegistrationsObjectSchema = z.object({
  ...AnalyticsEnvelopeFields,
  series: z.array(SeriesPointSchema).default([]),
  cumulative: z.array(SeriesPointSchema).default([]),
  byTicketType: PanelSchema,
  byAudience: PanelSchema,
  cancellations: z.array(SeriesPointSchema).default([]),
  waitlistConversion: SuppressedRateSchema,
})
export type EventAnalyticsRegistrationsResponse = z.infer<
  typeof EventAnalyticsRegistrationsObjectSchema
>

export const EventAnalyticsRegistrationsResponseSchema: z.ZodType<
  EventAnalyticsRegistrationsResponse,
  z.ZodTypeDef,
  unknown
> = EventAnalyticsRegistrationsObjectSchema

const EventAnalyticsCheckinsObjectSchema = z.object({
  ...AnalyticsEnvelopeFields,
  arrivals: z.array(SeriesPointSchema).default([]),
  checkInRate: SuppressedRateSchema,
  noShowRate: SuppressedRateSchema,
  byTicketType: PanelSchema,
  bySlot: PanelSchema,
})
export type EventAnalyticsCheckinsResponse = z.infer<typeof EventAnalyticsCheckinsObjectSchema>

export const EventAnalyticsCheckinsResponseSchema: z.ZodType<
  EventAnalyticsCheckinsResponse,
  z.ZodTypeDef,
  unknown
> = EventAnalyticsCheckinsObjectSchema

export const BroadcastChannelStatsSchema = z.object({
  channel: BroadcastChannelSchema,
  sent: z.number().int().nonnegative().nullable(),
  failed: z.number().int().nonnegative().nullable(),
  suppressed: z.number().int().nonnegative().nullable(),
})
export type BroadcastChannelStats = z.infer<typeof BroadcastChannelStatsSchema>

const EventAnalyticsBroadcastsObjectSchema = z.object({
  ...AnalyticsEnvelopeFields,
  broadcastsSent: z.number().int().nonnegative().nullable(),
  recipients: z.number().int().nonnegative().nullable(),
  unsubscribes: z.number().int().nonnegative().nullable(),
  byChannel: z.array(BroadcastChannelStatsSchema).default([]),
  series: z.array(SeriesPointSchema).default([]),
})
export type EventAnalyticsBroadcastsResponse = z.infer<
  typeof EventAnalyticsBroadcastsObjectSchema
>

export const EventAnalyticsBroadcastsResponseSchema: z.ZodType<
  EventAnalyticsBroadcastsResponse,
  z.ZodTypeDef,
  unknown
> = EventAnalyticsBroadcastsObjectSchema

const EventAnalyticsSourcesObjectSchema = z.object({
  ...AnalyticsEnvelopeFields,
  pageViews: z.array(SeriesPointSchema).default([]),
  bySource: PanelSchema,
  donationClicks: z.number().int().nonnegative().nullable(),
})
export type EventAnalyticsSourcesResponse = z.infer<typeof EventAnalyticsSourcesObjectSchema>

export const EventAnalyticsSourcesResponseSchema: z.ZodType<
  EventAnalyticsSourcesResponse,
  z.ZodTypeDef,
  unknown
> = EventAnalyticsSourcesObjectSchema

export const HostedEventsAnalyticsRequestSchema = z
  .object({
    range: PortfolioAnalyticsRangeSchema.optional(),
    orgId: IdSchema.optional(),
  })
  .strict()
export type HostedEventsAnalyticsRequest = z.infer<typeof HostedEventsAnalyticsRequestSchema>

export const BestDayTimeSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  value: z.number().int().nonnegative().nullable(),
  suppressed: z.boolean().default(false),
})
export type BestDayTime = z.infer<typeof BestDayTimeSchema>

const HostedEventsAnalyticsObjectSchema = z.object({
  generatedAt: ISODateSchema,
  range: PortfolioAnalyticsRangeSchema,
  k: z.number().int().positive().default(ANALYTICS_SUPPRESSION_K),
  totals: z.object({
    events: z.number().int().nonnegative().nullable(),
    registrations: z.number().int().nonnegative().nullable(),
    checkIns: z.number().int().nonnegative().nullable(),
    uniqueAttendees: z.number().int().nonnegative().nullable(),
  }),
  series: z.array(SeriesPointSchema).default([]),
  byEvent: PanelSchema,
  repeatAttendance: SuppressedRateSchema,
  averageCheckInRate: SuppressedRateSchema,
  bestDayTime: BestDayTimeSchema.nullable(),
})
export type HostedEventsAnalyticsResponse = z.infer<typeof HostedEventsAnalyticsObjectSchema>

export const HostedEventsAnalyticsResponseSchema: z.ZodType<
  HostedEventsAnalyticsResponse,
  z.ZodTypeDef,
  unknown
> = HostedEventsAnalyticsObjectSchema
