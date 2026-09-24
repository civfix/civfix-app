import type { ApiClient } from "@civfix/shared/client"
import {
  fakeEventInsights,
  fakeHostedEvents,
  fakeHostedEventsAnalytics,
} from "@civfix/shared/fakes"
import { MAX_PORTFOLIO_TOP_VOLUNTEERS } from "@civfix/shared"
import type {
  CleanupDTO,
  EventCheckinCountersDTO,
  EventInsights,
  EventPhase,
  EventRegistrationDTO,
  HostedEventDTO,
  HostedEventsAnalyticsResponse,
  LeaderboardEntryDTO,
  ListMyHostedEventsResponse,
  ListEventRegistrationsResponse,
  ListMyEventInvitesResponse,
  ListMyOrganizationsResponse,
  ListMyOrgInvitesResponse,
  ListOrganizationInvitesResponse,
  ListOrganizationMembersResponse,
  OrganizationDTO,
  PersonDTO,
  PortfolioAnalyticsRange,
} from "@civfix/shared"

import { DAY_MS, HOUR_MS, MINUTE_MS, makeCannedApi, type FakeEndpoint } from "./fixtures"

const FIXTURE_NOW = Date.now()

export const DASHBOARD_EVENT_IDS: Readonly<Record<EventPhase, string>> = {
  upcoming: "ev-upcoming",
  live: "ev-live",
  ended: "ev-ended",
  cancelled: "ev-cancelled",
}

export const DASHBOARD_EVENT_PENDING_ID = "ev-pending"
export const DASHBOARD_EVENT_ERROR_ID = "ev-error"

const PHASE_BY_EVENT_ID: Readonly<Record<string, EventPhase>> = {
  [DASHBOARD_EVENT_IDS.upcoming]: "upcoming",
  [DASHBOARD_EVENT_IDS.live]: "live",
  [DASHBOARD_EVENT_IDS.ended]: "ended",
  [DASHBOARD_EVENT_IDS.cancelled]: "cancelled",
  [DASHBOARD_EVENT_PENDING_ID]: "live",
  [DASHBOARD_EVENT_ERROR_ID]: "live",
}

const PHASE_TITLES: Readonly<Record<EventPhase, string>> = {
  upcoming: "Dolores Park litter sweep",
  live: "Bayview shoreline cleanup",
  ended: "24th St planter day",
  cancelled: "Ocean Beach dune day",
}

function person(id: string, name: string, handle: string): PersonDTO {
  return {
    id,
    name,
    handle,
    bio: null,
    avatar: null,
    avatarUrl: null,
    followers: 0,
    following: 0,
    isFollowing: false,
  }
}

const HOST = person("me", "Sam Okafor", "samok")
const COHOST = person("p-ann", "Ann Rivera", "annrivera")

const FULL_HOST_CAPABILITIES: CleanupDTO["myCapabilities"] = [
  "view_event_private",
  "view_roster",
  "view_guest_contact",
  "view_answers",
  "view_analytics",
  "check_in",
  "manage_event",
  "manage_tickets",
  "manage_team",
  "broadcast",
  "export",
  "manage_page",
  "cancel_event",
  "manage_org_link",
  "moderate_chat",
  "request_resources",
]

const EVENT_ORGANIZATION: NonNullable<CleanupDTO["organization"]> = {
  id: "org-bayview",
  slug: "bayview-stewards",
  name: "Bayview Stewards",
  logoUrl: null,
  verified: true,
  verifiedKind: "nonprofit",
  donationUrl: "https://bayviewstewards.org/give",
}

