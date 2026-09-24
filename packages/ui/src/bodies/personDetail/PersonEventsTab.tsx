import React from "react"
import { View, Pressable } from "react-native"
import type { CleanupDTO } from "@civfix/shared"
import { eventChip } from "@civfix/shared/datetime"
import { useTheme, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { MetaDot } from "../../primitives"
import type { useProfilePastEvents } from "../../data"
import { useT, useEventWhen, useLocale } from "../../i18n"
import type { ProfileEventSplit } from "../profile/profileEventSplit"
import { useSectionStyles } from "../profile/sectionStyles"
import { usePersonDetailStyles } from "./personDetailStyles"

function MiniEventRow({
  event,
  role,
  onPress,
}: {
  event: CleanupDTO
  role: string
  onPress: () => void
}) {
  const styles = usePersonDetailStyles()
  const th = useTheme()
  const { t } = useT("profile-person")
  const { locale } = useLocale()
  const when = useEventWhen(event)
  const { day, month } = eventChip(event.scheduledAt, locale, when.timeZone)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("events.row_a11y", { title: event.title, role })}
      {...focusRingProps}
      style={({ pressed }) => [styles.mini, pressed ? styles.miniPressed : null]}
    >
      <View style={styles.dateChip}>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateMonth}>{month}</Text>
      </View>
      <View style={styles.miniMeta}>
        <Text style={styles.miniTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <View style={styles.miniSubRow}>
          <Text style={styles.miniSub} numberOfLines={1}>
            {role}
          </Text>
          <MetaDot color={th.colors.textSubtle} style={styles.miniSubDot} />
          <Text style={[styles.miniSub, styles.miniSubWhen]} numberOfLines={1}>
            {when.dow} {when.timeWithZone}
          </Text>
        </View>
      </View>
      <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textSubtle} />
    </Pressable>
  )
}

export function hasPersonEvents(split: ProfileEventSplit): boolean {
  return (
    split.upcomingHosting.length > 0 ||
    split.upcomingGoing.length > 0 ||
    split.pastHosted.length > 0 ||
    split.pastAttended.length > 0
  )
}

export function PersonEventsTab({
  eventSplit,
  pastEvents,
  onOpenEvent,
}: {
  eventSplit: ProfileEventSplit
  pastEvents: ReturnType<typeof useProfilePastEvents>
  onOpenEvent: (event: CleanupDTO) => void
}) {
  const styles = usePersonDetailStyles()
  const sectionStyles = useSectionStyles()
  const { t } = useT("profile-person")
  const hosting = eventSplit.pastHosted
  const going = eventSplit.pastAttended
  const hasUpcoming = eventSplit.upcomingHosting.length > 0 || eventSplit.upcomingGoing.length > 0

  return (
    <View style={styles.events}>
      <Text style={styles.eventsLabel}>{t("events.label")}</Text>
      {hasUpcoming ? (
        <>
          <Text style={styles.eventsGroupLabel}>{t("events.group_upcoming")}</Text>
          {eventSplit.upcomingHosting.map((ev) => (
            <MiniEventRow
              key={`uh-${ev.id}`}
              event={ev}
              role={t("events.role_hosting")}
              onPress={() => onOpenEvent(ev)}
            />
          ))}
          {eventSplit.upcomingGoing.map((ev) => (
            <MiniEventRow
              key={`ug-${ev.id}`}
              event={ev}
              role={t("events.role_going")}
              onPress={() => onOpenEvent(ev)}
            />
          ))}
        </>
      ) : null}
      {hosting.length > 0 || going.length > 0 ? (
        <Text style={styles.eventsGroupLabel}>{t("events.group_past")}</Text>
      ) : null}
      {hosting.map((ev) => (
        <MiniEventRow
          key={`h-${ev.id}`}
          event={ev}
          role={t("profile-view:events.badge_hosted")}
          onPress={() => onOpenEvent(ev)}
        />
      ))}
      {going.map((ev) => (
        <MiniEventRow
          key={`g-${ev.id}`}
          event={ev}
          role={t("profile-view:events.badge_went")}
          onPress={() => onOpenEvent(ev)}
        />
      ))}
      {pastEvents.isError ? (
        <Text style={styles.postsState}>{t("events.load_more_error")}</Text>
      ) : null}
      {pastEvents.canLoadMore ? (
        <Pressable
          onPress={pastEvents.loadMore}
          disabled={pastEvents.isLoadingMore}
          accessibilityRole="button"
          accessibilityState={{
            disabled: pastEvents.isLoadingMore,
            busy: pastEvents.isLoadingMore,
          }}
          accessibilityLabel={t("events.load_more_a11y")}
          {...focusRingProps}
          style={({ pressed }) => [
            sectionStyles.loadMore,
            pressed ? sectionStyles.loadMorePressed : null,
          ]}
        >
          <Text style={sectionStyles.loadMoreText}>
            {pastEvents.isLoadingMore
              ? t("events.loading_more")
              : pastEvents.isRetry
                ? t("events.load_more_retry")
                : t("events.load_more")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
