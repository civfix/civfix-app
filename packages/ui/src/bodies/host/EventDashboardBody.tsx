import React, { useCallback, useMemo, useState } from "react"
import { View } from "react-native"
import type { CleanupMemberRole, HostedEventDTO } from "@civfix/shared"
import { nextEventBoundaryMs } from "@civfix/shared/host"
import { headingLevel, makeThemedStyles } from "../../theme"
import { Text, TextLink, iconMap, type LucideIcon } from "../../typography"
import {
  Avatar,
  LIST_DIVIDER_INSET,
  MetaDot,
  PopoverMenu,
  SectionCard,
  SecondaryButton,
  SegmentedControl,
  shareLink,
  SignInPrompt,
  SkeletonGroup,
  SkeletonList,
  usePopoverAnchor,
  useToast,
} from "../../primitives"
import type { AnchorRect } from "../../primitives"
import { NOW_TICK_MS, useAuthState, useEventBoundaryRefresh, useNow, useRequireAuth } from "../../data"
import { actableOrganizations, useMyOrganizations } from "../../data/hooks/orgs"
import {
  hostedEventRows,
  myEventInviteRows,
  useAcceptMyEventInvite,
  useDeclineMyEventInvite,
  useEventInsights,
  useMyEventInvites,
  useMyHostedEvents,
} from "../../data/hooks/host"
import { useCleanup } from "../../data/hooks/cleanups"
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
import { NextUpSkeleton } from "./HostSkeletons"
import { TopVolunteersCard } from "./TopVolunteersCard"
import { AttentionCard } from "./dashboard/AttentionCard"
import { CollaboratorsSection } from "./dashboard/CollaboratorsSection"
import { ConsoleLinkRow } from "./dashboard/ConsoleLinkRow"
import { DuplicateEventSheet } from "./dashboard/DuplicateEventSheet"
import { FirstEventCard } from "./dashboard/FirstEventCard"
import { HostedEventRow } from "./dashboard/HostedEventRow"
import { ImpactCard } from "./dashboard/ImpactCard"
import { NextUpCard } from "./dashboard/NextUpCard"
import { DonationLinkRow } from "./dashboard/DonationLinkRow"
import {
  ATTENTION_MAX_ROWS,
  attentionRows,
  dashboardScope,
  firstEventState,
  hostedEventPhase,
  hostedEventWindow,
  nextUpEvent,
  portfolioKpis,
  sharePathFor,
} from "./dashboard/dashboardModel"
import { emailAttendeesPreset, useDashboardStore } from "./dashboard/dashboardStore"

type EventWindow = "upcoming" | "past"

const EVENT_WINDOWS: readonly EventWindow[] = ["upcoming", "past"]

const SCOPE_AVATAR = 20

const SCOPE_MENU_SELF = "self"

const ANALYTICS_RANGE = "all"

const HEADER_ROW_HEIGHT = 32

const SCOPE_PILL_MAX_WIDTH = "60%"

const MORE_ROW_HEIGHT = 44

function soonestBoundary(events: readonly HostedEventDTO[], at: number): number | null {
  const ahead = events.flatMap((event) => {
    const boundary = nextEventBoundaryMs(hostedEventWindow(event), at)
    return boundary === null ? [] : [boundary]
  })
  return ahead.length === 0 ? null : Math.min(...ahead)
}

function avatarIcon(name: string, seed: string, photoUrl: string | null): LucideIcon {
  return function ScopeAvatar() {
    return <Avatar name={name} seed={seed} photoUrl={photoUrl} size={SCOPE_AVATAR} decorative />
  }
}

