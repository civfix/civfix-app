import React, { useMemo, useState } from "react"
import { View } from "react-native"
import type { HostedEventDTO } from "@civfix/shared"
import { nextEventBoundaryMs } from "@civfix/shared/host"
import { makeThemedStyles } from "../../theme"
import { iconMap } from "../../typography"
import { SignInPrompt } from "../../primitives"
import { NOW_TICK_MS, useAuthState, useEventBoundaryRefresh, useNow, useRequireAuth } from "../../data"
import { actableOrganizations, useMyOrganizations } from "../../data/hooks/orgs"
import { hostedEventRows, useEventInsights, useMyHostedEvents } from "../../data/hooks/host"
import { useCleanup } from "../../data/hooks/cleanups"
import { useHostedEventsAnalytics } from "../../data/hooks/dashboard"
import { useT } from "../../i18n"
import { useScrollHost } from "../../shell/ScrollHost"
import { NextUpSkeleton } from "./HostSkeletons"
import { TopVolunteersCard } from "./TopVolunteersCard"
import { AnalyticsCarouselCard } from "./dashboard/AnalyticsCarouselCard"
import { CollaboratorsSection } from "./dashboard/CollaboratorsSection"
import { DashboardHeader, ScopeMenu } from "./dashboard/DashboardHeader"
import { useScopeMenu } from "./dashboard/useScopeMenu"
import { DuplicateEventSheet } from "./dashboard/DuplicateEventSheet"
import { FirstEventCard } from "./dashboard/FirstEventCard"
import { HostedEventsSection, type EventWindow } from "./dashboard/HostedEventsSection"
import { ImpactCard } from "./dashboard/ImpactCard"
import { NextUpCard } from "./dashboard/NextUpCard"
import {
  dashboardScope,
  firstEventState,
  hostedEventWindow,
  nextUpEvent,
  portfolioKpis,
} from "./dashboard/dashboardModel"
import { useDashboardStore } from "./dashboard/dashboardStore"
import { useHostedEventNav } from "./dashboard/useHostedEventNav"

const ANALYTICS_RANGE = "all"

function soonestBoundary(events: readonly HostedEventDTO[], at: number): number | null {
  const ahead = events.flatMap((event) => {
    const boundary = nextEventBoundaryMs(hostedEventWindow(event), at)
    return boundary === null ? [] : [boundary]
  })
  return ahead.length === 0 ? null : Math.min(...ahead)
}

export function EventDashboardBody() {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()
  const { t } = useT("event-dashboard")
  const { isAuthenticated, isPending: authPending } = useAuthState()
  const requireAuth = useRequireAuth()

  const requestedOrgId = useDashboardStore((s) => s.orgId)
  const setOrgId = useDashboardStore((s) => s.setOrgId)

  const [eventWindow, setEventWindow] = useState<EventWindow>("upcoming")
  const [duplicating, setDuplicating] = useState<HostedEventDTO | null>(null)
  const scopeMenu = useScopeMenu()

  const orgsQuery = useMyOrganizations()
  const orgs = useMemo(() => actableOrganizations(orgsQuery.data) ?? [], [orgsQuery.data])
  const scope = useMemo(() => dashboardScope(orgs, requestedOrgId), [orgs, requestedOrgId])
  const activeOrgId = scope.orgId

  const analytics = useHostedEventsAnalytics(ANALYTICS_RANGE, activeOrgId)
  const upcoming = useMyHostedEvents("upcoming", activeOrgId)
  const past = useMyHostedEvents("past", activeOrgId)

  const upcomingEvents = useMemo(() => hostedEventRows(upcoming.data?.pages), [upcoming.data])
  const pastEvents = useMemo(() => hostedEventRows(past.data?.pages), [past.data])
  const boundaryAt = soonestBoundary(upcomingEvents, Date.now())
  const nowMs = useNow(NOW_TICK_MS, { boundaryAt })
  const now = useMemo(() => new Date(nowMs), [nowMs])
  const nextUp = nextUpEvent([...upcomingEvents, ...pastEvents], now)
  const kpis = portfolioKpis(upcoming.data?.pages)
  useEventBoundaryRefresh(
    nextUp ? hostedEventWindow(nextUp.event) : null,
    nowMs,
    nextUp?.event.id ?? null,
  )
  const teaching = firstEventState(kpis, upcomingEvents)

  const nextUpCleanup = useCleanup(nextUp?.event.id)
  const nextUpInsights = useEventInsights(nextUp?.event.id, {
    enabled: nextUp?.phase === "live",
    live: true,
  })
  const liveCheckedIn =
    nextUp?.phase === "live"
      ? (nextUpInsights.data?.seats.checkedIn ?? nextUp.event.checkedInCount)
      : null

  const nav = useHostedEventNav(activeOrgId)
  const { onCreate, onOpenEvent, onHostTools, onShare } = nav

  if (!isAuthenticated && !authPending) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.stateContent}
        showsVerticalScrollIndicator={false}
      >
        <SignInPrompt
          icon={iconMap.Calendar}
          iconSize={32}
          variant="detail"
          title={t("state.signin_title")}
          body={t("state.signin_body")}
          onSignIn={() => requireAuth(() => {}, { next: "/dashboard" })}
        />
      </ScrollView>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stack}>
        <DashboardHeader
          scope={scope}
          kpis={kpis}
          teaching={teaching}
          scopeMenu={scopeMenu}
          onCreate={onCreate}
        />

        {upcoming.isPending ? <NextUpSkeleton /> : null}

        {teaching || upcoming.isPending ? null : nextUp ? (
          <NextUpCard
            event={nextUp.event}
            phase={nextUp.phase}
            slots={nextUpCleanup.data?.slots ?? []}
            liveCheckedIn={liveCheckedIn}
            now={nowMs}
            onOpen={onOpenEvent}
            onHostTools={onHostTools}
            onShare={onShare}
          />
        ) : null}

        {teaching ? <FirstEventCard onCreate={onCreate} /> : null}

        {teaching ? null : (
          <>
            <AnalyticsCarouselCard orgId={activeOrgId} />

            <ImpactCard
              analytics={analytics.data}
              isPending={analytics.isPending}
              isError={analytics.isError}
              onRetry={() => void analytics.refetch()}
            />

            {analytics.isPending || analytics.isError ? null : (
              <TopVolunteersCard
                entries={analytics.data?.topVolunteers ?? []}
                label={t("top_volunteers.section")}
                caption={t("top_volunteers.caption")}
              />
            )}

            <HostedEventsSection
              eventWindow={eventWindow}
              onWindowChange={setEventWindow}
              upcoming={upcoming}
              past={past}
              now={now}
              nav={nav}
              onDuplicate={setDuplicating}
            />
          </>
        )}

        {scope.org ? <CollaboratorsSection org={scope.org} /> : null}
      </View>

      <ScopeMenu scopeMenu={scopeMenu} orgs={orgs} activeOrgId={activeOrgId} onSelect={setOrgId} />

      <DuplicateEventSheet event={duplicating} onClose={() => setDuplicating(null)} />
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  stack: {
    gap: t.space["6"],
  },
  stateContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
}))
