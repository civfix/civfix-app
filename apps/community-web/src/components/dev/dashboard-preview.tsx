"use client"

import React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import type { ApiClient } from "@civfix/shared/client"
import type {
  HostedEventDTO,
  HostedEventsAnalyticsResponse,
  ListMyEventInvitesResponse,
  ListMyHostedEventsResponse,
  ListMyOrgInvitesResponse,
  OrgBalanceDTO,
  OrganizationDTO,
  OrganizationMemberDTO,
  OrgDonationSummaryDTO,
  OrgPaymentsStatusDTO,
  PayoutDTO,
  PersonDTO,
  SeriesPoint,
  UserDTO,
} from "@civfix/shared"
import { ApiProvider, EventDashboardBody, makeFakeDataContext, theme } from "@civfix/ui"
import { colorSchemes, ThemeProvider, type ColorSchemeName } from "@civfix/ui/theme"
import { CapabilitiesProvider, makeFakeCapabilities } from "@civfix/ui/capabilities"

import { makeQueryClient } from "@/lib/query"

const DAY_MS = 86_400_000

const VIEWER: UserDTO = {
  id: "u-me",
  displayName: "Ana Reyes",
  handle: "anareyes",
  email: "ana@example.org",
  role: "citizen",
  locale: "en",
  createdAt: "2025-01-01T00:00:00.000Z",
}

function person(id: string, name: string): PersonDTO {
  return {
    id,
    name,
    handle: id,
    avatar: null,
    avatarUrl: null,
    followers: 0,
    following: 0,
    isFollowing: false,
  }
}

const ORG: OrganizationDTO = {
  id: "org-1",
  slug: "creek-keepers",
  name: "Creek Keepers",
  verifiedStatus: "verified",
  createdAt: "2025-02-02T00:00:00.000Z",
  myRole: "owner",
  memberCount: 6,
  donationsEnabled: true,
}

function at(days: number, hour: number): string {
  const when = new Date(Date.now() + days * DAY_MS)
  when.setHours(hour, 0, 0, 0)
  return when.toISOString()
}

const UPCOMING: HostedEventDTO[] = [
  {
    id: "e-1",
    title: "Ballona Creek litter sweep",
    startsAt: at(2, 9),
    status: "upcoming",
    visibility: "public",
    registeredCount: 38,
    capacity: 50,
    checkedInCount: 0,
    waitlistCount: 4,
    myRole: "organizer",
    myCapabilities: [],
    referenceCode: "BC-2026",
  },
  {
    id: "e-2",
    title: "Playa del Rey dune restoration",
    startsAt: at(9, 10),
    status: "upcoming",
    visibility: "public",
    registeredCount: 12,
    capacity: 30,
    checkedInCount: 0,
    waitlistCount: 0,
    myRole: "cohost",
    myCapabilities: [],
  },
  {
    id: "e-3",
    title: "Venice alley cleanup",
    startsAt: at(16, 8),
    status: "upcoming",
    visibility: "public",
    registeredCount: 5,
    checkedInCount: 0,
    waitlistCount: 0,
    myRole: "organizer",
    myCapabilities: [],
  },
]

const PAST: HostedEventDTO[] = [
  {
    id: "e-past-1",
    title: "Del Rey lagoon sweep",
    startsAt: at(-6, 9),
    status: "done",
    visibility: "public",
    registeredCount: 44,
    capacity: 45,
    checkedInCount: 39,
    waitlistCount: 0,
    myRole: "organizer",
    myCapabilities: [],
  },
  {
    id: "e-past-2",
    title: "Marina storm-drain check",
    startsAt: at(-20, 8),
    status: "done",
    visibility: "public",
    registeredCount: 21,
    checkedInCount: 17,
    waitlistCount: 0,
    myRole: "coordinator",
    myCapabilities: [],
  },
]

function series(days: number): SeriesPoint[] {
  return Array.from({ length: days }, (_unused, index) => {
    const day = new Date(Date.now() - (days - 1 - index) * DAY_MS)
    const wave = Math.round(6 + 5 * Math.sin(index / 2.4) + (index % 4))
    return { day: day.toISOString().slice(5, 10), value: Math.max(0, wave), suppressed: false }
  })
}

const ANALYTICS: HostedEventsAnalyticsResponse = {
  generatedAt: new Date().toISOString(),
  range: "30d",
  k: 5,
  totals: { events: 14, registrations: 412, checkIns: 338, uniqueAttendees: 276 },
  series: series(28),
  byEvent: {
    panelSuppressed: false,
    rows: [
      { key: "e-past-1", label: "Del Rey lagoon sweep", value: 44, suppressed: false },
      { key: "e-1", label: "Ballona Creek litter sweep", value: 38, suppressed: false },
      { key: "e-past-2", label: "Marina storm-drain check", value: 21, suppressed: false },
      { key: "e-2", label: "Playa del Rey dune restoration", value: 12, suppressed: false },
      { key: "e-3", label: "Venice alley cleanup", value: 5, suppressed: false },
    ],
  },
  repeatAttendance: { value: 0.31, numerator: 86, denominator: 276, suppressed: false },
  averageCheckInRate: { value: 0.82, numerator: 338, denominator: 412, suppressed: false },
  bestDayTime: { weekday: 6, hour: 9, value: 62, suppressed: false },
}