const DASHBOARD_ORGS: readonly OrganizationDTO[] = [
  {
    id: "org-bayview",
    slug: "bayview-stewards",
    name: "Bayview Stewards",
    description: "Shoreline and creek stewardship across the southeast waterfront.",
    websiteUrl: null,
    logoMediaId: null,
    logoUrl: null,
    socialLinks: null,
    verifiedStatus: "verified",
    verifiedKind: "nonprofit",
    verifiedAt: new Date(FIXTURE_NOW - 240 * DAY_MS).toISOString(),
    createdAt: new Date(FIXTURE_NOW - 500 * DAY_MS).toISOString(),
    memberCount: 24,
    eventCount: 31,
    myRole: "owner",
    donationUrl: "https://bayviewstewards.org/give",
    suspended: false,
  },
  {
    id: "org-mission",
    slug: "mission-green",
    name: "Mission Green",
    description: "Planters, murals and sidewalk gardens on the 24th St corridor.",
    websiteUrl: null,
    logoMediaId: null,
    logoUrl: null,
    socialLinks: null,
    verifiedStatus: "unverified",
    verifiedKind: null,
    verifiedAt: null,
    createdAt: new Date(FIXTURE_NOW - 180 * DAY_MS).toISOString(),
    memberCount: 9,
    eventCount: 6,
    myRole: "admin",
    donationUrl: null,
    suspended: false,
  },
]

const EVENT_INVITES: ListMyEventInvitesResponse = {
  items: [
    {
      id: "inv-event-1",
      role: "cohost",
      event: {
        id: "ev-invite-1",
        title: "Creekside trail restoration",
        startsAt: new Date(FIXTURE_NOW + 6 * DAY_MS).toISOString(),
        endsAt: new Date(FIXTURE_NOW + 6 * DAY_MS + 4 * HOUR_MS).toISOString(),
        status: "upcoming",
        coverThumbUrl: null,
        address: "Glen Canyon Park, San Francisco",
      },
      invitedBy: COHOST,
      createdAt: new Date(FIXTURE_NOW - 2 * DAY_MS).toISOString(),
      expiresAt: new Date(FIXTURE_NOW + 12 * DAY_MS).toISOString(),
    },
  ],
  nextCursor: null,
}

const ORG_INVITES: ListMyOrgInvitesResponse = {
  items: [
    {
      id: "inv-org-1",
      organization: {
        id: "org-ocean",
        slug: "ocean-beach-collective",
        name: "Ocean Beach Collective",
        logoUrl: null,
        verified: true,
        verifiedKind: "community",
      },
      role: "admin",
      invitedBy: COHOST,
      createdAt: new Date(FIXTURE_NOW - 4 * DAY_MS).toISOString(),
      expiresAt: new Date(FIXTURE_NOW + 10 * DAY_MS).toISOString(),
    },
  ],
}

const ORG_MEMBERS: ListOrganizationMembersResponse = {
  items: [
    { person: HOST, role: "owner", joinedAt: new Date(FIXTURE_NOW - 500 * DAY_MS).toISOString(), canRemove: false },
    { person: COHOST, role: "admin", joinedAt: new Date(FIXTURE_NOW - 300 * DAY_MS).toISOString(), canRemove: true },
    {
      person: person("p-lee", "Lee Tran", "leetran"),
      role: "member",
      joinedAt: new Date(FIXTURE_NOW - 90 * DAY_MS).toISOString(),
      canRemove: true,
    },
  ],
  nextCursor: null,
}

const ORG_INVITE_LIST: ListOrganizationInvitesResponse = {
  items: [
    {
      id: "inv-org-pending-1",
      organizationId: "org-bayview",
      email: "mei@example.org",
      user: null,
      role: "member",
      status: "pending",
      invitedBy: HOST,
      createdAt: new Date(FIXTURE_NOW - 3 * DAY_MS).toISOString(),
      expiresAt: new Date(FIXTURE_NOW + 11 * DAY_MS).toISOString(),
    },
  ],
}

const EXTRA_TOP_VOLUNTEERS: readonly LeaderboardEntryDTO[] = [
  {
    rank: 4,
    userId: "v-gallery-4",
    name: "Priya Raman",
    handle: "priyar",
    avatar: null,
    avatarUrl: null,
    hours: 21.5,
  },
  {
    rank: 5,
    userId: "v-gallery-5",
    name: "Dom Alvarez",
    handle: "domalv",
    avatar: null,
    avatarUrl: null,
    hours: 18,
  },
]

