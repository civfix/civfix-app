import React, { useCallback, useState } from "react"
import { View, type LayoutChangeEvent } from "react-native"
import type { CleanupDTO, EventInsights, EventPhase, EventSlotDTO } from "@civfix/shared"
import { eventWhenLabel } from "@civfix/shared/datetime"
import { eventPhase, eventEndsAtMs, hostStage, nextEventBoundaryMs } from "@civfix/shared/host"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text, iconMap, type LucideIcon } from "../../typography"
import {
  CancelEventSheet,
  IconTile,
  ListRow,
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  SettingsRow,
  SettingsSection,
  shareLink,
  useToast,
} from "../../primitives"
import { RequestResourcesSheet } from "../../primitives/RequestResourcesSheet"
import { useScannerAvailable } from "../../primitives/useScannerAvailable"
import {
  statTileColumns,
  STAT_TILE_WIDE_AT,
  type StatTileColumns,
} from "../../primitives/statTileModel"
import { managePath } from "../../primitives/externalUrls"
import { consoleReachable, openConsolePath } from "../../primitives/consoleReach"
import { useOpenExternal } from "../../capabilities"
import {
  useAuthState,
  useCancelCleanup,
  useCleanup,
  useEventBoundaryRefresh,
  useNow,
  useRequestEventResources,
} from "../../data"
import {
  cleanupHostStanding,
  hasHostCapability,
  useEventInsights,
  useMarkEventNoShows,
} from "../../data/hooks/host"
import { useLocale, useRelativeTime, useT, useViewerTimeZone } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { appErrorCode } from "../errorCode"
import { FeedNotice } from "../FeedNotice"
import { DuplicateEventSheet } from "./dashboard/DuplicateEventSheet"
import { EventRosterBlock } from "./EventRosterBlock"
import { HostAnnouncementsBlock } from "./HostAnnouncementsBlock"
import { HeroSkeleton, RowsSkeleton, TilesSkeleton } from "./HostSkeletons"
import { HostInsightsPanels } from "./HostInsightsPanels"
import { HostWalkupSheet } from "./HostWalkupSheet"
import { LinkedReportsSheet } from "./LinkedReportsSheet"
import { PhaseHeader, type PhaseHeaderAction } from "./PhaseHeader"
import { linkSheetMode } from "../linkReportsModel"
import {
  HOST_ROW_ICONS,
  hostActionCards,
  hostedEventFromCleanup,
  hostPrimaryCta,
  hostSecondaryCta,
  type HostCtaKey,
  type HostRowKey,
  type HostSurfaceCapabilities,
  type HostSurfaceInput,
} from "./hostSurfaceModel"

const PHASE_TICK_MS = 60_000

const CTA_ICONS: Readonly<Record<HostCtaKey, LucideIcon>> = {
  share: iconMap.Share,
  announce: iconMap.Megaphone,
  check_in: iconMap.QrCode,
  scan: iconMap.ScanLine,
  log_hours: iconMap.Clock,
  duplicate: iconMap.Copy,
  edit: iconMap.Pencil,
}

function useHostCapabilities(cleanup: CleanupDTO | undefined): HostSurfaceCapabilities {
  const viewerId = useAuthState().user?.id ?? null
  const standing = cleanupHostStanding(cleanup, viewerId)
  return {
    checkIn: hasHostCapability(standing, "check_in"),
    broadcast: hasHostCapability(standing, "broadcast"),
    manageEvent: hasHostCapability(standing, "manage_event"),
    manageTickets: hasHostCapability(standing, "manage_tickets"),
    manageTeam: hasHostCapability(standing, "manage_team"),
    viewRoster: hasHostCapability(standing, "view_roster"),
    viewAnalytics: hasHostCapability(standing, "view_analytics"),
    cancelEvent: hasHostCapability(standing, "cancel_event"),
    requestResources: hasHostCapability(standing, "request_resources"),
    logHours: hasHostCapability(standing, "manage_event"),
  }
}

function cancelErrorKey(err: unknown): string {
  return appErrorCode(err) === "CONFLICT" ? "state.cancel_ended" : "state.cancel_error"
}

function whenLine(
  cleanup: CleanupDTO,
  weekdays: readonly string[],
  locale: string,
  viewerTimeZone: string,
): string {
  const when = eventWhenLabel(cleanup, { locale, weekdays, viewerTimeZone })
  return cleanup.address ? `${when} · ${cleanup.address}` : when
}

