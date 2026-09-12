"use client"

import React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import type { ApiClient } from "@civfix/shared/client"
import type {
  CleanupDTO,
  EventInsights,
  EventPhase,
  ListEventRegistrationsResponse,
  UserDTO,
} from "@civfix/shared"
import { ApiProvider, HostModeBody, makeFakeDataContext } from "@civfix/ui"
import { CapabilitiesProvider, makeFakeCapabilities } from "@civfix/ui/capabilities"
import { ThemeProvider, theme } from "@civfix/ui/theme"

import { makeQueryClient } from "@/lib/query"

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = Date.now()

const VIEWER: UserDTO = {
  id: "p-ann",
  email: "ann@example.org",
  name: "Ann Rivera",
  handle: "annrivera",
  role: "citizen",
  avatar: null,
  avatarUrl: null,
} as unknown as UserDTO

const ORGANIZER = {
  id: "p-ann",
  name: "Ann Rivera",
  handle: "annrivera",
  bio: null,
  avatar: null,
  avatarUrl: null,
  followers: 128,
  following: 64,
  isFollowing: false,
}

const PHASES: readonly EventPhase[] = ["upcoming", "live", "ended", "cancelled"]

const START: Readonly<Record<EventPhase, number>> = {
  upcoming: NOW + 3 * DAY,
  live: NOW - 40 * 60_000,
  ended: NOW - 9 * DAY,
  cancelled: NOW + 5 * DAY,
}

function cleanupFor(phase: EventPhase): CleanupDTO {
  return {
    id: `e-${phase}`,
    referenceCode: "RIV-4821",
    title: "Ballona Creek litter sweep",
    type: "site",
    eventKind: "cleanup",
    description: null,
    lat: 33.99,
    lng: -118.42,
    scheduledAt: new Date(START[phase]).toISOString(),
    endsAt: new Date(START[phase] + 3 * HOUR).toISOString(),
    status: phase === "ended" ? "done" : phase === "cancelled" ? "cancelled" : "upcoming",
    organizer: ORGANIZER,
    going: 38,
    joined: true,
    bring: [],
    address: "Ballona Creek Bike Path, Culver City",
    linkedReports: [],
    slots: [],
    visibility: "public",
    galleryUrls: [],
    ticketTypes: [],
    pageSlug: "ballona-creek-sweep",
    capacity: 50,
    registeredCount: 38,
    waitlistCount: 4,
    checkedInCount: 31,
    teamCount: 5,
    jurisdictionGeoid: "0644000",
    organization: { id: "o-1", slug: "reach-out-la", name: "Reach Out LA", verified: true },
    myCapabilities: [
      "view_roster",
      "view_analytics",
      "check_in",
      "manage_event",
      "manage_tickets",
      "manage_team",
      "broadcast",
      "cancel_event",
      "request_resources",
      "view_donations",
    ],
  } as unknown as CleanupDTO
}

function trend(days: number, peak: number) {
  return Array.from({ length: days }, (_unused, index) => ({
    day: new Date(NOW - (days - 1 - index) * DAY).toISOString().slice(0, 10),
    seats: Math.round((peak * (index + 1)) / days),
  }))
}

function arrivals() {
  return [
    { offsetMin: -30, seats: 2 },
    { offsetMin: -15, seats: 5 },
    { offsetMin: 0, seats: 9 },
    { offsetMin: 15, seats: 7 },
    { offsetMin: 30, seats: 4 },
    { offsetMin: 60, seats: 3 },
    { offsetMin: 90, seats: 1 },
  ]
}

function insightsFor(phase: EventPhase): EventInsights {
  const startsAt = new Date(START[phase]).toISOString()
  const base: EventInsights = {
    generatedAt: new Date(NOW - 4 * 60_000).toISOString(),
    phase,
    clock: {
      status: phase === "ended" ? "done" : phase === "cancelled" ? "cancelled" : "upcoming",
      startsAt,
      endsAt: new Date(START[phase] + 3 * HOUR).toISOString(),
      completedAt: phase === "ended" ? new Date(START[phase] + 3 * HOUR).toISOString() : null,
      registrationClosesAt: null,
      timezone: "America/Los_Angeles",
    },
    seats: {
      registered: 38,
      capacity: 50,
      waitlisted: 4,
      cancelled: 3,
      checkedIn: phase === "upcoming" || phase === "cancelled" ? 0 : 31,
      noShow: phase === "ended" ? 5 : 0,
      unmarked: phase === "ended" ? 2 : 38,
    },
    registrationTrend: trend(21, 38),
    byTicketType: [
      {
        ticketTypeId: "tt-1",
        name: "General volunteer",
        registered: 30,
        capacity: 40,
        waitlisted: 4,
        checkedIn: 25,
      },
      {
        ticketTypeId: "tt-2",
        name: "Kayak crew",
        registered: 8,
        capacity: 10,
        waitlisted: 0,
        checkedIn: 6,
      },
    ],
    bySource: [
      { source: "self", seats: 32 },
      { source: "waitlist", seats: 2 },
      { source: "walkup", seats: 4 },
    ],
    broadcasts: [
      {
        id: "b-1",
        kind: "reminder",
        finishedAt: new Date(NOW - 2 * DAY).toISOString(),
        recipients: 38,
        sent: 37,
        failed: 1,
        suppressed: 0,
      },
      {
        id: "b-2",
        kind: "host_broadcast",
        finishedAt: new Date(NOW - 5 * HOUR).toISOString(),
        recipients: 38,
        sent: 38,
        failed: 0,
        suppressed: 2,
      },
    ],
    arrivals: phase === "live" || phase === "ended" ? arrivals() : [],
    hours: {
      credited: phase === "ended" ? 62.5 : 0,
      attendeesCredited: phase === "ended" ? 25 : 0,
      attendeesCheckedIn: phase === "ended" ? 31 : 0,
    },
    money:
      phase === "ended"
        ? {
            currency: "USD",
            donationCount: 18,
            grossMinor: 124000,
            netMinor: 115100,
            refundedMinor: 0,
            lastChargedAt: new Date(NOW - 8 * DAY).toISOString(),
          }
        : null,
    returning: phase === "ended" ? { seats: 9, ofRegistered: 38 } : null,
  }
  return base
}