const NEEDS_HOURS_EVENT: HostedEventDTO = {
  id: "ev-needs-hours",
  title: "Islais Creek weed pull",
  startsAt: new Date(FIXTURE_NOW - 2 * DAY_MS).toISOString(),
  endsAt: new Date(FIXTURE_NOW - 2 * DAY_MS + 3 * HOUR_MS).toISOString(),
  timezone: "America/Los_Angeles",
  status: "upcoming",
  visibility: "public",
  coverThumbUrl: null,
  registeredCount: 14,
  capacity: 20,
  checkedInCount: 12,
  waitlistCount: 0,
  myRole: "organizer",
  myCapabilities: [
    "view_event_private",
    "view_roster",
    "view_analytics",
    "check_in",
    "manage_event",
    "broadcast",
  ],
  orgId: null,
  orgName: null,
  pageSlug: null,
  pageStatus: null,
}

function galleryAnalytics(
  range: PortfolioAnalyticsRange,
  orgId: string | null,
): HostedEventsAnalyticsResponse {
  const base = fakeHostedEventsAnalytics(range, { now: FIXTURE_NOW, seed: orgId ? 23 : 7 })
  return {
    ...base,
    topVolunteers: [...base.topVolunteers, ...EXTRA_TOP_VOLUNTEERS].slice(
      0,
      MAX_PORTFOLIO_TOP_VOLUNTEERS,
    ),
  }
}

function galleryHostedEvents(
  when: "upcoming" | "past",
  orgId: string | null,
): ListMyHostedEventsResponse {
  const org = DASHBOARD_ORGS.find((row) => row.id === orgId) ?? null
  const page = fakeHostedEvents(when, {
    now: FIXTURE_NOW,
    orgId: org?.id ?? null,
    orgName: org?.name ?? null,
    seed: org ? 29 : 11,
  })
  if (when !== "past") return page
  return { ...page, items: [NEEDS_HOURS_EVENT, ...page.items] }
}

export function soloPortfolioOverrides(): Record<string, FakeEndpoint> {
  return {
    listMyOrganizations: async () => ({ items: [] }),
    hostedEventsAnalytics: async (args) => ({
      ...galleryAnalytics(
        (args as { range?: PortfolioAnalyticsRange } | undefined)?.range ?? "all",
        null,
      ),
      topVolunteers: [],
    }),
  }
}

function insightsFor(phase: EventPhase): EventInsights {
  return fakeEventInsights(phase, { now: FIXTURE_NOW })
}

function phaseCleanup(id: string, phase: EventPhase): CleanupDTO {
  const insights = insightsFor(phase)
  return {
    id,
    referenceCode: "BAY-4821",
    pageSlug: "bayview-shoreline-cleanup",
    jurisdictionGeoid: "0667000",
    organization: EVENT_ORGANIZATION,
    title: PHASE_TITLES[phase],
    type: "site",
    eventKind: "cleanup",
    description: "Gloves, bags and grabbers provided. Meet at the north gate by the mural.",
    lat: 37.7599,
    lng: -122.4148,
    scheduledAt: insights.clock.startsAt,
    endsAt: insights.clock.endsAt,
    timezone: insights.clock.timezone,
    status: insights.clock.status,
    organizer: HOST,
    going: insights.seats.registered,
    joined: true,
    myRole: "organizer",
    myCapabilities: FULL_HOST_CAPABILITIES,
    bring: ["Water", "Closed-toe shoes"],
    address: "Dolores Park, San Francisco",
    dist: null,
    linkedReports: [],
    slots: [],
    visibility: "public",
    galleryUrls: [],
    ticketTypes: [],
    registrationClosesAt: insights.clock.registrationClosesAt,
    capacity: insights.seats.capacity,
    registeredCount: insights.seats.registered,
    waitlistCount: insights.seats.waitlisted,
    checkedInCount: insights.seats.checkedIn,
    teamCount: 4,
  }
}

