import { z } from "zod"
import { BroadcastChannelSchema, IdSchema, ISODateSchema } from "../common.js"
import { LeaderboardEntryDTOSchema } from "../entities.js"


export const ANALYTICS_SUPPRESSION_K = 5
export const MAX_PORTFOLIO_TOP_VOLUNTEERS = 5

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

export const MAX_EVENT_ANALYTICS_SERIES_POINTS = 400
export const MAX_EVENT_ANALYTICS_ARRIVAL_BUCKETS = 96
export const MAX_EVENT_ANALYTICS_PANEL_ROWS = 12
export const EVENT_ANALYTICS_CARD_SERIES_POINTS = 30
export const EVENT_ANALYTICS_CARD_SLOT_ROWS = 3
export const EVENT_ANALYTICS_COMPARISON_MIN_EVENTS = 3
export const EVENT_ANALYTICS_COMPARISON_WINDOW = 10

export const EventAnalyticsScopeSchema = z.enum(["card", "full"])
export type EventAnalyticsScope = z.infer<typeof EventAnalyticsScopeSchema>

export const EventAnalyticsPhaseSchema = z.enum([
  "upcoming",
  "day_of",
  "completed",
  "archived",
])
export type EventAnalyticsPhase = z.infer<typeof EventAnalyticsPhaseSchema>

export const GetEventAnalyticsRequestSchema = z
  .object({ id: IdSchema, scope: EventAnalyticsScopeSchema.optional() })
  .strict()
export type GetEventAnalyticsRequest = z.infer<typeof GetEventAnalyticsRequestSchema>

const EventAnalyticsLifecycleSchema = z.object({
  createdAt: ISODateSchema,
  startAt: ISODateSchema.nullable(),
  endAt: ISODateSchema.nullable(),
  completedAt: ISODateSchema.nullable(),
})
export type EventAnalyticsLifecycle = z.infer<typeof EventAnalyticsLifecycleSchema>

const EventAnalyticsKpisSchema = z.object({
  signups: z.number().int().nonnegative().nullable(),
  capacity: z.number().int().nonnegative().nullable(),
  waitlisted: z.number().int().nonnegative().nullable(),
  cancelled: z.number().int().nonnegative().nullable(),
  checkedIn: z.number().int().nonnegative().nullable(),
  noShow: z.number().int().nonnegative().nullable(),
  walkUps: z.number().int().nonnegative().nullable(),
  pageViews: z.number().int().nonnegative().nullable(),
  uniqueViewers: z.number().int().nonnegative().nullable(),
  shares: z.number().int().nonnegative().nullable(),
  donationClicks: z.number().int().nonnegative().nullable(),
  hoursTotal: z.number().nonnegative().nullable(),
  hoursVolunteers: z.number().int().nonnegative().nullable(),
  reportsLinked: z.number().int().nonnegative().nullable(),
  reportsResolved: z.number().int().nonnegative().nullable(),
  postsCreated: z.number().int().nonnegative().nullable(),
})
export type EventAnalyticsKpis = z.infer<typeof EventAnalyticsKpisSchema>

const EventAnalyticsRatesSchema = z.object({
  checkIn: SuppressedRateSchema,
  noShow: SuppressedRateSchema,
  fill: SuppressedRateSchema,
  viewToSignup: SuppressedRateSchema,
  waitlistConversion: SuppressedRateSchema,
})
export type EventAnalyticsRates = z.infer<typeof EventAnalyticsRatesSchema>

const EventAnalyticsDeltasSchema = z.object({
  signups7d: z.number().int().nullable(),
  views7d: z.number().int().nullable(),
})
export type EventAnalyticsDeltas = z.infer<typeof EventAnalyticsDeltasSchema>

const EventAnalyticsSignupsSchema = z.object({
  cumulative: z.array(SeriesPointSchema).max(MAX_EVENT_ANALYTICS_SERIES_POINTS).default([]),
  daily: z.array(SeriesPointSchema).max(MAX_EVENT_ANALYTICS_SERIES_POINTS).default([]),
  cancellations: z.array(SeriesPointSchema).max(MAX_EVENT_ANALYTICS_SERIES_POINTS).default([]),
  bySlot: PanelSchema.optional(),
  bySource: PanelSchema.optional(),
})
export type EventAnalyticsSignups = z.infer<typeof EventAnalyticsSignupsSchema>

const EventAnalyticsReachSchema = z.object({
  viewsDaily: z.array(SeriesPointSchema).max(MAX_EVENT_ANALYTICS_SERIES_POINTS).default([]),
  funnel: z.array(FunnelStepSchema).default([]),
})
export type EventAnalyticsReach = z.infer<typeof EventAnalyticsReachSchema>

const EventAnalyticsEventDaySchema = z.object({
  arrivals: z.array(SeriesPointSchema).max(MAX_EVENT_ANALYTICS_ARRIVAL_BUCKETS).default([]),
  bySlot: PanelSchema.optional(),
})
export type EventAnalyticsEventDay = z.infer<typeof EventAnalyticsEventDaySchema>

const EventAnalyticsImpactSchema = z.object({
  hoursBuckets: PanelSchema.optional(),
  reportStatuses: PanelSchema.optional(),
})
export type EventAnalyticsImpact = z.infer<typeof EventAnalyticsImpactSchema>