const ROSTER: ListEventRegistrationsResponse = {
  items: [
    {
      id: "r-1",
      kind: "user",
      seatCount: 2,
      ticketTypeName: "General volunteer",
      person: { ...ORGANIZER, id: "p-lou", name: "Lou Marquez", handle: "loum" },
      checkedInAt: new Date(NOW - HOUR).toISOString(),
      seats: [
        { id: "s-1", status: "active", checkedInAt: new Date(NOW - HOUR).toISOString() },
        { id: "s-2", status: "active", checkedInAt: new Date(NOW - HOUR).toISOString() },
      ],
    },
    {
      id: "r-2",
      kind: "guest",
      seatCount: 1,
      ticketTypeName: "Kayak crew",
      guestName: "Priya N.",
      checkedInAt: null,
      seats: [{ id: "s-3", status: "active", checkedInAt: null }],
    },
    {
      id: "r-3",
      kind: "user",
      seatCount: 1,
      ticketTypeName: "General volunteer",
      person: { ...ORGANIZER, id: "p-dee", name: "Dee Okafor", handle: "deeo" },
      checkedInAt: null,
      waitlistPosition: 1,
      seats: [{ id: "s-4", status: "active", checkedInAt: null }],
    },
  ],
  nextCursor: null,
} as unknown as ListEventRegistrationsResponse

type PreviewMode = "ready" | "loading" | "error"

let PHASE: EventPhase = "upcoming"
let MODE: PreviewMode = "ready"

const never = () => new Promise<never>(() => {})

const fakeApi: ApiClient = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "then") return undefined
      if (prop === "getCleanup") {
        return async (): Promise<CleanupDTO> => cleanupFor(PHASE)
      }
      if (prop === "getEventInsights") {
        if (MODE === "loading") return never
        return async (): Promise<EventInsights> => {
          if (MODE === "error") throw new Error("insights unavailable")
          return insightsFor(PHASE)
        }
      }
      if (prop === "listEventRegistrations") {
        return async (): Promise<ListEventRegistrationsResponse> =>
          MODE === "ready" ? ROSTER : ({ items: [], nextCursor: null } as ListEventRegistrationsResponse)
      }
      return (..._args: unknown[]): Promise<never> =>
        Promise.reject(new Error(`host-surface-preview: "${String(prop)}" not stubbed`))
    },
  },
) as ApiClient

const fakeData = makeFakeDataContext({
  api: fakeApi,
  auth: { isAuthenticated: true, user: VIEWER, isPending: false },
})

const fakeCaps = makeFakeCapabilities()

function readParams(): { phase: EventPhase; mode: PreviewMode; dark: boolean } {
  const search = typeof window === "undefined" ? "" : window.location.search
  const params = new URLSearchParams(search)
  const phase = params.get("phase") as EventPhase | null
  const mode = params.get("mode") as PreviewMode | null
  return {
    phase: phase && PHASES.includes(phase) ? phase : "upcoming",
    mode: mode === "loading" || mode === "error" ? mode : "ready",
    dark: params.get("scheme") === "dark",
  }
}

export default function HostSurfacePreview() {
  const [client] = React.useState(() => makeQueryClient())
  const [params] = React.useState(readParams)
  PHASE = params.phase
  MODE = params.mode

  return (
    <QueryClientProvider client={client}>
      <ApiProvider value={fakeData}>
        <CapabilitiesProvider value={fakeCaps}>
          <ThemeProvider preference={params.dark ? "dark" : "light"}>
            <div
              data-preview="host-surface"
              data-phase={params.phase}
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                backgroundColor: params.dark ? "#17130E" : theme.colors.bg,
              }}
            >
              <HostModeBody id={`e-${params.phase}`} />
            </div>
          </ThemeProvider>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>
  )
}