const EVENT_INVITES: ListMyEventInvitesResponse = {
  items: [
    {
      id: "inv-1",
      role: "cohost",
      event: {
        id: "e-9",
        title: "Westchester park restoration",
        startsAt: at(5, 10),
        status: "upcoming",
        address: "Westchester Park",
      },
      invitedBy: person("p-jo", "Jo Mackey"),
      createdAt: new Date().toISOString(),
      expiresAt: at(6, 10),
    },
  ],
  nextCursor: null,
}

const ORG_INVITES: ListMyOrgInvitesResponse = {
  items: [
    {
      id: "oinv-1",
      organization: { id: "org-2", slug: "bay-friends", name: "Friends of the Bay", verified: true },
      role: "admin",
      invitedBy: person("p-sam", "Sam Ortiz"),
      createdAt: new Date().toISOString(),
      expiresAt: at(10, 10),
    },
  ],
}

const PAYMENTS_STATUS: OrgPaymentsStatusDTO = {
  organizationId: ORG.id,
  state: "ready",
  stripeAccountId: "acct_fake",
  livemode: false,
  detailsSubmitted: true,
  chargesEnabled: true,
  payoutsEnabled: true,
  currentlyDue: [],
  pastDue: [],
  pendingVerification: [],
  futureCurrentlyDue: [],
  capabilities: {},
  paymentMethodDomains: [],
  walletsAvailable: [],
  donationsEnabled: true,
  agreement: { version: "1.0", current: true },
  eligibility: { verdict: "eligible", reasons: [], checks: [] },
  donateState: "READY",
}

const BALANCE: OrgBalanceDTO = {
  available: { amountMinor: 128400, currency: "USD" },
  pending: { amountMinor: 21500, currency: "USD" },
  payoutsEnabled: true,
  payoutSchedule: { interval: "manual" },
  lastSyncedAt: new Date().toISOString(),
}

const DONATION_SUMMARY: OrgDonationSummaryDTO = {
  currency: "USD",
  donationCount: 37,
  grossMinor: 184000,
  platformFeeMinor: 5200,
  processorFeeMinor: 6100,
  netMinor: 172700,
  refundedMinor: 0,
  disputedCount: 0,
}

const PAYOUTS: PayoutDTO[] = [
  {
    id: "po-1",
    stripePayoutId: "po_fake_1",
    amount: { amountMinor: 64000, currency: "USD" },
    status: "paid",
    arrivalDate: at(-4, 12),
    createdAt: at(-6, 12),
  },
  {
    id: "po-2",
    stripePayoutId: "po_fake_2",
    amount: { amountMinor: 32000, currency: "USD" },
    status: "in_transit",
    arrivalDate: at(1, 12),
    createdAt: at(-1, 12),
  },
]

const MEMBERS: OrganizationMemberDTO[] = [
  { person: person("u-me", "Ana Reyes"), role: "owner", joinedAt: at(-300, 9), canRemove: false },
  { person: person("p-jo", "Jo Mackey"), role: "admin", joinedAt: at(-120, 9), canRemove: true },
  { person: person("p-sam", "Sam Ortiz"), role: "member", joinedAt: at(-60, 9), canRemove: true },
]

export type PreviewMode = "loaded" | "loading" | "empty"

let MODE: PreviewMode = "loaded"

const never = <T,>(): Promise<T> => new Promise<T>(() => {})

function hostedPage(when: string | undefined): ListMyHostedEventsResponse {
  const past = when === "past"
  const items = MODE === "empty" ? [] : past ? PAST : UPCOMING
  return {
    items,
    nextCursor: null,
    kpis:
      MODE === "empty"
        ? { eventsHosted: 0, upcomingEvents: 0, totalRegistrations: 0, totalCheckedIn: 0 }
        : { eventsHosted: 14, upcomingEvents: 3, totalRegistrations: 412, totalCheckedIn: 338 },
  }
}

