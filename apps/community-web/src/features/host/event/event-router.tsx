"use client"

import { Suspense, lazy, useMemo } from "react"
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Megaphone,
  ScanLine,
  Settings,
  Ticket,
  Users,
  UserCog,
} from "lucide-react"
import type { HostCapability } from "@civfix/shared"
import { cleanupHostStanding, useAuthState, useCleanup, hasHostCapability } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { hrefForRoute, railSectionForRoute } from "@/components/console/route"
import type { ConsoleRoute, EventSection } from "@/components/console/route"
import { useGate } from "@/components/console/query-state"
import { LoadingState, NoAccessState, NotFoundState, StateGate } from "@/components/console/states"
import { Chip } from "@/components/console/chips/chip"

import { ConsoleShell } from "../layout/console-shell"
import { Breadcrumbs } from "../layout/breadcrumbs"
import { EventSwitcher } from "../layout/event-switcher"
import { MAX_BOTTOM_TABS } from "../layout/nav-items"
import type { ConsoleNavItem } from "../layout/nav-items"
import { ConsoleEventProvider, useConsoleNavigation } from "../console-context"
import { useConsoleFormat } from "../format"

const OverviewScreen = lazy(() =>
  import("./overview-screen").then((m) => ({ default: m.OverviewScreen })),
)
const PageBuilderScreen = lazy(() =>
  import("../page-builder/page-builder-screen").then((m) => ({ default: m.PageBuilderScreen })),
)
const TicketsScreen = lazy(() =>
  import("../tickets/tickets-screen").then((m) => ({ default: m.TicketsScreen })),
)
const AttendeesScreen = lazy(() =>
  import("../attendees/attendees-screen").then((m) => ({ default: m.AttendeesScreen })),
)
const CheckinScreen = lazy(() =>
  import("../checkin/checkin-screen").then((m) => ({ default: m.CheckinScreen })),
)
const BroadcastsRouter = lazy(() =>
  import("../broadcasts/broadcasts-router").then((m) => ({ default: m.BroadcastsRouter })),
)
const AnalyticsScreen = lazy(() =>
  import("../analytics/analytics-screen").then((m) => ({ default: m.AnalyticsScreen })),
)
const TeamScreen = lazy(() => import("../team/team-screen").then((m) => ({ default: m.TeamScreen })))
const SettingsScreen = lazy(() =>
  import("../settings/settings-screen").then((m) => ({ default: m.SettingsScreen })),
)

const SECTION_CAPABILITY: Record<EventSection, HostCapability> = {
  overview: "view_event_private",
  page: "manage_page",
  tickets: "manage_tickets",
  attendees: "view_roster",
  checkin: "check_in",
  broadcasts: "broadcast",
  analytics: "view_analytics",
  team: "manage_team",
  settings: "manage_event",
}

const SECTION_ICON = {
  overview: LayoutDashboard,
  page: FileText,
  tickets: Ticket,
  attendees: Users,
  checkin: ScanLine,
  broadcasts: Megaphone,
  analytics: BarChart3,
  team: UserCog,
  settings: Settings,
} as const

const BOTTOM_TAB_ORDER: readonly EventSection[] = [
  "overview",
  "attendees",
  "checkin",
  "broadcasts",
  "settings",
]

/** Overview is the fallback only for someone who may see it; otherwise exit would loop back here. */
export function noAccessExitRoute(canViewOverview: boolean, eventId: string): ConsoleRoute {
  return canViewOverview ? { kind: "event", eventId, section: "overview" } : { kind: "portfolio" }
}

