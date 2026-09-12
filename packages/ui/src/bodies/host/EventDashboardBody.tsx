import React, { useCallback, useMemo, useState } from "react"
import { Pressable, View, type LayoutChangeEvent } from "react-native"
import type { CleanupMemberRole, HostedEventDTO } from "@civfix/shared"
import {
  focusRingProps,
  headingLevel,
  makeThemedStyles,
  webCursor,
  webHover,
  webTransition,
} from "../../theme"
import { Text, TextLink, iconMap } from "../../typography"
import {
  Avatar,
  EmptyState,
  SectionCard,
  SecondaryButton,
  SegmentedControl,
  SignInPrompt,
  SkeletonGroup,
  SkeletonList,
  statTileColumns,
  useToast,
} from "../../primitives"
import { useAuthState, useRequireAuth } from "../../data"
import { actableOrganizations, useMyOrganizations } from "../../data/hooks/orgs"
import {
  hostedEventRows,
  myEventInviteRows,
  useAcceptMyEventInvite,
  useDeclineMyEventInvite,
  useMyEventInvites,
  useMyHostedEvents,
} from "../../data/hooks/host"
import { useHostedEventsAnalytics } from "../../data/hooks/dashboard"
import {
  useAcceptMyOrgInvite,
  useDeclineMyOrgInvite,
  useMyOrgInvites,
} from "../../data/hooks/orgs"
import { useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { openHostDashboard } from "../hostDashboardTarget"
import { CollaboratorsSection } from "./dashboard/CollaboratorsSection"
import { ConsoleLinkRow } from "./dashboard/ConsoleLinkRow"
import { DuplicateEventSheet } from "./dashboard/DuplicateEventSheet"
import { EventInviteRow, OrgInviteRow } from "./dashboard/InviteRows"
import { HostedEventRow } from "./dashboard/HostedEventRow"
import { NextUpCard } from "./dashboard/NextUpCard"
import { MoneySection } from "./dashboard/MoneySection"
import { PortfolioStats } from "./dashboard/PortfolioStats"
import { TopEventsCard } from "./dashboard/TopEventsCard"
import {
  buildDashboardTabs,
  DASHBOARD_TABS,
  hostedEventCan,
  hostedEventPhase,
  nextUpEvent,
  portfolioKpis,
  topEventBars,
  topEventsVisible,
  type DashboardTab,
} from "./dashboard/dashboardModel"
import { emailAttendeesPreset, useDashboardStore } from "./dashboard/dashboardStore"

type EventWindow = "upcoming" | "past"

const EVENT_WINDOWS: readonly EventWindow[] = ["upcoming", "past"]

export function EventDashboardBody() {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()
  const { t } = useT("event-dashboard")
  const { t: tEnums } = useT("enums")
  const toast = useToast()
  const { isAuthenticated, isPending: authPending } = useAuthState()
  const requireAuth = useRequireAuth()

  const tab = useDashboardStore((s) => s.tab)
  const orgId = useDashboardStore((s) => s.orgId)
  const range = useDashboardStore((s) => s.range)
  const setTab = useDashboardStore((s) => s.setTab)
  const setOrgId = useDashboardStore((s) => s.setOrgId)
  const setRange = useDashboardStore((s) => s.setRange)
  const setBroadcastPreset = useDashboardStore((s) => s.setBroadcastPreset)

  const [eventWindow, setEventWindow] = useState<EventWindow>("upcoming")
  const [duplicating, setDuplicating] = useState<HostedEventDTO | null>(null)
  const [contentWidth, setContentWidth] = useState(0)
  const columns = statTileColumns(contentWidth)
  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    setContentWidth(event.nativeEvent.layout.width)
  }, [])

  const orgsQuery = useMyOrganizations()
  const orgs = useMemo(() => actableOrganizations(orgsQuery.data) ?? [], [orgsQuery.data])
  const tabs = useMemo(
    () => buildDashboardTabs({ orgs, requestedTab: tab, requestedOrgId: orgId }),
    [orgId, orgs, tab],
  )
  const activeOrgId = tabs.tab === "org" ? tabs.selectedOrgId : null

  const analytics = useHostedEventsAnalytics(range, activeOrgId)
  const hosted = useMyHostedEvents(eventWindow, activeOrgId)
  const upcoming = useMyHostedEvents("upcoming", activeOrgId)
  const eventInvites = useMyEventInvites()
  const orgInvites = useMyOrgInvites()
  const acceptEvent = useAcceptMyEventInvite()
  const declineEvent = useDeclineMyEventInvite()
  const acceptOrg = useAcceptMyOrgInvite()
  const declineOrg = useDeclineMyOrgInvite()

  const now = new Date()
  const events = useMemo(() => hostedEventRows(hosted.data?.pages), [hosted.data])
  const upcomingEvents = useMemo(() => hostedEventRows(upcoming.data?.pages), [upcoming.data])
  const nextUp = nextUpEvent(upcomingEvents, now)
  const kpis = portfolioKpis(upcoming.data?.pages)
  const topBars = useMemo(() => topEventBars(analytics.data?.byEvent), [analytics.data])
  const pendingEventInvites = useMemo(
    () => myEventInviteRows(eventInvites.data),
    [eventInvites.data],
  )
  const pendingOrgInviteRows = useMemo(() => orgInvites.data ?? [], [orgInvites.data])

  const roleLabel = useCallback(
    (role: CleanupMemberRole) => tEnums(`cleanupMemberRole.${role}`),
    [tEnums],
  )

  const onCreate = useCallback(() => {
    requireAuth(
      () => {
        useNavStore.getState().push({
          kind: "create-cleanup",
          ...(activeOrgId ? { organizationId: activeOrgId } : {}),
        })
      },
      { next: "/host" },
    )
  }, [activeOrgId, requireAuth])

  const onOpenEvent = useCallback((event: HostedEventDTO) => {
    useNavStore.getState().push({ kind: "cleanup", id: event.id, title: event.title })
  }, [])

  const onHostTools = useCallback((event: HostedEventDTO) => {
    openHostDashboard({ eventId: event.id })
  }, [])

  const onCheckIn = useCallback((event: HostedEventDTO) => {
    useNavStore.getState().push({ kind: "host-checkin", id: event.id })
  }, [])

  const onNextUp = useCallback(
    (event: HostedEventDTO) => {
      if (hostedEventPhase(event, new Date()) === "live" && hostedEventCan(event, "check_in")) {
        onCheckIn(event)
        return
      }
      onHostTools(event)
    },
    [onCheckIn, onHostTools],
  )

  const onEmailAttendees = useCallback(
    (event: HostedEventDTO) => {
      setBroadcastPreset(emailAttendeesPreset(event.id))
      useNavStore.getState().push({ kind: "host-broadcast-quick", id: event.id })
    },
    [setBroadcastPreset],
  )

  const onEdit = useCallback((event: HostedEventDTO) => {
    useNavStore.getState().push({ kind: "edit-cleanup", id: event.id })
  }, [])

  const onInviteError = useCallback(() => {
    toast.show(t("invites.error"), { variant: "error" })
  }, [t, toast])

  const acceptEventMutate = acceptEvent.mutate
  const declineEventMutate = declineEvent.mutate
  const acceptOrgMutate = acceptOrg.mutate
  const declineOrgMutate = declineOrg.mutate

  const onAcceptEventInvite = useCallback(
    (inviteId: string) => acceptEventMutate({ inviteId }, { onError: onInviteError }),
    [acceptEventMutate, onInviteError],
  )
  const onDeclineEventInvite = useCallback(
    (inviteId: string) => declineEventMutate({ inviteId }, { onError: onInviteError }),
    [declineEventMutate, onInviteError],
  )
  const onAcceptOrgInvite = useCallback(
    (inviteId: string) => acceptOrgMutate({ inviteId }, { onError: onInviteError }),
    [acceptOrgMutate, onInviteError],
  )
  const onDeclineOrgInvite = useCallback(
    (inviteId: string) => declineOrgMutate({ inviteId }, { onError: onInviteError }),
    [declineOrgMutate, onInviteError],
  )

  const pendingEventInviteId =
    (acceptEvent.isPending ? acceptEvent.variables?.inviteId : undefined) ??
    (declineEvent.isPending ? declineEvent.variables?.inviteId : undefined) ??
    null
  const pendingOrgInviteId =
    (acceptOrg.isPending ? acceptOrg.variables?.inviteId : undefined) ??
    (declineOrg.isPending ? declineOrg.variables?.inviteId : undefined) ??
    null

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

  const invitesPending = eventInvites.isPending || orgInvites.isPending
  const invitesError = eventInvites.isError || orgInvites.isError
  const invitesVisible =
    pendingEventInvites.length > 0 || pendingOrgInviteRows.length > 0 || invitesPending || invitesError

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stack} onLayout={onContentLayout}>
        {tabs.orgTabVisible ? (
          <SegmentedControl
            label={t("tabs.label")}
            selected={tabs.tab}
            onSelect={(key) => setTab(key as DashboardTab)}
            options={DASHBOARD_TABS.map((key) => ({ key, label: t(`tabs.${key}`) }))}
          />
        ) : null}

        {tabs.orgPickerVisible ? (
          <View
            style={styles.orgRow}
            accessibilityRole="radiogroup"
            accessibilityLabel={t("org_picker.label")}
          >
            {orgs.map((org) => {
              const on = org.id === tabs.selectedOrgId
              return (
                <Pressable
                  key={org.id}
                  onPress={() => setOrgId(org.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={org.name}
                  {...focusRingProps}
                  style={(state) => [
                    styles.orgChip,
                    webTransition,
                    webCursor(),
                    on ? styles.orgChipOn : null,
                    !on && webHover(state) ? styles.orgChipHovered : null,
                  ]}
                >
                  <Avatar name={org.name} seed={org.id} photoUrl={org.logoUrl ?? null} size={20} />
                  <Text style={[styles.orgChipText, on ? styles.orgChipTextOn : null]} numberOfLines={1}>
                    {org.name}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}

        <View style={styles.header}>
          <View style={styles.headerMeta}>
            <Text variant="title" accessibilityRole="header" {...headingLevel(1)}>
              {t("header.title")}
            </Text>
            {kpis ? (
              <Text variant="caption" numberOfLines={1}>
                {t("header.summary", {
                  upcoming: kpis.upcomingEvents,
                  hosted: kpis.eventsHosted,
                })}
              </Text>
            ) : null}
          </View>
          {nextUp ? (
            <SecondaryButton
              size="sm"
              icon={iconMap.Plus}
              label={t("create.action")}
              accessibilityLabel={
                tabs.tab === "org" && tabs.selectedOrg
                  ? t("create.a11y_org", { org: tabs.selectedOrg.name })
                  : t("create.a11y_personal")
              }
              onPress={onCreate}
            />
          ) : null}
        </View>

        {nextUp ? (
          <NextUpCard
            event={nextUp.event}
            phase={nextUp.phase}
            onOpen={onOpenEvent}
            onPrimary={onNextUp}
          />
        ) : null}

        {!nextUp && !upcoming.isPending ? (
          <SectionCard label={t("next_up.section")}>
            <EmptyState
              tone="neutral"
              icon={iconMap.Calendar}
              title={t("next_up.empty_title")}
              body={t("next_up.empty_body")}
              cta={{ label: t("create.action"), icon: iconMap.Plus, onPress: onCreate }}
            />
          </SectionCard>
        ) : null}

        <PortfolioStats
          analytics={analytics.data}
          isPending={analytics.isPending}
          isError={analytics.isError}
          range={range}
          columns={columns}
          onRange={setRange}
          onRetry={() => void analytics.refetch()}
        />

        {topEventsVisible(analytics.data?.byEvent, topBars) ? (
          <TopEventsCard bars={topBars} />
        ) : null}

        {invitesVisible ? (
          <SectionCard label={t("invites.section")}>
            <View style={styles.rows}>
              {invitesError ? (
                <FeedNotice
                  icon="CloudOff"
                  title={t("invites.error_title")}
                  body={t("invites.error_body")}
                  actionLabel={t("invites.retry")}
                  onAction={() => {
                    if (eventInvites.isError) void eventInvites.refetch()
                    if (orgInvites.isError) void orgInvites.refetch()
                  }}
                />
              ) : null}
              {!invitesError && invitesPending ? (
                <SkeletonGroup>
                  <SkeletonList kind="person" rows={2} />
                </SkeletonGroup>
              ) : null}
              {pendingEventInvites.map((invite) => (
                <EventInviteRow
                  key={invite.id}
                  invite={invite}
                  roleLabel={roleLabel(invite.role)}
                  pending={pendingEventInviteId === invite.id}
                  onAccept={onAcceptEventInvite}
                  onDecline={onDeclineEventInvite}
                />
              ))}
              {pendingOrgInviteRows.map((invite) => (
                <OrgInviteRow
                  key={invite.id}
                  invite={invite}
                  roleLabel={tEnums(`organizationMemberRole.${invite.role}`)}
                  pending={pendingOrgInviteId === invite.id}
                  onAccept={onAcceptOrgInvite}
                  onDecline={onDeclineOrgInvite}
                />
              ))}
            </View>
          </SectionCard>
        ) : null}

        <SectionCard
          label={t("events.section")}
          trailing={
            <SegmentedControl
              size="sm"
              label={t("events.label")}
              selected={eventWindow}
              onSelect={(key) => setEventWindow(key as EventWindow)}
              options={EVENT_WINDOWS.map((key) => ({ key, label: t(`events.${key}`) }))}
            />
          }
        >
          <View style={styles.rows}>
            {hosted.isError ? (
              <FeedNotice
                icon="CloudOff"
                title={t("events.error_title")}
                body={t("events.error_body")}
                actionLabel={t("events.retry")}
                onAction={() => void hosted.refetch()}
              />
            ) : null}

            {hosted.isPending ? (
              <SkeletonGroup>
                <SkeletonList kind="report" rows={3} />
              </SkeletonGroup>
            ) : null}

            {!hosted.isPending && !hosted.isError && events.length === 0 ? (
              <EmptyState
                tone="neutral"
                icon={iconMap.Calendar}
                title={t(`events.empty_${eventWindow}_title`)}
                body={t(`events.empty_${eventWindow}_body`)}
              />
            ) : null}

            {events.map((event) => (
              <HostedEventRow
                key={event.id}
                event={event}
                roleLabel={roleLabel}
                live={hostedEventPhase(event, now) === "live"}
                onOpen={onOpenEvent}
                onCheckIn={onCheckIn}
                onHostTools={onHostTools}
                onEmailAttendees={onEmailAttendees}
                onDuplicate={setDuplicating}
                onEdit={onEdit}
              />
            ))}

            {hosted.hasNextPage ? (
              <TextLink
                variant="label"
                standalone
                accessibilityLabel={t("events.show_more")}
                onPress={() => {
                  void hosted.fetchNextPage()
                }}
              >
                {hosted.isFetchingNextPage ? t("events.loading_more") : t("events.show_more")}
              </TextLink>
            ) : null}
          </View>
        </SectionCard>

        {tabs.tab === "org" && tabs.selectedOrg ? (
          <>
            <MoneySection org={tabs.selectedOrg} range={range} />
            <CollaboratorsSection org={tabs.selectedOrg} />
          </>
        ) : null}

        <ConsoleLinkRow
          target={activeOrgId ? { kind: "org", orgId: activeOrgId } : { kind: "portfolio" }}
        />
      </View>

      <DuplicateEventSheet event={duplicating} onClose={() => setDuplicating(null)} />
    </ScrollView>
  )
}

const MIN_TOUCH_TARGET = 44

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["10"],
  },
  stack: {
    gap: t.space["6"],
  },
  stateContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  headerMeta: {
    flex: 1,
    minWidth: 0,
  },
  rows: {
    gap: t.space["3"],
  },
  orgRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
  },
  orgChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    minHeight: MIN_TOUCH_TARGET,
    paddingRight: t.space["3"],
    paddingLeft: t.space["1"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  orgChipOn: {
    backgroundColor: t.colors.surfaceTint,
  },
  orgChipHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  orgChipText: {
    maxWidth: 160,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
  },
  orgChipTextOn: {
    color: t.colors.text,
  },
}))
