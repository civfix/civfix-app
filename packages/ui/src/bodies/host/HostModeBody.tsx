import React, { useCallback, useEffect, useState } from "react"
import { View, type LayoutChangeEvent } from "react-native"
import type { CleanupDTO, EventInsights, EventPhase, EventSlotDTO } from "@civfix/shared"
import { dowLabel, timeLabel } from "@civfix/shared/datetime"
import { eventPhase } from "@civfix/shared/host"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text, iconMap, type LucideIcon } from "../../typography"
import {
  CancelEventSheet,
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  SettingsRow,
  SettingsSection,
  shareLink,
  useToast,
} from "../../primitives"
import { CompleteEventSheet } from "../../primitives/CompleteEventSheet"
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
  useCompleteCleanup,
  useRequestEventResources,
} from "../../data"
import {
  cleanupHostStanding,
  hasHostCapability,
  useEventInsights,
  useMarkEventNoShows,
} from "../../data/hooks/host"
import { useLocale, useRelativeTime, useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { eventCompletionState } from "../eventLifecycle"
import { FeedNotice } from "../FeedNotice"
import { ConsoleLinkRow } from "./dashboard/ConsoleLinkRow"
import { DuplicateEventSheet } from "./dashboard/DuplicateEventSheet"
import { emailAttendeesPreset, useDashboardStore } from "./dashboard/dashboardStore"
import { EventRosterBlock } from "./EventRosterBlock"
import { HeroSkeleton, RowsSkeleton, TilesSkeleton } from "./HostSkeletons"
import { HostInsightsPanels } from "./HostInsightsPanels"
import { HostWalkupSheet } from "./HostWalkupSheet"
import { PhaseHeader, type PhaseHeaderAction } from "./PhaseHeader"
import {
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
  message: iconMap.Megaphone,
  check_in: iconMap.QrCode,
  scan: iconMap.ScanLine,
  complete: iconMap.CheckCheck,
  log_hours: iconMap.Clock,
  duplicate: iconMap.Copy,
  edit: iconMap.Pencil,
}

const ROW_ICONS: Readonly<Record<HostRowKey, keyof typeof iconMap>> = {
  share: "Link2",
  invite_team: "UserPlus",
  message: "Megaphone",
  email: "Mail",
  check_in: "QrCode",
  scan: "ScanLine",
  walkup: "UserPlus",
  mark_no_shows: "CheckCheck",
  edit: "Pencil",
  team: "Users",
  tickets: "Ticket",
  resources: "Building2",
  duplicate: "Copy",
  cancel: "Ban",
}

function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), PHASE_TICK_MS)
    return () => clearInterval(id)
  }, [active])
  return now
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
  }
}

function whenLine(cleanup: CleanupDTO, weekdays: readonly string[], locale: string): string {
  const parts = [dowLabel(cleanup.scheduledAt, weekdays), timeLabel(cleanup.scheduledAt, locale)]
  if (cleanup.address) parts.push(cleanup.address)
  return parts.join(" · ")
}

