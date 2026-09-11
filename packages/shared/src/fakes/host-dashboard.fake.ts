import { ANALYTICS_SUPPRESSION_K } from "../schemas/host/analytics.js"
import type {
  BreakdownRow,
  HostedEventsAnalyticsResponse,
  PortfolioAnalyticsRange,
  SeriesPoint,
} from "../schemas/host/analytics.js"
import type {
  ArrivalOffsetBucket,
  EventInsights,
  EventInsightsClock,
  EventPhase,
  InsightsBroadcast,
  InsightsSourceCount,
  InsightsTicketType,
  SeatPoint,
} from "../schemas/host/insights.js"
import type {
  HostedEventDTO,
  HostPortfolioKpis,
  ListMyHostedEventsResponse,
} from "../schemas/host/portfolio.js"
import { makeIdFactory } from "./ids.js"


const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

const FAKE_CAPACITY = 60
const FAKE_REGISTERED = 42
const FAKE_WAITLISTED = 7
const FAKE_CANCELLED_SEATS = 5
const FAKE_TREND_DAYS = 14
const FAKE_EVENT_DURATION_MS = 4 * HOUR_MS
const FAKE_TIMEZONE = "America/Los_Angeles"

export interface FakeEventInsightsOptions {
  seed?: number
  now?: number
  money?: boolean
  returning?: boolean
  timezone?: string
}

export interface FakeHostedEventsAnalyticsOptions {
  seed?: number
  now?: number
}

export interface FakeHostedEventsOptions {
  seed?: number
  now?: number
  orgId?: string | null
  orgName?: string | null
}