function phaseCounters(id: string, phase: EventPhase): EventCheckinCountersDTO {
  const insights = insightsFor(phase)
  const startsAt = Date.parse(insights.clock.startsAt)
  return {
    registered: insights.seats.registered,
    checkedIn: insights.seats.checkedIn,
    waitlisted: insights.seats.waitlisted,
    noShow: insights.seats.noShow,
    capacity: insights.seats.capacity,
    byTicketType: insights.byTicketType.map((row) => ({
      ticketTypeId: row.ticketTypeId,
      name: row.name,
      registered: row.registered,
      checkedIn: row.checkedIn,
      waitlisted: row.waitlisted,
      capacity: row.capacity,
    })),
    arrivals: insights.arrivals.map((bucket) => ({
      at: new Date(startsAt + bucket.offsetMin * MINUTE_MS).toISOString(),
      count: bucket.seats,
    })),
    asOf: new Date().toISOString(),
  }
}

const ROSTER_PEOPLE: readonly { id: string; name: string; handle: string }[] = [
  { id: "p-ann", name: "Ann Rivera", handle: "annrivera" },
  { id: "p-lee", name: "Lee Tran", handle: "leetran" },
  { id: "p-mei", name: "Mei Wong", handle: "meiwong" },
  { id: "p-jo", name: "Jo Okonkwo", handle: "jook" },
  { id: "p-raf", name: "Rafa Núñez", handle: "rafan" },
  { id: "p-kim", name: "Kim Bello", handle: "kimbello" },
]

function phaseRoster(id: string, phase: EventPhase): ListEventRegistrationsResponse {
  const insights = insightsFor(phase)
  const startsAt = Date.parse(insights.clock.startsAt)
  const checkedInRows = phase === "upcoming" || phase === "cancelled" ? 0 : 4
  const items: EventRegistrationDTO[] = ROSTER_PEOPLE.map((who, i) => {
    const checkedIn = i < checkedInRows
    const partySize = i === 1 ? 2 : 1
    return {
      id: `reg-${id}-${i}`,
      cleanupId: id,
      kind: "member",
      person: person(who.id, who.name, who.handle),
      guestName: null,
      ticketTypeId: insights.byTicketType[i % 2]?.ticketTypeId ?? null,
      ticketTypeName: insights.byTicketType[i % 2]?.name ?? null,
      partySize,
      seatCount: partySize,
      seats: Array.from({ length: partySize }, (_seat, seatIndex) => ({
        id: `seat-${id}-${i}-${seatIndex}`,
        seatIndex,
        attendeeName: seatIndex === 0 ? who.name : null,
        status: "active" as const,
        ticketToken: null,
        checkedInAt: checkedIn ? new Date(startsAt + i * 6 * MINUTE_MS).toISOString() : null,
        checkinMethod: checkedIn ? ("scan" as const) : null,
        noShowAt: null,
      })),
      status: i === ROSTER_PEOPLE.length - 1 ? "cancelled" : "registered",
      source: i === 3 ? "walkup" : "self",
      registeredAt: new Date(startsAt - (14 - i) * DAY_MS).toISOString(),
      cancelledAt:
        i === ROSTER_PEOPLE.length - 1
          ? new Date(startsAt - 2 * DAY_MS).toISOString()
          : null,
      checkedInAt: checkedIn ? new Date(startsAt + i * 6 * MINUTE_MS).toISOString() : null,
      checkedInBy: checkedIn ? HOST : null,
      slot: null,
      waitlistPosition: null,
      answersPreview: null,
      answers: null,
      note: null,
    }
  })
  return { items, nextCursor: null, total: items.length }
}

function phaseOf(id: string): EventPhase {
  return PHASE_BY_EVENT_ID[id] ?? "live"
}

function argId(args: unknown): string {
  const id = (args as { id?: unknown } | undefined)?.id
  return typeof id === "string" ? id : DASHBOARD_EVENT_IDS.live
}

export function pendingForever(): FakeEndpoint {
  return () => new Promise<never>(() => {})
}

export function failing(label: string): FakeEndpoint {
  return () => Promise.reject(new Error(`bodies-gallery dashboard fake: ${label} is down`))
}