function InsightsSection({
  insights,
  phase,
  columns,
  slots,
  now,
  loading,
  failed,
}: {
  insights: EventInsights | undefined
  phase: EventPhase
  columns: StatTileColumns
  slots: readonly EventSlotDTO[]
  now: number
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
  const { locale } = useLocale()
  const { relative, weekdays } = useRelativeTime()
  const { ScrollView } = useScrollHost()
  const toast = useToast()
  const openExternal = useOpenExternal()

  const cleanup = useCleanup(id)
  const can = useHostCapabilities(cleanup.data)
  const scannerAvailable = useScannerAvailable()

  const event = cleanup.data
  const settled = !!event && (event.status === "done" || event.status === "cancelled")
  const now = useTicker(!settled)
  const clockPhase: EventPhase = event
    ? eventPhase(
        { status: event.status, scheduledAt: event.scheduledAt, endsAt: event.endsAt ?? null },
        now,
      )
    : "upcoming"

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
  const [duplicating, setDuplicating] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [markingNoShows, setMarkingNoShows] = useState(false)

  const cancelCleanup = useCancelCleanup()
  const completeCleanup = useCompleteCleanup()
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

  const onMessage = useCallback(() => {
    useDashboardStore.getState().setBroadcastPreset(null)
    useNavStore.getState().push({ kind: "host-broadcast-quick", id })
  }, [id])

  const onEmail = useCallback(() => {
    useDashboardStore.getState().setBroadcastPreset(emailAttendeesPreset(id))
    useNavStore.getState().push({ kind: "host-broadcast-quick", id })
  }, [id])

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
    useNavStore.getState().push({ kind: "cleanup", id })
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

  const onConfirmComplete = useCallback(() => {
    completeCleanup.mutate({ id }, { onSuccess: () => setCompleting(false) })
  }, [completeCleanup, id])

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
        case "message":
          return onMessage
        case "email":
          return onEmail
        case "check_in":
        case "scan":
          return onCheckin
        case "complete":
          return () => setCompleting(true)
        case "log_hours":
          return onLogHours
        case "duplicate":
          return () => setDuplicating(true)
        case "edit":
          return onEdit
        case "invite_team":
        case "team":
          return onTeam
        case "walkup":
          return () => setWalkupOpen(true)
        case "mark_no_shows":
          return () => setMarkingNoShows(true)
        case "tickets":
          return onTickets
        case "resources":
          return () => setRequesting(true)
        default:
          return () => setCancelling(true)
      }
    },
    [onCheckin, onEdit, onEmail, onLogHours, onMessage, onShare, onTeam, onTickets],
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
  const endsAt = event.endsAt ? Date.parse(event.endsAt) : NaN
  const surface: HostSurfaceInput = {
    phase,
    now,
    startsAt: Number.isFinite(startsAt) ? startsAt : null,
    endsAt: Number.isFinite(endsAt) ? endsAt : null,
    registeredSeats: insights.data?.seats.registered ?? event.registeredCount ?? 0,
    hoursCredited: insights.data?.hours.credited ?? 0,
    scannerAvailable,
    completionArmed:
      eventCompletionState({
        actsAsHost: can.manageEvent,
        status: event.status,
        scheduledAt: event.scheduledAt,
        now,
      }) === "ready",
    can,
  }
  const primary = hostPrimaryCta(surface)
  const secondary = hostSecondaryCta(surface)
  const unmarked = insights.data?.seats.unmarked ?? 0
  const stillToCheckIn = insights.data
    ? Math.max(0, insights.data.seats.registered - insights.data.seats.checkedIn)
    : 0
  const cards = hostActionCards({
    phase,
    can,
    unmarked,
    scannerAvailable,
    hasOrganization: !!event.organization,
    consoleReachable,
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
      case "message":
        return t("row.message_sub")
      case "email":
        return t("row.email_sub")
      case "check_in":
      case "scan":
        return stillToCheckIn > 0 ? t("row.check_in_sub", { count: stillToCheckIn }) : undefined
      case "mark_no_shows":
        return t("row.mark_no_shows_sub", { count: unmarked })
      case "resources":
        return event.jurisdictionGeoid == null ? t("row.resources_no_city") : undefined
      default:
        return undefined
    }
  }

  const relativeLine =
    phase === "cancelled"
      ? t("phase.called_off")
      : phase === "ended"
        ? t("phase.ended_on", { when: relative(event.scheduledAt, now) })
        : phase === "live"
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
          when={whenLine(event, weekdays, locale)}
          relative={relativeLine}
          wide={wide}
          cta={primary ? ctaFor(primary) : undefined}
          secondary={secondary ? ctaFor(secondary) : undefined}
        />

        {phase === "cancelled" ? <FeedNotice icon="Ban" title={t("cancelled_notice")} /> : null}

        {can.viewAnalytics ? (
          <InsightsSection
            insights={insights.data}
            phase={phase}
            columns={columns}
            slots={event.slots ?? []}
            now={now}
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
                icon={ROW_ICONS[row]}
                sub={rowSub(row)}
                value={row === "team" && event.teamCount != null ? String(event.teamCount) : undefined}
                onPress={actionFor(row)}
                variant={row === "cancel" ? "destructive" : "default"}
                chevron={row === "cancel" ? false : undefined}
              />
            ))}
          </SettingsSection>
        ))}

        <ConsoleLinkRow target={{ kind: "event", eventId: id }} />

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
        error={cancelCleanup.isError ? t("state.cancel_error") : null}
        onConfirm={onConfirmCancel}
        onClose={() => {
          if (!cancelCleanup.isPending) setCancelling(false)
        }}
      />

      <CompleteEventSheet
        visible={completing}
        pending={completeCleanup.isPending}
        error={completeCleanup.isError ? t("state.complete_error") : null}
        onConfirm={onConfirmComplete}
        onClose={() => {
          if (!completeCleanup.isPending) setCompleting(false)
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
