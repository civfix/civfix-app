import React, { useCallback, useMemo } from "react"
import { View } from "react-native"
import type { CleanupMemberRole } from "@civfix/shared"
import { MIN_TOUCH_TARGET, makeThemedStyles } from "../../../theme"
import { Text, TextLink } from "../../../typography"
import {
  LIST_DIVIDER_INSET,
  LIST_ROW_MIN_HEIGHT,
  SectionCard,
  SegmentedControl,
  SkeletonGroup,
  SkeletonList,
} from "../../../primitives"
import { hostedEventRows } from "../../../data/hooks/host"
import type { useMyHostedEvents } from "../../../data/hooks/host"
import { useT } from "../../../i18n"
import { FeedNotice } from "../../FeedNotice"
import { HostedEventRow } from "./HostedEventRow"
import { hostedEventPhase } from "./dashboardModel"
import type { HostedEventHandler, HostedEventNav } from "./useHostedEventNav"

export type EventWindow = "upcoming" | "past"

const EVENT_WINDOWS: readonly EventWindow[] = ["upcoming", "past"]

type HostedEventsQuery = ReturnType<typeof useMyHostedEvents>

export interface HostedEventsSectionProps {
  eventWindow: EventWindow
  onWindowChange: (eventWindow: EventWindow) => void
  upcoming: HostedEventsQuery
  past: HostedEventsQuery
  now: Date
  nav: HostedEventNav
  onDuplicate: HostedEventHandler
}

export function HostedEventsSection({
  eventWindow,
  onWindowChange,
  upcoming,
  past,
  now,
  nav,
  onDuplicate,
}: HostedEventsSectionProps) {
  const styles = useStyles()
  const { t } = useT("event-dashboard")
  const { t: tEnums } = useT("enums")
  const hosted = eventWindow === "past" ? past : upcoming
  const events = useMemo(() => hostedEventRows(hosted.data?.pages), [hosted.data])

  const roleLabel = useCallback(
    (role: CleanupMemberRole) => tEnums(`cleanupMemberRole.${role}`),
    [tEnums],
  )

  return (
    <SectionCard
      label={t("events.section")}
      variant="list"
      dividerInset={LIST_DIVIDER_INSET}
      listHeader={
        <View style={styles.controlZone}>
          <SegmentedControl
            label={t("events.label")}
            selected={eventWindow}
            onSelect={(key) => onWindowChange(key as EventWindow)}
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
          onOpen={nav.onOpenEvent}
          onCheckIn={nav.onCheckIn}
          onHostTools={nav.onHostTools}
          onOpenChat={nav.onOpenChat}
          onAnnounce={nav.onAnnounce}
          onDuplicate={onDuplicate}
          onEdit={nav.onEdit}
        />
      ))}

      {hosted.hasNextPage ? (
        <View style={styles.moreRow}>
          <TextLink
            variant="label"
            standalone
            accessibilityLabel={t("events.show_more")}
            disabled={hosted.isFetchingNextPage}
            onPress={() => {
              if (!hosted.isFetchingNextPage) void hosted.fetchNextPage()
            }}
          >
            {hosted.isFetchingNextPage ? t("events.loading_more") : t("events.show_more")}
          </TextLink>
        </View>
      ) : null}
    </SectionCard>
  )
}

const useStyles = makeThemedStyles((t) => ({
  controlZone: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["2"],
  },
  notice: {
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["2"],
  },
  emptyRow: {
    justifyContent: "center",
    minHeight: LIST_ROW_MIN_HEIGHT,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["2"],
  },
  moreRow: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: t.space["4"],
  },
}))