export function EventRouter({ route }: { route: ConsoleRoute }) {
  const { t } = useT("host-event")
  const { t: tc } = useT("host-common")
  const { go } = useConsoleNavigation()

  const eventId =
    route.kind === "event" ||
    route.kind === "broadcasts" ||
    route.kind === "broadcast-new" ||
    route.kind === "broadcast"
      ? route.eventId
      : ""

  const cleanup = useCleanup(eventId)
  const gate = useGate(cleanup)
  const event = cleanup.data ?? null
  const format = useConsoleFormat(event?.timezone ?? undefined)
  const viewerId = useAuthState().user?.id ?? null
  const standing = useMemo(() => cleanupHostStanding(event, viewerId), [event, viewerId])
  const section = railSectionForRoute(route)

  const navItems = useMemo<ConsoleNavItem[]>(() => {
    if (!event) return []
    return (Object.keys(SECTION_CAPABILITY) as EventSection[])
      .filter((id) => hasHostCapability(standing, SECTION_CAPABILITY[id]))
      .map((id) => ({
        id,
        label: t(`nav.${id}`),
        icon: SECTION_ICON[id],
        href:
          id === "broadcasts"
            ? hrefForRoute({ kind: "broadcasts", eventId })
            : hrefForRoute({ kind: "event", eventId, section: id }),
      }))
  }, [event, eventId, standing, t])

  const bottomTabs = useMemo(
    () =>
      BOTTOM_TAB_ORDER.map((id) => navItems.find((item) => item.id === id)).filter(
        (item): item is ConsoleNavItem => item !== undefined,
      ),
    [navItems],
  )

  const allowed =
    section !== null && event !== null && hasHostCapability(standing, SECTION_CAPABILITY[section])

  return (
    <ConsoleShell
      navItems={navItems}
      bottomTabs={bottomTabs.length > 0 ? bottomTabs : navItems.slice(0, MAX_BOTTOM_TABS)}
      activeId={section}
      title={event?.title ?? tc("state.loading")}
      headerActions={<EventSwitcher eventId={eventId} section={section} />}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: t("breadcrumb.events"), href: hrefForRoute({ kind: "portfolio" }) },
            { label: event?.title ?? "…" },
          ]}
        />
      }
      subtitle={
        event ? (
          <>
            <span>{format.whenLabel(event.scheduledAt)}</span>
            <Chip kind="event-status" value={event.status} size="sm" />
            <Chip kind="event-visibility" value={event.visibility} size="sm" />
            {event.registrationState ? (
              <Chip kind="registration-state" value={event.registrationState} size="sm" />
            ) : null}
          </>
        ) : undefined
      }
    >
      <StateGate
        {...gate}
        onRetry={() => void cleanup.refetch()}
        skeleton={<LoadingState count={6} />}
        notFoundState={
          <NotFoundState
            title={t("not_found_title")}
            body={t("not_found_body")}
            onExit={() => go({ kind: "portfolio" })}
          />
        }
      >
        {event === null ? null : !allowed ? (
          <NoAccessState
            title={t("no_access_title")}
            body={t("no_access_body")}
            onExit={() =>
              go(
                noAccessExitRoute(
                  hasHostCapability(standing, SECTION_CAPABILITY.overview),
                  eventId,
                ),
              )
            }
          />
        ) : (
          <ConsoleEventProvider eventId={eventId} event={event}>
            <Suspense fallback={<LoadingState count={5} />}>
              {route.kind === "broadcasts" ||
              route.kind === "broadcast-new" ||
              route.kind === "broadcast" ? (
                <BroadcastsRouter route={route} />
              ) : route.kind === "event" ? (
                <EventSectionScreen section={route.section} />
              ) : null}
            </Suspense>
          </ConsoleEventProvider>
        )}
      </StateGate>
    </ConsoleShell>
  )
}

function EventSectionScreen({ section }: { section: Exclude<EventSection, "broadcasts"> }) {
  switch (section) {
    case "overview":
      return <OverviewScreen />
    case "page":
      return <PageBuilderScreen />
    case "tickets":
      return <TicketsScreen />
    case "attendees":
      return <AttendeesScreen />
    case "checkin":
      return <CheckinScreen />
    case "analytics":
      return <AnalyticsScreen />
    case "team":
      return <TeamScreen />
    case "settings":
      return <SettingsScreen />
  }
}