const DASHBOARD_FAKE_ENDPOINTS: Record<string, FakeEndpoint> = {
  hostedEventsAnalytics: async (args) =>
    galleryAnalytics(
      (args as { range?: PortfolioAnalyticsRange } | undefined)?.range ?? "all",
      (args as { orgId?: string } | undefined)?.orgId ?? null,
    ),
  listMyHostedEvents: async (args) =>
    galleryHostedEvents(
      (args as { when?: "upcoming" | "past" } | undefined)?.when ?? "upcoming",
      (args as { orgId?: string } | undefined)?.orgId ?? null,
    ),
  listMyEventInvites: async () => EVENT_INVITES,
  listMyOrgInvites: async () => ORG_INVITES,
  listMyOrganizations: async (): Promise<ListMyOrganizationsResponse> => ({
    items: [...DASHBOARD_ORGS],
  }),
  listOrganizationMembers: async () => ORG_MEMBERS,
  listOrganizationInvites: async () => ORG_INVITE_LIST,
  getCleanup: async (args) => {
    const id = argId(args)
    return phaseCleanup(id, phaseOf(id))
  },
  getEventInsights: (args) => {
    const id = argId(args)
    if (id === DASHBOARD_EVENT_PENDING_ID) return pendingForever()()
    if (id === DASHBOARD_EVENT_ERROR_ID) return failing("getEventInsights")()
    return Promise.resolve(insightsFor(phaseOf(id)))
  },
  getEventCheckinCounters: (args) => {
    const id = argId(args)
    if (id === DASHBOARD_EVENT_PENDING_ID) return pendingForever()()
    if (id === DASHBOARD_EVENT_ERROR_ID) return failing("getEventCheckinCounters")()
    return Promise.resolve(phaseCounters(id, phaseOf(id)))
  },
  listEventRegistrations: async (args) => {
    const id = argId(args)
    return phaseRoster(id, phaseOf(id))
  },
  listEventTicketTypes: async () => ({ items: [] }),
  listEventTeam: async () => ({ items: [], invites: [] }),
  listEventWaitlist: async () => ({ items: [], nextCursor: null }),
  acceptMyEventInvite: async () => ({ ok: true, role: "cohost" }),
  declineMyEventInvite: async () => ({ ok: true }),
  acceptMyOrgInvite: async () => ({
    ok: true,
    organization: DASHBOARD_ORGS[0],
    role: "admin",
  }),
  declineMyOrgInvite: async () => ({ ok: true }),
}

export function makeDashboardFakeApi(
  overrides: Record<string, FakeEndpoint> = {},
): ApiClient {
  return makeCannedApi(
    { ...DASHBOARD_FAKE_ENDPOINTS, ...overrides },
    (name) => (): Promise<never> =>
      Promise.reject(new Error(`bodies-gallery dashboard fake: "${name}" is not stubbed`)),
  )
}

const PORTFOLIO_QUERY_NAMES = [
  "hostedEventsAnalytics",
  "listMyHostedEvents",
  "listMyEventInvites",
  "listMyOrgInvites",
  "listMyOrganizations",
] as const

export function portfolioOverrides(
  make: (name: string) => FakeEndpoint,
): Record<string, FakeEndpoint> {
  const out: Record<string, FakeEndpoint> = {}
  for (const name of PORTFOLIO_QUERY_NAMES) out[name] = make(name)
  return out
}

export function emptyPortfolioOverrides(): Record<string, FakeEndpoint> {
  const analytics = fakeHostedEventsAnalytics("all", { now: FIXTURE_NOW, seed: 7 })
  const blank = { value: null, numerator: 0, denominator: 0, suppressed: false }
  return {
    listMyOrganizations: async () => ({ items: [] }),
    listMyEventInvites: async () => ({ items: [], nextCursor: null }),
    listMyOrgInvites: async () => ({ items: [] }),
    listMyHostedEvents: async () => ({
      items: [],
      nextCursor: null,
      kpis: { eventsHosted: 0, upcomingEvents: 0, totalRegistrations: 0, totalCheckedIn: 0 },
    }),
    hostedEventsAnalytics: async () => ({
      ...analytics,
      totals: { events: 0, registrations: 0, checkIns: 0, uniqueAttendees: 0 },
      series: [],
      byEvent: { panelSuppressed: false, rows: [] },
      repeatAttendance: blank,
      averageCheckInRate: blank,
      bestDayTime: null,
      totalHours: 0,
      volunteersCredited: 0,
      topVolunteers: [],
    }),
  }
}
