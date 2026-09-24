import { z } from "zod"
import { ReportCategorySchema } from "../common.js"
import { EventKindSchema } from "../entities.js"
import { AdminReportStatusSchema, EventStatusSchema } from "./common.js"



const DiscoverySummarySchema = z
  .object({
    queue: z.number().int().nonnegative(),
    reportsWaiting: z.number().int().nonnegative(),
    overSla: z.number().int().nonnegative(),
  })
  .strict()

const ReportsSummarySchema = z
  .object({
    flagged: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
  })
  .strict()

const EventsSummarySchema = z
  .object({
    upcoming: z.number().int().nonnegative(),
    live: z.number().int().nonnegative(),
    attending: z.number().int().nonnegative(),
  })
  .strict()

const MailSummarySchema = z
  .object({
    unread: z.number().int().nonnegative(),
    needsAction: z.number().int().nonnegative(),
  })
  .strict()

const UsersSummarySchema = z
  .object({
    flagged: z.number().int().nonnegative(),
    highRisk: z.number().int().nonnegative(),
    suspended: z.number().int().nonnegative(),
  })
  .strict()

const AnalyticsMiniSchema = z
  .object({
    pinsThisMonth: z.number().int().nonnegative(),
    resolvedPct: z.number(),
    coveragePct: z.number(),
    cleanups: z.number().int().nonnegative(),
    eventsThisMonth: z.number().int().nonnegative(),
    newUsers: z.number().int().nonnegative(),
    pinsByWeek: z.array(z.number()),
  })
  .strict()

export const HomeSummaryResponseSchema = z
  .object({
    discovery: DiscoverySummarySchema,
    reports: ReportsSummarySchema,
    events: EventsSummarySchema,
    mail: MailSummarySchema,
    users: UsersSummarySchema,
    analytics: AnalyticsMiniSchema,
    livePins24h: z.number().int().nonnegative(),
    moderationQueue: z.number().int().nonnegative().optional(),
    inboxUnread: z.number().int().nonnegative().optional(),
    // The top-level keys whose query failed and were filled with zeros, so a tile can render as
    // unavailable instead of showing a real-looking 0.
    degraded: z.array(z.string()).optional(),
  })
  .strict()
export type HomeSummaryResponse = z.infer<typeof HomeSummaryResponseSchema>


export const HomeMapPinSchema = z
  .object({
    refType: z.enum(["report", "event"]),
    id: z.string(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    category: ReportCategorySchema.nullable(),
    eventKind: EventKindSchema.nullable().optional(),
    status: z.union([AdminReportStatusSchema, EventStatusSchema]),
    flagged: z.boolean(),
    title: z.string(),
    place: z.string(),
    attendees: z.number().int().nonnegative().nullable().optional(),
  })
  .strict()
export type HomeMapPin = z.infer<typeof HomeMapPinSchema>

export const HomeMapResponseSchema = z
  .object({
    pins: z.array(HomeMapPinSchema),
  })
  .strict()
export type HomeMapResponse = z.infer<typeof HomeMapResponseSchema>