const fakeApi: ApiClient = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "then") return undefined
      const name = String(prop)
      if (name === "listMyOrganizations") return async () => ({ items: [ORG], nextCursor: null })
      if (name === "hostedEventsAnalytics") {
        return async (): Promise<HostedEventsAnalyticsResponse> => {
          if (MODE === "loading") return never<HostedEventsAnalyticsResponse>()
          if (MODE === "empty") {
            return {
              ...ANALYTICS,
              totals: { events: 0, registrations: 0, checkIns: 0, uniqueAttendees: 0 },
              series: [],
              byEvent: { panelSuppressed: false, rows: [] },
              repeatAttendance: { value: null, numerator: null, denominator: null, suppressed: true },
              averageCheckInRate: { value: null, numerator: null, denominator: null, suppressed: true },
              bestDayTime: null,
            }
          }
          return ANALYTICS
        }
      }
      if (name === "listMyHostedEvents") {
        return async (args?: { when?: string }): Promise<ListMyHostedEventsResponse> =>
          MODE === "loading" ? never<ListMyHostedEventsResponse>() : hostedPage(args?.when)
      }
      if (name === "listMyEventInvites") {
        return async (): Promise<ListMyEventInvitesResponse> =>
          MODE === "loaded" ? EVENT_INVITES : { items: [], nextCursor: null }
      }
      if (name === "listMyOrgInvites") {
        return async (): Promise<ListMyOrgInvitesResponse> =>
          MODE === "loaded" ? ORG_INVITES : { items: [] }
      }
      if (name === "getOrgPaymentsStatus") return async () => PAYMENTS_STATUS
      if (name === "getOrgBalance") return async () => BALANCE
      if (name === "getOrgDonationSummary") return async () => DONATION_SUMMARY
      if (name === "listOrgPayouts") return async () => ({ items: PAYOUTS, nextCursor: null })
      if (name === "listOrganizationMembers") return async () => ({ items: MEMBERS, nextCursor: null })
      if (name === "listOrganizationInvites") return async () => ({ items: [] })
      return (..._args: unknown[]): Promise<never> =>
        Promise.reject(new Error(`dashboard preview fake api: "${name}" not stubbed`))
    },
  },
) as ApiClient

const fakeData = makeFakeDataContext({
  api: fakeApi,
  auth: { isAuthenticated: true, user: VIEWER, isPending: false },
})

const fakeCaps = makeFakeCapabilities()

const MODES: readonly PreviewMode[] = ["loaded", "loading", "empty"]

const SCHEMES = ["light", "dark"] as const

function Frame({
  title,
  width,
  scheme,
  children,
}: {
  title: string
  width: number
  scheme: ColorSchemeName
  children: React.ReactNode
}) {
  const palette = colorSchemes[scheme]
  return (
    <section
      style={{
        width,
        flex: "0 0 auto",
        backgroundColor: palette.neutral.paper,
        borderRadius: theme.radius.lg,
        border: `1px solid ${palette.neutral.ink5}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${palette.neutral.ink5}`,
          font: "600 12px/1.2 system-ui, sans-serif",
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: palette.neutral.ink3,
          backgroundColor: palette.neutral.card,
        }}
      >
        {title}
      </div>
      <div style={{ height: "calc(100vh - 110px)", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </section>
  )
}

export default function DashboardPreview() {
  const [client, setClient] = React.useState(() => makeQueryClient())
  const [mode, setMode] = React.useState<PreviewMode>("loaded")
  const [scheme, setScheme] = React.useState<(typeof SCHEMES)[number]>("light")

  const pick = (next: PreviewMode) => {
    MODE = next
    setMode(next)
    setClient(makeQueryClient())
  }

  const button = (active: boolean): React.CSSProperties => ({
    font: "600 11px/1 system-ui, sans-serif",
    padding: "8px 12px",
    borderRadius: 999,
    cursor: "pointer",
    border: `1px solid ${active ? theme.colors.text : theme.colors.border}`,
    color: active ? theme.colors.text : theme.colors.textSubtle,
    backgroundColor: active ? theme.colors.surfaceTint : theme.colors.surface,
  })

  return (
    <QueryClientProvider client={client}>
      <ApiProvider value={fakeData}>
        <CapabilitiesProvider value={fakeCaps}>
          <ThemeProvider preference={scheme}>
          <div
            data-gallery="dashboard"
            style={{
              padding: 12,
              backgroundColor: colorSchemes[scheme].neutral.paper2,
              height: "100vh",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", gap: 8, padding: "4px 2px 12px", flexWrap: "wrap" }}>
              {MODES.map((option) => (
                <button key={option} style={button(option === mode)} onClick={() => pick(option)}>
                  {option}
                </button>
              ))}
              {SCHEMES.map((option) => (
                <button key={option} style={button(option === scheme)} onClick={() => setScheme(option)}>
                  {option}
                </button>
              ))}
            </div>
            <div
              key={`${mode}-${scheme}`}
              style={{ display: "flex", gap: 16, alignItems: "flex-start", overflowX: "auto" }}
            >
              <Frame title="EventDashboardBody 375" width={375} scheme={scheme}>
                <EventDashboardBody />
              </Frame>
              <Frame title="EventDashboardBody 560" width={560} scheme={scheme}>
                <EventDashboardBody />
              </Frame>
            </div>
          </div>
          </ThemeProvider>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>
  )
}