const EventAnalyticsComparisonSchema = z.object({
  sampleSize: z.number().int().nonnegative(),
  medians: z.object({
    signups: z.number().nonnegative().nullable(),
    checkInRate: z.number().nonnegative().nullable(),
    hoursPerVolunteer: z.number().nonnegative().nullable(),
    fillRate: z.number().nonnegative().nullable(),
  }),
})
export type EventAnalyticsComparison = z.infer<typeof EventAnalyticsComparisonSchema>

const GetEventAnalyticsObjectSchema = z.object({
  generatedAt: ISODateSchema,
  k: AnalyticsEnvelopeFields.k,
  scope: EventAnalyticsScopeSchema,
  phase: EventAnalyticsPhaseSchema,
  lifecycle: EventAnalyticsLifecycleSchema,
  kpis: EventAnalyticsKpisSchema,
  rates: EventAnalyticsRatesSchema,
  deltas: EventAnalyticsDeltasSchema,
  signups: EventAnalyticsSignupsSchema,
  reach: EventAnalyticsReachSchema,
  eventDay: EventAnalyticsEventDaySchema,
  impact: EventAnalyticsImpactSchema,
  comparison: EventAnalyticsComparisonSchema.nullable().optional(),
})
export type GetEventAnalyticsResponse = z.infer<typeof GetEventAnalyticsObjectSchema>

export const GetEventAnalyticsResponseSchema: z.ZodType<
  GetEventAnalyticsResponse,
  z.ZodTypeDef,
  unknown
> = GetEventAnalyticsObjectSchema

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
  k: AnalyticsEnvelopeFields.k,
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
  totalHours: z.number().nonnegative().optional(),
  volunteersCredited: z.number().int().nonnegative().optional(),
  topVolunteers: z.array(LeaderboardEntryDTOSchema).max(MAX_PORTFOLIO_TOP_VOLUNTEERS).default([]),
})
export type HostedEventsAnalyticsResponse = z.infer<typeof HostedEventsAnalyticsObjectSchema>

export const HostedEventsAnalyticsResponseSchema: z.ZodType<
  HostedEventsAnalyticsResponse,
  z.ZodTypeDef,
  unknown
> = HostedEventsAnalyticsObjectSchema

export const HostAnalyticsSummaryRequestSchema = z
  .object({
    range: AnalyticsRangeSchema.optional(),
    orgId: IdSchema.optional(),
  })
  .strict()
export type HostAnalyticsSummaryRequest = z.infer<typeof HostAnalyticsSummaryRequestSchema>

export const MAX_HOST_SUMMARY_SERIES_POINTS = 365
export const MAX_HOST_SUMMARY_EVENT_ROWS = 12

const HostAnalyticsSummaryWindowSchema = z.object({
  from: z.string(),
  to: z.string(),
})
export type HostAnalyticsSummaryWindow = z.infer<typeof HostAnalyticsSummaryWindowSchema>

const HostAnalyticsSummaryActivitySchema = z.object({
  signups: z.number().int().nonnegative(),
  cancellations: z.number().int().nonnegative(),
  hoursTotal: z.number().nonnegative(),
  hoursVolunteers: z.number().int().nonnegative(),
  reportsLinked: z.number().int().nonnegative(),
  reportsResolved: z.number().int().nonnegative(),
  postsCreated: z.number().int().nonnegative(),
  donationClicks: z.number().int().nonnegative(),
})
export type HostAnalyticsSummaryActivity = z.infer<typeof HostAnalyticsSummaryActivitySchema>

const HostAnalyticsSummaryEventsHeldSchema = z.object({
  count: z.number().int().nonnegative(),
  registered: z.number().int().nonnegative(),
  checkIns: z.number().int().nonnegative(),
  noShows: z.number().int().nonnegative(),
  checkInRate: SuppressedRateSchema,
})
export type HostAnalyticsSummaryEventsHeld = z.infer<typeof HostAnalyticsSummaryEventsHeldSchema>

const HostSummaryEventPanelSchema = PanelSchema.extend({
  rows: z.array(BreakdownRowSchema).max(MAX_HOST_SUMMARY_EVENT_ROWS).default([]),
})

const HostAnalyticsSummaryObjectSchema = z.object({
  generatedAt: ISODateSchema,
  range: AnalyticsRangeSchema.default("30d"),
  k: AnalyticsEnvelopeFields.k,
  window: HostAnalyticsSummaryWindowSchema,
  activity: HostAnalyticsSummaryActivitySchema,
  eventsHeld: HostAnalyticsSummaryEventsHeldSchema,
  totals: z.object({
    events: z.number().int().nonnegative(),
  }),
  signupsDaily: z.array(SeriesPointSchema).max(MAX_HOST_SUMMARY_SERIES_POINTS).default([]),
  byEvent: HostSummaryEventPanelSchema,
  hoursByEvent: HostSummaryEventPanelSchema,
})
export type HostAnalyticsSummaryResponse = z.infer<typeof HostAnalyticsSummaryObjectSchema>

export const HostAnalyticsSummaryResponseSchema: z.ZodType<
  HostAnalyticsSummaryResponse,
  z.ZodTypeDef,
  unknown
> = HostAnalyticsSummaryObjectSchema
