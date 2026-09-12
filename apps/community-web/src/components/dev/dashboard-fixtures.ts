import type { ApiClient } from "@civfix/shared/client"
import {
  fakeEventInsights,
  fakeHostedEvents,
  fakeHostedEventsAnalytics,
} from "@civfix/shared/fakes"
import type {
  CleanupDTO,
  EventCheckinCountersDTO,
  EventInsights,
  EventPhase,
  EventRegistrationDTO,
  GetOrgBalanceResponse,
  GetOrgDonationSummaryResponse,
  GetOrgPaymentsStatusResponse,
  ListEventRegistrationsResponse,
  ListMyEventInvitesResponse,
  ListMyOrganizationsResponse,
  ListMyOrgInvitesResponse,
  ListOrganizationInvitesResponse,
  ListOrganizationMembersResponse,
  ListOrgPayoutsResponse,
  OrganizationDTO,
  PersonDTO,
  PortfolioAnalyticsRange,
} from "@civfix/shared"


const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

const FIXTURE_NOW = Date.now()

export const DASHBOARD_EVENT_IDS: Readonly<Record<EventPhase, string>> = {
  upcoming: "ev-upcoming",
  live: "ev-live",
  ended: "ev-ended",
  cancelled: "ev-cancelled",
}

export const DASHBOARD_EVENT_PENDING_ID = "ev-pending"
export const DASHBOARD_EVENT_ERROR_ID = "ev-error"
export const DASHBOARD_EVENT_REFUNDED_ID = "ev-refunded"

const PHASE_BY_EVENT_ID: Readonly<Record<string, EventPhase>> = {
  [DASHBOARD_EVENT_IDS.upcoming]: "upcoming",
  [DASHBOARD_EVENT_IDS.live]: "live",
  [DASHBOARD_EVENT_IDS.ended]: "ended",
  [DASHBOARD_EVENT_IDS.cancelled]: "cancelled",
  [DASHBOARD_EVENT_PENDING_ID]: "live",
  [DASHBOARD_EVENT_ERROR_ID]: "live",
  [DASHBOARD_EVENT_REFUNDED_ID]: "ended",
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
  "view_donations",
]

const EVENT_ORGANIZATION: NonNullable<CleanupDTO["organization"]> = {
  id: "org-bayview",
  slug: "bayview-stewards",
  name: "Bayview Stewards",
  logoUrl: null,
  verified: true,
  verifiedKind: "nonprofit",
}

