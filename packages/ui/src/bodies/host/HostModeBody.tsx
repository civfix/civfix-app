import React, { useCallback, useState } from "react"
import { View, type LayoutChangeEvent } from "react-native"
import type { CleanupDTO, EventInsights, EventPhase, EventSlotDTO } from "@civfix/shared"
import { eventWhenLabel } from "@civfix/shared/datetime"
import { eventPhase, eventEndsAtMs, hostStage, nextEventBoundaryMs } from "@civfix/shared/host"
import { makeThemedStyles } from "../../theme"
import { iconMap, type LucideIcon } from "../../typography"
import {
  IconTile,
  ListRow,
  SectionCard,
  SettingsRow,
  SettingsSection,
  shareLink,
  useToast,
} from "../../primitives"
import { useScannerAvailable } from "../../primitives/useScannerAvailable"
import {
  statTileColumns,
  STAT_TILE_WIDE_AT,
  type StatTileColumns,
} from "../../primitives/statTileModel"
import { managePath } from "../../primitives/externalUrls"
import { consoleReachable, openConsolePath } from "../../primitives/consoleReach"
import { useOpenExternal } from "../../capabilities"
import { useAuthState, useCleanup, useEventBoundaryRefresh, useNow } from "../../data"
import { cleanupHostStanding, useEventInsights } from "../../data/hooks/host"
import { useLocale, useRelativeTime, useT, useViewerTimeZone } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { EventRosterBlock } from "./EventRosterBlock"
import { HostAnnouncementsBlock } from "./HostAnnouncementsBlock"
import { HeroSkeleton, RowsSkeleton, TilesSkeleton } from "./HostSkeletons"
import { HostInsightsPanels } from "./HostInsightsPanels"
import { HostModeSheets, useHostSheetActions, useHostSheetsOpen } from "./HostModeSheets"
import { HostStateNotice } from "./HostStateNotice"
import { PhaseHeader, type PhaseHeaderAction } from "./PhaseHeader"
import { linkSheetMode } from "../linkReportsModel"
import { hostRelativeLine, hostRowSub, hostRowValue, type HostRowCounts } from "./hostModeCopy"
import {
  HOST_ROW_ICONS,
  hostActionCards,
  hostPrimaryCta,
  hostSecondaryCta,
  hostSurfaceCapabilities,
  type HostCtaKey,
  type HostRowKey,
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
  const { t } = useT("host-mode")
  const { t: tAnalytics } = useT("host-analytics")
  const { locale } = useLocale()
  const { relative, weekdays } = useRelativeTime()
  const viewerTimeZone = useViewerTimeZone()
  const { ScrollView } = useScrollHost()
  const toast = useToast()
  const openExternal = useOpenExternal()

  const cleanup = useCleanup(id)
  const viewerId = useAuthState().user?.id ?? null
  const can = hostSurfaceCapabilities(cleanupHostStanding(cleanup.data, viewerId))
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

  const { open: sheetsOpen, openSheet, closeSheet } = useHostSheetsOpen()
  const sheetActions = useHostSheetActions(id, closeSheet)

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
          return () => openSheet("duplicate")
        case "edit":
          return onEdit
        case "team":
          return onTeam
        case "walkup":
          return () => openSheet("walkup")
        case "mark_no_shows":
          return () => openSheet("noShows")
        case "tickets":
          return onTickets
        case "linked_reports":
          return () => openSheet("linking")
        case "resources":
          return () => openSheet("resources")
        case "cancel":
          return () => openSheet("cancel")
      }
    },
    [onAnnounce, onCheckin, onEdit, onLogHours, onOpenChat, onShare, onTeam, onTickets, openSheet],
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
    return <HostStateNotice icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />
  }

  if (!can.viewRoster && !can.checkIn) {
    return <HostStateNotice icon="Lock" title={t("state.denied_title")} body={t("state.denied_body")} />
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
  const rowCounts: HostRowCounts = { stillToCheckIn, unmarked, checkedInSeats, linkedReportCount }
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

  const relativeLine = hostRelativeLine(
    { stage, now, startsAt, endsAt, scheduledAt: event.scheduledAt },
    t,
    relative,
  )

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
                sub={hostRowSub(row, event, rowCounts, t)}
                value={hostRowValue(row, event, rowCounts)}
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

      <HostModeSheets
        id={id}
        event={event}
        insights={insights.data ?? null}
        unmarked={unmarked}
        linkMode={linkMode}
        open={sheetsOpen}
        onClose={closeSheet}
        actions={sheetActions}
      />
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