function rngFrom(seed: number): () => number {
  let state = (seed >>> 0) || 1
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function cumulative(total: number, days: number, rng: () => number): number[] {
  const weights: number[] = []
  for (let i = 0; i < days; i += 1) weights.push(0.35 + rng())
  const sum = weights.reduce((a, b) => a + b, 0)
  const out: number[] = []
  let acc = 0
  for (let i = 0; i < days; i += 1) {
    acc += (weights[i] ?? 0) / sum
    out.push(Math.min(total, Math.round(acc * total)))
  }
  out[days - 1] = total
  return out
}

function spread(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  const out = weights.map((w) => Math.floor((w / sum) * total))
  let rest = total - out.reduce((a, b) => a + b, 0)
  for (let i = 0; rest > 0; i = (i + 1) % out.length) {
    out[i] = (out[i] ?? 0) + 1
    rest -= 1
  }
  return out
}

interface PhaseProfile {
  status: EventInsightsClock["status"]
  startsAt: number
  completedAt: number | null
  checkedIn: number
  noShow: number
  walkupSeats: number
  arrivals: boolean
}

function phaseProfile(phase: EventPhase, now: number): PhaseProfile {
  if (phase === "live") {
    return {
      status: "active",
      startsAt: now - 45 * MINUTE_MS,
      completedAt: null,
      checkedIn: 27,
      noShow: 0,
      walkupSeats: 2,
      arrivals: true,
    }
  }
  if (phase === "ended") {
    const startsAt = now - 9 * DAY_MS
    return {
      status: "done",
      startsAt,
      completedAt: startsAt + FAKE_EVENT_DURATION_MS,
      checkedIn: 38,
      noShow: 4,
      walkupSeats: 3,
      arrivals: true,
    }
  }
  if (phase === "cancelled") {
    return {
      status: "cancelled",
      startsAt: now + 5 * DAY_MS,
      completedAt: null,
      checkedIn: 0,
      noShow: 0,
      walkupSeats: 0,
      arrivals: false,
    }
  }
  return {
    status: "upcoming",
    startsAt: now + 3 * DAY_MS,
    completedAt: null,
    checkedIn: 0,
    noShow: 0,
    walkupSeats: 0,
    arrivals: false,
  }
}

function fakeTicketTypes(
  nextId: () => string,
  checkedIn: number,
): InsightsTicketType[] {
  const general = Math.round((checkedIn * 30) / FAKE_REGISTERED)
  return [
    {
      ticketTypeId: nextId(),
      name: "General admission",
      registered: 30,
      capacity: 40,
      waitlisted: 5,
      checkedIn: general,
    },
    {
      ticketTypeId: nextId(),
      name: "Crew lead",
      registered: 12,
      capacity: 20,
      waitlisted: 2,
      checkedIn: checkedIn - general,
    },
  ]
}

function fakeSources(walkupSeats: number): InsightsSourceCount[] {
  const waitlist = 4
  const transfer = 2
  return [
    { source: "self", seats: FAKE_REGISTERED - waitlist - transfer - walkupSeats },
    { source: "waitlist", seats: waitlist },
    { source: "walkup", seats: walkupSeats },
    { source: "transfer", seats: transfer },
  ]
}

function fakeBroadcasts(
  nextId: () => string,
  phase: EventPhase,
  startsAt: number,
): InsightsBroadcast[] {
  const confirmationAt = startsAt - 12 * DAY_MS
  const reminderAt = startsAt - 2 * DAY_MS
  const recapAt = startsAt + FAKE_EVENT_DURATION_MS + HOUR_MS
  const pending = phase === "upcoming" || phase === "cancelled"
  return [
    {
      id: nextId(),
      kind: "confirmation",
      finishedAt: new Date(confirmationAt).toISOString(),
      recipients: 42,
      sent: 41,
      failed: 1,
      suppressed: 0,
    },
    {
      id: nextId(),
      kind: "reminder",
      finishedAt: pending ? null : new Date(reminderAt).toISOString(),
      recipients: 40,
      sent: pending ? 0 : 38,
      failed: pending ? 0 : 0,
      suppressed: 2,
    },
    {
      id: nextId(),
      kind: "host_broadcast",
      finishedAt: phase === "ended" ? new Date(recapAt).toISOString() : null,
      recipients: 38,
      sent: phase === "ended" ? 36 : 0,
      failed: phase === "ended" ? 1 : 0,
      suppressed: 1,
    },
  ]
}

function fakeArrivals(checkedIn: number): ArrivalOffsetBucket[] {
  const weights = [1, 2, 5, 9, 12, 10, 7, 5, 4, 3, 2, 1]
  const seats = spread(checkedIn, weights)
  return weights.map((_w, i) => ({
    offsetMin: -60 + i * 15,
    seats: seats[i] ?? 0,
  }))
}

function fakeTrend(
  registered: number,
  lastDayMs: number,
  rng: () => number,
): SeatPoint[] {
  const points = cumulative(registered, FAKE_TREND_DAYS, rng)
  return points.map((seats, i) => ({
    day: dayKey(lastDayMs - (FAKE_TREND_DAYS - 1 - i) * DAY_MS),
    seats,
  }))
}

export function fakeEventInsights(
  phase: EventPhase,
  options: FakeEventInsightsOptions = {},
): EventInsights {
  const seed = options.seed ?? 1
  const now = options.now ?? Date.now()
  const rng = rngFrom(seed)
  const nextId = makeIdFactory(seed)
  const profile = phaseProfile(phase, now)
  const endsAt = profile.startsAt + FAKE_EVENT_DURATION_MS
  const unmarked = Math.max(0, FAKE_REGISTERED - profile.checkedIn - profile.noShow)
  const withMoney = options.money ?? phase !== "cancelled"
  const withReturning = options.returning ?? phase !== "cancelled"

  return {
    generatedAt: new Date(now).toISOString(),
    phase,
    clock: {
      status: profile.status,
      startsAt: new Date(profile.startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      completedAt: profile.completedAt === null ? null : new Date(profile.completedAt).toISOString(),
      registrationClosesAt: new Date(profile.startsAt - 12 * HOUR_MS).toISOString(),
      timezone: options.timezone ?? FAKE_TIMEZONE,
    },
    seats: {
      registered: FAKE_REGISTERED,
      capacity: FAKE_CAPACITY,
      waitlisted: FAKE_WAITLISTED,
      cancelled: FAKE_CANCELLED_SEATS,
      checkedIn: profile.checkedIn,
      noShow: profile.noShow,
      unmarked,
    },
    registrationTrend: fakeTrend(FAKE_REGISTERED, Math.min(now, profile.startsAt), rng),
    byTicketType: fakeTicketTypes(nextId, profile.checkedIn),
    bySource: fakeSources(profile.walkupSeats),
    broadcasts: fakeBroadcasts(nextId, phase, profile.startsAt),
    arrivals: profile.arrivals ? fakeArrivals(profile.checkedIn) : [],
    hours: {
      credited: phase === "ended" ? 114.5 : 0,
      attendeesCredited: phase === "ended" ? 34 : 0,
      attendeesCheckedIn: profile.checkedIn,
    },
    money: withMoney
      ? {
          currency: "USD",
          donationCount: 11,
          grossMinor: 48_500,
          netMinor: 46_130,
          refundedMinor: 2_500,
          lastChargedAt: new Date(profile.startsAt - 2 * DAY_MS).toISOString(),
        }
      : null,
    returning: withReturning ? { seats: 17, ofRegistered: FAKE_REGISTERED } : null,
  }
}

const PORTFOLIO_SERIES_DAYS: Readonly<Record<PortfolioAnalyticsRange, number>> = {
  "30d": 30,
  "90d": 60,
  "365d": 90,
  all: 120,
}

const PORTFOLIO_EVENT_TITLES = [
  "Dolores Park litter sweep",
  "Bayview shoreline cleanup",
  "24th St planter day",
  "Creekside trail restoration",
  "Mission mural touch-up",
  "Ocean Beach dune day",
] as const

export function fakeHostedEventsAnalytics(
  range: PortfolioAnalyticsRange = "30d",
  options: FakeHostedEventsAnalyticsOptions = {},
): HostedEventsAnalyticsResponse {
  const seed = options.seed ?? 7
  const now = options.now ?? Date.now()
  const rng = rngFrom(seed)
  const days = PORTFOLIO_SERIES_DAYS[range]
  const series: SeriesPoint[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    series.push({
      day: dayKey(now - i * DAY_MS),
      value: Math.round(4 + rng() * 22),
      suppressed: false,
    })
  }
  const registrations = 412
  const checkIns = 337
  const uniqueAttendees = 268
  const rows: BreakdownRow[] = PORTFOLIO_EVENT_TITLES.slice(0, 5).map((label, i) => ({
    key: `top-event-${i + 1}`,
    label,
    value: 96 - i * 17,
    suppressed: false,
  }))

  return {
    generatedAt: new Date(now).toISOString(),
    range,
    k: ANALYTICS_SUPPRESSION_K,
    totals: {
      events: 9,
      registrations,
      checkIns,
      uniqueAttendees,
    },
    series,
    byEvent: { panelSuppressed: false, rows },
    repeatAttendance: {
      value: 0.34,
      numerator: 91,
      denominator: uniqueAttendees,
      suppressed: false,
    },
    averageCheckInRate: {
      value: checkIns / registrations,
      numerator: checkIns,
      denominator: registrations,
      suppressed: false,
    },
    bestDayTime: { weekday: 6, hour: 9, value: 5, suppressed: false },
  }
}

export function fakeHostPortfolioKpis(): HostPortfolioKpis {
  return {
    eventsHosted: 9,
    upcomingEvents: 3,
    totalRegistrations: 412,
    totalCheckedIn: 337,
  }
}

export function fakeHostedEvents(
  when: "upcoming" | "past" = "upcoming",
  options: FakeHostedEventsOptions = {},
): ListMyHostedEventsResponse {
  const seed = options.seed ?? 11
  const now = options.now ?? Date.now()
  const nextId = makeIdFactory(seed)
  const orgId = options.orgId ?? null
  const orgName = options.orgName ?? null
  const upcoming: HostedEventDTO[] = [
    {
      id: nextId(),
      title: PORTFOLIO_EVENT_TITLES[0],
      startsAt: new Date(now + 3 * DAY_MS).toISOString(),
      endsAt: new Date(now + 3 * DAY_MS + FAKE_EVENT_DURATION_MS).toISOString(),
      timezone: FAKE_TIMEZONE,
      status: "upcoming",
      visibility: "public",
      coverThumbUrl: null,
      registeredCount: 42,
      capacity: 60,
      checkedInCount: 0,
      waitlistCount: 7,
      myRole: "organizer",
      myCapabilities: [
        "view_event_private",
        "view_roster",
        "view_analytics",
        "check_in",
        "manage_event",
        "manage_tickets",
        "manage_team",
        "broadcast",
        "export",
      ],
      orgId,
      orgName,
      pageSlug: null,
      pageStatus: null,
    },
    {
      id: nextId(),
      title: PORTFOLIO_EVENT_TITLES[3],
      startsAt: new Date(now + 11 * DAY_MS).toISOString(),
      endsAt: new Date(now + 11 * DAY_MS + FAKE_EVENT_DURATION_MS).toISOString(),
      timezone: FAKE_TIMEZONE,
      status: "upcoming",
      visibility: "unlisted",
      coverThumbUrl: null,
      registeredCount: 18,
      capacity: null,
      checkedInCount: 0,
      waitlistCount: 0,
      myRole: "cohost",
      myCapabilities: ["view_event_private", "view_roster", "check_in", "broadcast"],
      orgId,
      orgName,
      pageSlug: null,
      pageStatus: null,
    },
    {
      id: nextId(),
      title: PORTFOLIO_EVENT_TITLES[5],
      startsAt: new Date(now + 24 * DAY_MS).toISOString(),
      endsAt: null,
      timezone: FAKE_TIMEZONE,
      status: "upcoming",
      visibility: "public",
      coverThumbUrl: null,
      registeredCount: 6,
      capacity: 30,
      checkedInCount: 0,
      waitlistCount: 0,
      myRole: "coordinator",
      myCapabilities: ["view_event_private", "view_roster", "view_analytics"],
      orgId,
      orgName,
      pageSlug: null,
      pageStatus: null,
    },
  ]
  const past: HostedEventDTO[] = [
    {
      id: nextId(),
      title: PORTFOLIO_EVENT_TITLES[1],
      startsAt: new Date(now - 9 * DAY_MS).toISOString(),
      endsAt: new Date(now - 9 * DAY_MS + FAKE_EVENT_DURATION_MS).toISOString(),
      timezone: FAKE_TIMEZONE,
      status: "done",
      visibility: "public",
      coverThumbUrl: null,
      registeredCount: 42,
      capacity: 60,
      checkedInCount: 38,
      waitlistCount: 7,
      myRole: "organizer",
      myCapabilities: [
        "view_event_private",
        "view_roster",
        "view_analytics",
        "check_in",
        "manage_event",
        "manage_tickets",
        "manage_team",
        "broadcast",
        "export",
      ],
      orgId,
      orgName,
      pageSlug: null,
      pageStatus: null,
    },
    {
      id: nextId(),
      title: PORTFOLIO_EVENT_TITLES[2],
      startsAt: new Date(now - 26 * DAY_MS).toISOString(),
      endsAt: new Date(now - 26 * DAY_MS + FAKE_EVENT_DURATION_MS).toISOString(),
      timezone: FAKE_TIMEZONE,
      status: "done",
      visibility: "public",
      coverThumbUrl: null,
      registeredCount: 31,
      capacity: 35,
      checkedInCount: 27,
      waitlistCount: 3,
      myRole: "organizer",
      myCapabilities: [
        "view_event_private",
        "view_roster",
        "view_analytics",
        "check_in",
        "manage_event",
        "broadcast",
      ],
      orgId,
      orgName,
      pageSlug: null,
      pageStatus: null,
    },
    {
      id: nextId(),
      title: PORTFOLIO_EVENT_TITLES[4],
      startsAt: new Date(now - 41 * DAY_MS).toISOString(),
      endsAt: null,
      timezone: FAKE_TIMEZONE,
      status: "cancelled",
      visibility: "public",
      coverThumbUrl: null,
      registeredCount: 14,
      capacity: 25,
      checkedInCount: 0,
      waitlistCount: 0,
      myRole: "organizer",
      myCapabilities: ["view_event_private", "view_roster", "view_analytics", "manage_event"],
      orgId,
      orgName,
      pageSlug: null,
      pageStatus: null,
    },
  ]

  return {
    items: when === "past" ? past : upcoming,
    nextCursor: null,
    kpis: fakeHostPortfolioKpis(),
  }
}