export const DASHBOARD_ORGS: readonly OrganizationDTO[] = [
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
    donationsEnabled: true,
    donateSlug: "bayview-stewards",
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
    donationsEnabled: false,
    donateSlug: null,
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

const PAYMENTS_STATUS: GetOrgPaymentsStatusResponse = {
  organizationId: "org-bayview",
  state: "ready",
  stripeAccountId: "acct_gallery_bayview",
  livemode: true,
  detailsSubmitted: true,
  chargesEnabled: true,
  payoutsEnabled: true,
  disabledReason: null,
  currentlyDue: [],
  pastDue: [],
  pendingVerification: [],
  futureCurrentlyDue: [],
  currentDeadline: null,
  capabilities: { card_payments: "active", transfers: "active" },
  paymentMethodDomains: [],
  walletsAvailable: ["apple_pay", "google_pay"],
  donationsEnabled: true,
  donationsDisabledReason: null,
  agreement: {
    version: "2026-01",
    acceptedAt: new Date(FIXTURE_NOW - 120 * DAY_MS).toISOString(),
    acceptedByName: "Sam Okafor",
    current: true,
    requiredVersion: "2026-01",
  },
  eligibility: {
    verdict: "eligible",
    reasons: [],
    einLast4: "4417",
    irsLegalName: "Bayview Stewards Inc",
    deductibilityCode: "PC",
    foundationCode: "15",
    graceExpiresAt: null,
    evaluatedAt: new Date(FIXTURE_NOW - 12 * DAY_MS).toISOString(),
    nextCheckAt: new Date(FIXTURE_NOW + 18 * DAY_MS).toISOString(),
    checks: [],
  },
  donateState: "READY",
  lastSyncedAt: new Date(FIXTURE_NOW - 2 * HOUR_MS).toISOString(),
}

const ORG_BALANCE: GetOrgBalanceResponse = {
  available: { amountMinor: 128_400, currency: "USD" },
  pending: { amountMinor: 21_500, currency: "USD" },
  payoutsEnabled: true,
  payoutSchedule: { interval: "manual" },
  lastSyncedAt: new Date(FIXTURE_NOW - 2 * HOUR_MS).toISOString(),
}

const DONATION_SUMMARY: GetOrgDonationSummaryResponse = {
  currency: "USD",
  donationCount: 37,
  grossMinor: 214_500,
  platformFeeMinor: 6_435,
  processorFeeMinor: 7_320,
  netMinor: 200_745,
  refundedMinor: 5_000,
  disputedCount: 0,
  from: new Date(FIXTURE_NOW - 30 * DAY_MS).toISOString(),
  to: null,
}

const ORG_PAYOUTS: ListOrgPayoutsResponse = {
  items: [
    {
      id: "payout-1",
      stripePayoutId: "po_gallery_1",
      amount: { amountMinor: 96_000, currency: "USD" },
      status: "paid",
      arrivalDate: new Date(FIXTURE_NOW - 9 * DAY_MS).toISOString(),
      createdAt: new Date(FIXTURE_NOW - 12 * DAY_MS).toISOString(),
      failureMessage: null,
    },
    {
      id: "payout-2",
      stripePayoutId: "po_gallery_2",
      amount: { amountMinor: 42_500, currency: "USD" },
      status: "in_transit",
      arrivalDate: new Date(FIXTURE_NOW + 2 * DAY_MS).toISOString(),
      createdAt: new Date(FIXTURE_NOW - 1 * DAY_MS).toISOString(),
      failureMessage: null,
    },
  ],
  nextCursor: null,
}

function insightsFor(id: string, phase: EventPhase): EventInsights {
  return fakeEventInsights(phase, {
    now: FIXTURE_NOW,
    ...(id === DASHBOARD_EVENT_REFUNDED_ID ? { refunded: true } : {}),
  })
}

function phaseCleanup(id: string, phase: EventPhase): CleanupDTO {
  const insights = insightsFor(id, phase)
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
  const insights = insightsFor(id, phase)
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
  const insights = insightsFor(id, phase)
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

export type FakeEndpoint = (args?: unknown) => Promise<unknown>

export function pendingForever(): FakeEndpoint {
  return () => new Promise<never>(() => {})
}

export function failing(label: string): FakeEndpoint {
  return () => Promise.reject(new Error(`bodies-gallery dashboard fake: ${label} is down`))
}

export const DASHBOARD_FAKE_ENDPOINTS: Record<string, FakeEndpoint> = {
  hostedEventsAnalytics: async (args) => {
    const range = (args as { range?: PortfolioAnalyticsRange } | undefined)?.range ?? "30d"
    const orgId = (args as { orgId?: string } | undefined)?.orgId ?? null
    return fakeHostedEventsAnalytics(range, { now: FIXTURE_NOW, seed: orgId ? 23 : 7 })
  },
  listMyHostedEvents: async (args) => {
    const when = (args as { when?: "upcoming" | "past" } | undefined)?.when ?? "upcoming"
    const orgId = (args as { orgId?: string } | undefined)?.orgId ?? null
    const org = DASHBOARD_ORGS.find((row) => row.id === orgId) ?? null
    return fakeHostedEvents(when, {
      now: FIXTURE_NOW,
      orgId: org?.id ?? null,
      orgName: org?.name ?? null,
      seed: org ? 29 : 11,
    })
  },
  listMyEventInvites: async () => EVENT_INVITES,
  listMyOrgInvites: async () => ORG_INVITES,
  listMyOrganizations: async (): Promise<ListMyOrganizationsResponse> => ({
    items: [...DASHBOARD_ORGS],
  }),
  listOrganizationMembers: async () => ORG_MEMBERS,
  listOrganizationInvites: async () => ORG_INVITE_LIST,
  getOrgPaymentsStatus: async () => PAYMENTS_STATUS,
  getOrgBalance: async () => ORG_BALANCE,
  getOrgDonationSummary: async () => DONATION_SUMMARY,
  listOrgPayouts: async () => ORG_PAYOUTS,
  listOrgDonationExports: async () => ({ items: [] }),
  getCleanup: async (args) => {
    const id = argId(args)
    return phaseCleanup(id, phaseOf(id))
  },
  getEventInsights: (args) => {
    const id = argId(args)
    if (id === DASHBOARD_EVENT_PENDING_ID) return pendingForever()()
    if (id === DASHBOARD_EVENT_ERROR_ID) return failing("getEventInsights")()
    return Promise.resolve(insightsFor(id, phaseOf(id)))
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
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined
        const name = String(prop)
        const endpoint = overrides[name] ?? DASHBOARD_FAKE_ENDPOINTS[name]
        if (endpoint) return endpoint
        return (): Promise<never> =>
          Promise.reject(new Error(`bodies-gallery dashboard fake: "${name}" is not stubbed`))
      },
    },
  ) as ApiClient
}

export const PORTFOLIO_QUERY_NAMES = [
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
  const analytics = fakeHostedEventsAnalytics("30d", { now: FIXTURE_NOW, seed: 7 })
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
    }),
  }
}