function InsightsSection({
  insights,
  phase,
  columns,
  slots,
  now,
  timeZone,
  loading,
  failed,
}: {
  insights: EventInsights | undefined
  phase: EventPhase
  columns: StatTileColumns
  slots: readonly EventSlotDTO[]
  now: number
  timeZone: string | undefined
  loading: boolean
  failed: boolean
}) {
  const styles = useStyles()
  const { t } = useT("host-mode")
  if (insights) {
    return (
      <HostInsightsPanels
        insights={insights}
        phase={phase}
        columns={columns}
        slots={slots}
        now={now}
        stale={failed}
        timeZone={timeZone}
      />
    )
  }
  if (failed) {
    return (
      <FeedNotice
        icon="CloudOff"
        title={t("state.insights_error_title")}
        body={t("state.insights_error_body")}
      />
    )
  }
  if (!loading) return null
  return (
    <View style={styles.sections}>
      <HeroSkeleton />
      <TilesSkeleton columns={columns} count={4} />
    </View>
  )
}

export function HostModeBody({ id }: { id: string }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-mode")
  const { t: tAnalytics } = useT("host-analytics")
  const { locale } = useLocale()
  const { relative, weekdays } = useRelativeTime()
  const viewerTimeZone = useViewerTimeZone()
  const { ScrollView } = useScrollHost()
  const toast = useToast()
  const openExternal = useOpenExternal()

  const cleanup = useCleanup(id)
  const can = useHostCapabilities(cleanup.data)
  const scannerAvailable = useScannerAvailable()

  const event = cleanup.data
  const clock = event
    ? { status: event.status, scheduledAt: event.scheduledAt, endsAt: event.endsAt ?? null }
    : null
  const boundaryAt = clock === null ? null : nextEventBoundaryMs(clock, Date.now())
  const now = useNow(boundaryAt === null ? 0 : PHASE_TICK_MS, { boundaryAt })
  const clockPhase: EventPhase = clock === null ? "upcoming" : eventPhase(clock, now)
  const stage = clock === null ? "upcoming" : hostStage(clock, now)
  useEventBoundaryRefresh(clock, now, id)

  const insights = useEventInsights(id, {
    enabled: can.viewAnalytics,
    live: clockPhase === "live",
  })
  const phase = insights.data?.phase ?? clockPhase

  const [contentWidth, setContentWidth] = useState(0)
  const onContentLayout = useCallback((layout: LayoutChangeEvent) => {
    setContentWidth(layout.nativeEvent.layout.width)
  }, [])

  const [walkupOpen, setWalkupOpen] = useState(false)
  const [linkingOpen, setLinkingOpen] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [markingNoShows, setMarkingNoShows] = useState(false)

  const cancelCleanup = useCancelCleanup()
  const requestResources = useRequestEventResources(id)
  const markNoShows = useMarkEventNoShows(id)

  const shareTitle = event?.title ?? ""
  const sharePath = `/cleanups/${event?.pageSlug ?? event?.referenceCode ?? id}`

  const onShare = useCallback(() => {
    void shareLink({ title: shareTitle, path: sharePath }).then((result) => {
      if (result !== "copied") return
      toast.show(t("common-share:button.copied"), { variant: "success" })
    })
  }, [sharePath, shareTitle, t, toast])

  const onAnnounce = useCallback(() => {
    useNavStore.getState().push({ kind: "host-announce", id })
  }, [id])

  const onOpenChat = useCallback(() => {
    useNavStore.getState().push({
      kind: "thread",
      id,
      roomKind: "cleanup",
      ...(shareTitle ? { title: shareTitle } : {}),
    })
  }, [id, shareTitle])

  const onCheckin = useCallback(() => {
    useNavStore.getState().push({ kind: "host-checkin", id })
  }, [id])

  const onTeam = useCallback(() => {
    useNavStore.getState().push({ kind: "host-team", id })
  }, [id])

  const onEdit = useCallback(() => {
    useNavStore.getState().push({ kind: "edit-cleanup", id })
  }, [id])

  const onLogHours = useCallback(() => {
    useNavStore.getState().push({ kind: "host-log-hours", id })
  }, [id])

  const onTickets = useCallback(() => {
    openConsolePath(managePath(id), openExternal)
  }, [id, openExternal])

  const onConfirmNoShows = useCallback(() => {
    markNoShows.mutate(undefined, {
      onSuccess: (res) => {
        setMarkingNoShows(false)
        toast.show(t("no_shows.success", { count: res.marked }), { variant: "success" })
      },
      onError: () => toast.show(t("no_shows.error"), { variant: "error" }),
    })
  }, [markNoShows, t, toast])

  const onConfirmCancel = useCallback(
    (reason?: string) => {
      cancelCleanup.mutate(
        { id, ...(reason ? { reason } : {}) },
        { onSuccess: () => setCancelling(false) },
      )
    },
    [cancelCleanup, id],
  )

  const onSubmitRequest = useCallback(
    (message: string) => {
      requestResources.mutate({ message }, { onSuccess: () => setRequesting(false) })
    },
    [requestResources],
  )

  const actionFor = useCallback(
    (key: HostCtaKey | HostRowKey): (() => void) => {
      switch (key) {
        case "share":
          return onShare
        case "announce":
          return onAnnounce
        case "chat":
          return onOpenChat
        case "check_in":
        case "scan":
          return onCheckin
        case "log_hours":
          return onLogHours
        case "duplicate":
          return () => setDuplicating(true)
        case "edit":
          return onEdit
        case "team":
          return onTeam
        case "walkup":
          return () => setWalkupOpen(true)
        case "mark_no_shows":
          return () => setMarkingNoShows(true)
        case "tickets":
          return onTickets
        case "linked_reports":
          return () => setLinkingOpen(true)
        case "resources":
          return () => setRequesting(true)
        case "cancel":
          return () => setCancelling(true)
      }
    },
    [onAnnounce, onCheckin, onEdit, onLogHours, onOpenChat, onShare, onTeam, onTickets],
  )

  if (cleanup.isLoading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <HeroSkeleton />
        <RowsSkeleton rows={4} />
      </ScrollView>
    )
  }

  if (cleanup.isError || !event) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />
      </View>
    )
  }

  if (!can.viewRoster && !can.checkIn) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="Lock" title={t("state.denied_title")} body={t("state.denied_body")} />
      </View>
    )
  }

  const startsAt = Date.parse(event.scheduledAt)
  const endsAt = eventEndsAtMs(event)
  const checkedInSeats = insights.data?.seats.checkedIn ?? event.checkedInCount ?? 0
  const surface: HostSurfaceInput = {
    stage,
    now,
    startsAt: Number.isFinite(startsAt) ? startsAt : null,
    registeredSeats: insights.data?.seats.registered ?? event.registeredCount ?? 0,
    hoursCredited: insights.data?.hours.credited ?? 0,
    scannerAvailable,
    can,
  }
  const primary = hostPrimaryCta(surface)
  const secondary = hostSecondaryCta(surface)
  const unmarked = insights.data?.seats.unmarked ?? 0
  const stillToCheckIn = insights.data
    ? Math.max(0, insights.data.seats.registered - insights.data.seats.checkedIn)
    : 0
  const isCleanupEvent = event.eventKind === "cleanup"
  const linkedReportCount = event.linkedReports.length
  const linkMode = linkSheetMode({
    stage,
    canManage: can.manageEvent,
    isCleanup: isCleanupEvent,
    linkedCount: linkedReportCount,
  })
  const cards = hostActionCards({
    stage,
    ctas: [primary, secondary],
    can,
    unmarked,
    scannerAvailable,
    hasOrganization: !!event.organization,
    consoleReachable,
    isCleanup: isCleanupEvent,
    linkedReportCount,
  })
  const columns = statTileColumns(contentWidth)
  const wide = contentWidth >= STAT_TILE_WIDE_AT

  const ctaFor = (key: HostCtaKey): PhaseHeaderAction => ({
    label: t(`cta.${key}`),
    icon: CTA_ICONS[key],
    onPress: actionFor(key),
  })

  const rowSub = (key: HostRowKey): string | undefined => {
    switch (key) {
      case "share":
        return event.pageSlug ?? event.referenceCode ?? undefined
      case "chat":
        return t("row.chat_sub")
      case "announce":
        return t("row.announce_sub")
      case "check_in":
      case "scan":
        return stillToCheckIn > 0 ? t("row.check_in_sub", { count: stillToCheckIn }) : undefined
      case "mark_no_shows":
        return t("row.mark_no_shows_sub", { count: unmarked })
      case "log_hours":
        return checkedInSeats > 0
          ? t("row.log_hours_sub", { count: checkedInSeats })
          : t("row.log_hours_none")
      case "resources":
        return event.jurisdictionGeoid == null ? t("row.resources_no_city") : undefined
      case "linked_reports":
        return linkedReportCount > 0 ? t("row.linked_reports_sub") : t("row.linked_reports_none")
      default:
        return undefined
    }
  }

  const rowValue = (key: HostRowKey): string | undefined => {
    if (key === "team" && event.teamCount != null) return String(event.teamCount)
    if (key === "linked_reports" && linkedReportCount > 0) return String(linkedReportCount)
    return undefined
  }

  const relativeLine =
    stage === "cancelled"
      ? t("phase.called_off")
      : stage === "past" || stage === "wrapping_up"
        ? t("phase.ended_on", { when: relative(endsAt ?? event.scheduledAt, now) })
        : stage === "underway"
          ? t("phase.started", { when: relative(event.scheduledAt, now) })
          : t("phase.starts", { when: relative(now, startsAt) })

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.body} onLayout={onContentLayout}>
        <PhaseHeader
          phase={phase}
          title={event.title}
          when={whenLine(event, weekdays, locale, viewerTimeZone)}
          relative={relativeLine}
          wide={wide}
          cta={primary ? ctaFor(primary) : undefined}
          secondary={secondary ? ctaFor(secondary) : undefined}
        />

        {phase === "cancelled" ? <FeedNotice icon="Ban" title={t("cancelled_notice")} /> : null}

        {can.viewAnalytics ? (
          <SectionCard variant="list">
            <ListRow
              leading={<IconTile icon="BarChart3" />}
              title={tAnalytics("card.view_full")}
              titleLines={1}
              chevron
              onPress={() => useNavStore.getState().push({ kind: "event-analytics", id })}
            />
          </SectionCard>
        ) : null}

        {can.viewAnalytics ? (
          <InsightsSection
            insights={insights.data}
            phase={phase}
            columns={columns}
            slots={event.slots ?? []}
            now={now}
            timeZone={event.timezone ?? undefined}
            loading={insights.isLoading}
            failed={insights.isError}
          />
        ) : null}

        {cards.map((card) => (
          <SettingsSection
            key={card.key}
            label={t(`section.${card.key}`)}
            style={card.key === "danger" ? styles.danger : undefined}
          >
            {card.rows.map((row) => (
              <SettingsRow
                key={row}
                label={t(`row.${row}`)}
                icon={HOST_ROW_ICONS[row]}
                sub={rowSub(row)}
                value={rowValue(row)}
                onPress={actionFor(row)}
                variant={row === "cancel" ? "destructive" : "default"}
                chevron={row === "cancel" ? false : undefined}
              />
            ))}
          </SettingsSection>
        ))}

        {can.broadcast ? <HostAnnouncementsBlock cleanupId={id} /> : null}

        {can.viewRoster ? (
          <SectionCard label={t("section.attendees")}>
            <EventRosterBlock cleanupId={id} canCheckIn={can.checkIn && phase !== "cancelled"} />
          </SectionCard>
        ) : null}
      </View>

      <HostWalkupSheet
        visible={walkupOpen}
        cleanupId={id}
        ticketTypes={event.ticketTypes}
        onClose={() => setWalkupOpen(false)}
      />

      <LinkedReportsSheet
        visible={linkingOpen}
        mode={linkMode === "hidden" ? "readonly" : linkMode}
        cleanup={event}
        onClose={() => setLinkingOpen(false)}
      />

      <DuplicateEventSheet
        event={duplicating ? hostedEventFromCleanup(event, insights.data ?? null) : null}
        onClose={() => setDuplicating(false)}
      />

      <ModalCardSheet
        visible={markingNoShows}
        onClose={() => {
          if (!markNoShows.isPending) setMarkingNoShows(false)
        }}
        onCommit={onConfirmNoShows}
        headerIcon="CheckCheck"
        headerIconColor={th.colors.dangerInk}
        title={t("no_shows.title")}
        dismissLabel={t("no_shows.dismiss_a11y")}
        backdropDismissDisabled={markNoShows.isPending}
        actions={
          <>
            <SecondaryButton
              label={t("no_shows.cancel")}
              onPress={() => setMarkingNoShows(false)}
              size="sm"
              disabled={markNoShows.isPending}
            />
            <PrimaryButton
              label={t("no_shows.confirm")}
              variant="destructive"
              onPress={onConfirmNoShows}
              loading={markNoShows.isPending}
            />
          </>
        }
      >
        <Text variant="caption">{t("no_shows.body", { count: unmarked })}</Text>
      </ModalCardSheet>

      <CancelEventSheet
        visible={cancelling}
        pending={cancelCleanup.isPending}
        error={cancelCleanup.isError ? t(cancelErrorKey(cancelCleanup.error)) : null}
        onConfirm={onConfirmCancel}
        onClose={() => {
          if (!cancelCleanup.isPending) setCancelling(false)
        }}
      />

      <RequestResourcesSheet
        visible={requesting}
        pending={requestResources.isPending}
        error={requestResources.isError ? t("state.resources_error") : null}
        onSubmit={onSubmitRequest}
        onClose={() => {
          if (!requestResources.isPending) setRequesting(false)
        }}
      />
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  body: {
    gap: t.space["6"],
  },
  sections: {
    gap: t.space["6"],
  },
  danger: {
    marginTop: t.space["2"],
  },
}))