export function EventDashboardBody() {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()
  const { t } = useT("event-dashboard")
  const { t: tEnums } = useT("enums")
  const toast = useToast()
  const { isAuthenticated, isPending: authPending, user } = useAuthState()
  const requireAuth = useRequireAuth()

  const requestedOrgId = useDashboardStore((s) => s.orgId)
  const setOrgId = useDashboardStore((s) => s.setOrgId)
  const setBroadcastPreset = useDashboardStore((s) => s.setBroadcastPreset)

  const [eventWindow, setEventWindow] = useState<EventWindow>("upcoming")
  const [duplicating, setDuplicating] = useState<HostedEventDTO | null>(null)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [scopeRect, setScopeRect] = useState<AnchorRect | null>(null)
  const { ref: scopeAnchorRef, measure: measureScope } = usePopoverAnchor(setScopeRect)

  const orgsQuery = useMyOrganizations()
  const orgs = useMemo(() => actableOrganizations(orgsQuery.data) ?? [], [orgsQuery.data])
  const scope = useMemo(() => dashboardScope(orgs, requestedOrgId), [orgs, requestedOrgId])
  const activeOrgId = scope.orgId

  const analytics = useHostedEventsAnalytics(ANALYTICS_RANGE, activeOrgId)
  const upcoming = useMyHostedEvents("upcoming", activeOrgId)
  const past = useMyHostedEvents("past", activeOrgId)
  const hosted = eventWindow === "past" ? past : upcoming
  const eventInvites = useMyEventInvites()
  const orgInvites = useMyOrgInvites()
  const acceptEvent = useAcceptMyEventInvite()
  const declineEvent = useDeclineMyEventInvite()
  const acceptOrg = useAcceptMyOrgInvite()
  const declineOrg = useDeclineMyOrgInvite()

  const events = useMemo(() => hostedEventRows(hosted.data?.pages), [hosted.data])
  const upcomingEvents = useMemo(() => hostedEventRows(upcoming.data?.pages), [upcoming.data])
  const pastEvents = useMemo(() => hostedEventRows(past.data?.pages), [past.data])
  const boundaryAt = soonestBoundary(upcomingEvents, Date.now())
  const nowMs = useNow(NOW_TICK_MS, { boundaryAt })
  const now = useMemo(() => new Date(nowMs), [nowMs])
  const nextUp = nextUpEvent([...upcomingEvents, ...pastEvents], now)
  const kpis = portfolioKpis(upcoming.data?.pages)
  const tasks = useMemo(
    () => attentionRows({ past: pastEvents, now }).slice(0, ATTENTION_MAX_ROWS),
    [pastEvents, now],
  )
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

  const onEmailAttendees = useCallback(
    (event: HostedEventDTO) => {
      setBroadcastPreset(emailAttendeesPreset(event.id))
      useNavStore.getState().push({ kind: "host-broadcast-quick", id: event.id })
    },
    [setBroadcastPreset],
  )

  const onLogHours = useCallback((event: HostedEventDTO) => {
    useNavStore.getState().push({ kind: "host-log-hours", id: event.id })
  }, [])

  const onShare = useCallback(
    (event: HostedEventDTO) => {
      void shareLink({ title: event.title, path: sharePathFor(event) }).then((result) => {
        if (result !== "copied") return
        toast.show(t("common-share:button.copied"), { variant: "success" })
      })
    },
    [t, toast],
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

  const scopeName = scope.org?.name ?? t("scope.you")
  const scopeIcon = scope.org
    ? avatarIcon(scope.org.name, scope.org.id, scope.org.logoUrl ?? null)
    : avatarIcon(user?.displayName ?? t("scope.you"), user?.id ?? SCOPE_MENU_SELF, user?.avatarUrl ?? null)

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stack}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text
              variant="title"
              style={styles.headerTitle}
              accessibilityRole="header"
              {...headingLevel(1)}
            >
              {t("header.title")}
            </Text>
            {teaching ? null : (
              <SecondaryButton
                size="sm"
                icon={iconMap.Plus}
                label={t("create.short")}
                accessibilityLabel={
                  scope.org
                    ? t("create.a11y_org", { org: scope.org.name })
                    : t("create.a11y_personal")
                }
                onPress={onCreate}
              />
            )}
          </View>
          <View style={styles.headerMeta}>
            {scope.selectorVisible ? (
              <View ref={scopeAnchorRef} style={styles.scopeSlot}>
                <SecondaryButton
                  size="sm"
                  icon={scopeIcon}
                  trailingIcon={iconMap.ChevronDown}
                  label={scopeName}
                  accessibilityLabel={t("scope.a11y", { name: scopeName })}
                  onPress={() => {
                    measureScope()
                    setScopeOpen(true)
                  }}
                />
              </View>
            ) : null}
            {scope.selectorVisible && kpis ? <MetaDot /> : null}
            {kpis ? (
              <Text variant="caption" numberOfLines={1} style={styles.headerSummary}>
                {t("header.summary", {
                  upcoming: kpis.upcomingEvents,
                  hosted: kpis.eventsHosted,
                })}
              </Text>
            ) : null}
          </View>
        </View>

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

        <AttentionCard
          eventInvites={pendingEventInvites}
          orgInvites={pendingOrgInviteRows}
          invitesPending={eventInvites.isPending || orgInvites.isPending}
          invitesError={eventInvites.isError || orgInvites.isError}
          onRetryInvites={() => {
            if (eventInvites.isError) void eventInvites.refetch()
            if (orgInvites.isError) void orgInvites.refetch()
          }}
          eventRoleLabel={roleLabel}
          orgRoleLabel={(role) => tEnums(`organizationMemberRole.${role}`)}
          pendingEventInviteId={pendingEventInviteId}
          pendingOrgInviteId={pendingOrgInviteId}
          onAcceptEventInvite={onAcceptEventInvite}
          onDeclineEventInvite={onDeclineEventInvite}
          onAcceptOrgInvite={onAcceptOrgInvite}
          onDeclineOrgInvite={onDeclineOrgInvite}
          rows={teaching ? [] : tasks}
          onLogHours={onLogHours}
        />

        {teaching ? <FirstEventCard onCreate={onCreate} /> : null}

        {teaching ? null : (
          <>
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

            <SectionCard
              label={t("events.section")}
              variant="list"
              dividerInset={LIST_DIVIDER_INSET}
              listHeader={
                <View style={styles.controlZone}>
                  <SegmentedControl
                    label={t("events.label")}
                    selected={eventWindow}
                    onSelect={(key) => setEventWindow(key as EventWindow)}
                    options={EVENT_WINDOWS.map((key) => ({ key, label: t(`events.${key}`) }))}
                  />
                </View>
              }
            >
              {hosted.isError ? (
                <View style={styles.notice}>
                  <FeedNotice
                    icon="CloudOff"
                    title={t("events.error_title")}
                    body={t("events.error_body")}
                    actionLabel={t("events.retry")}
                    onAction={() => void hosted.refetch()}
                  />
                </View>
              ) : null}

              {hosted.isPending ? (
                <View style={styles.notice}>
                  <SkeletonGroup>
                    <SkeletonList kind="report" rows={3} />
                  </SkeletonGroup>
                </View>
              ) : null}

              {!hosted.isPending && !hosted.isError && events.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text variant="label">{t(`events.empty_${eventWindow}`)}</Text>
                </View>
              ) : null}

              {events.map((event) => (
                <HostedEventRow
                  key={event.id}
                  event={event}
                  window={eventWindow}
                  roleLabel={roleLabel}
                  live={hostedEventPhase(event, now) === "live"}
                  now={now}
                  onOpen={onOpenEvent}
                  onCheckIn={onCheckIn}
                  onHostTools={onHostTools}
                  onEmailAttendees={onEmailAttendees}
                  onDuplicate={setDuplicating}
                  onEdit={onEdit}
                />
              ))}

              {hosted.hasNextPage ? (
                <View style={styles.moreRow}>
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
                </View>
              ) : null}
            </SectionCard>
          </>
        )}

        <DonationLinkRow org={scope.org} />
        {scope.org ? <CollaboratorsSection org={scope.org} /> : null}

        <ConsoleLinkRow
          target={activeOrgId ? { kind: "org", orgId: activeOrgId } : { kind: "portfolio" }}
        />
      </View>

      <PopoverMenu
        visible={scopeOpen}
        anchorRect={scopeRect}
        align="left"
        onClose={() => setScopeOpen(false)}
        items={[
          {
            key: SCOPE_MENU_SELF,
            label: t("scope.you"),
            accessibilityLabel: t("scope.menu_a11y"),
            ...(activeOrgId === null ? { icon: "Check" as const } : {}),
            onPress: () => {
              setScopeOpen(false)
              setOrgId(null)
            },
          },
          ...orgs.map((org) => ({
            key: org.id,
            label: org.name,
            ...(activeOrgId === org.id ? { icon: "Check" as const } : {}),
            onPress: () => {
              setScopeOpen(false)
              setOrgId(org.id)
            },
          })),
        ]}
      />

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
  header: {
    gap: t.space["2"],
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: HEADER_ROW_HEIGHT,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    minHeight: HEADER_ROW_HEIGHT,
  },
  scopeSlot: {
    flexShrink: 1,
    maxWidth: SCOPE_PILL_MAX_WIDTH,
  },
  headerSummary: {
    flexShrink: 1,
  },
  controlZone: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["4"],
    paddingBottom: t.space["2"],
  },
  notice: {
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
  },
  emptyRow: {
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["4"],
  },
  moreRow: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: MORE_ROW_HEIGHT,
    paddingHorizontal: t.space["4"],
  },
}))
