import React from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { CleanupDTO } from "@civfix/shared"
import { eventChip } from "@civfix/shared/datetime"
import { makeThemedStyles, useTheme, focusRingProps } from "../../theme"
import { Text } from "../../typography"
import { MetaDot } from "../../primitives"
import { useEventWhen, useLocale, useT } from "../../i18n"
import { SectionEyebrow, SubHead } from "./SectionHeadings"
import { useSectionStyles } from "./sectionStyles"
import type { ProfileEventSplit, ProfileEventTab } from "./profileEventSplit"

const EVENT_TABS: readonly ProfileEventTab[] = ["upcoming", "past"]

function EventRow({
  event,
  badge,
  badgeColor,
  onPress,
}: {
  event: CleanupDTO
  badge: string
  badgeColor: string
  onPress?: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("profile-view")
  const { locale } = useLocale()
  const when = useEventWhen(event)
  const { day, month } = eventChip(event.scheduledAt, locale, when.timeZone)
  const where = event.address?.trim()
  const tint = `${badgeColor}1A`
  const subParts = [when.dow, when.timeWithZone, where].filter((s): s is string => !!s)
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={t("events.row_a11y", { title: event.title, badge })}
      {...focusRingProps}
      style={({ pressed }) => [styles.erow, pressed && onPress ? styles.erowPressed : null]}
    >
      <View style={[styles.erowDate, { backgroundColor: tint }]}>
        <Text style={[styles.erowDay, { color: badgeColor }]}>{day}</Text>
        <Text style={[styles.erowMonth, { color: badgeColor }]}>{month}</Text>
      </View>
      <View style={styles.erowMeta}>
        <Text style={styles.erowTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <View style={styles.erowSubRow}>
          {subParts.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <MetaDot color={th.colors.textSubtle} style={styles.erowSubDot} /> : null}
              <Text
                style={[styles.erowSub, i === subParts.length - 1 ? styles.erowSubLast : null]}
                numberOfLines={1}
              >
                {part}
              </Text>
            </React.Fragment>
          ))}
        </View>
      </View>
      <View style={[styles.erowTag, { backgroundColor: tint }]}>
        <Text style={[styles.erowTagText, { color: badgeColor }]}>{badge}</Text>
      </View>
    </Pressable>
  )
}

function EventBucket({
  label,
  count,
  events,
  badge,
  badgeColor,
  emptyText,
  onOpenEvent,
}: {
  label: string
  count?: number
  events: CleanupDTO[]
  badge: string
  badgeColor: string
  emptyText: string
  onOpenEvent?: (event: CleanupDTO) => void
}) {
  const styles = useStyles()
  const sectionStyles = useSectionStyles()
  return (
    <>
      <SubHead label={label} count={count} />
      <View style={styles.eventsList}>
        {events.length === 0 ? (
          <Text style={sectionStyles.empty}>{emptyText}</Text>
        ) : (
          events.map((ev) => (
            <EventRow
              key={ev.id}
              event={ev}
              badge={badge}
              badgeColor={badgeColor}
              onPress={onOpenEvent ? () => onOpenEvent(ev) : undefined}
            />
          ))
        )}
      </View>
    </>
  )
}

/**
 * The "Show more" affordance for the PAST list, wired by the body from `useProfilePastEvents`. Absent on
 * a profile whose inline first page was the whole history (there is no cursor to continue from).
 */
export interface ProfileEventsMore {
  canLoadMore: boolean
  isLoadingMore: boolean
  isError: boolean
  isRetry: boolean
  loadMore: () => void
}

export interface ProfileEventsSectionProps {
  split: ProfileEventSplit
  tab: ProfileEventTab
  onSelectTab: (tab: ProfileEventTab) => void
  onOpenEvent?: (event: CleanupDTO) => void
  more?: ProfileEventsMore
}

export function ProfileEventsSection({
  split,
  tab,
  onSelectTab,
  onOpenEvent,
  more,
}: ProfileEventsSectionProps) {
  const styles = useStyles()
  const sectionStyles = useSectionStyles()
  const th = useTheme()
  const { t } = useT("profile-view")
  const sun700 = th.colors.sun["700"]
  const moss600 = th.colors.moss["600"]

  return (
    <>
      <SectionEyebrow>{t("events.section")}</SectionEyebrow>
      <View style={styles.seg} accessibilityRole="tablist" accessibilityLabel={t("events.section")}>
        {EVENT_TABS.map((id) => {
          const selected = id === tab
          return (
            <Pressable
              key={id}
              onPress={() => onSelectTab(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              {...({ "aria-selected": selected } as object)}
              {...focusRingProps}
              style={[styles.segBtn, selected ? styles.segBtnOn : null]}
            >
              <Text style={[styles.segText, selected ? styles.segTextOn : null]}>
                {id === "upcoming" ? t("events.tab_upcoming") : t("events.tab_past")}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {tab === "upcoming" ? (
        <>
          {split.upcomingHosting.length > 0 ? (
            <EventBucket
              label={t("events.subhead_hosting")}
              events={split.upcomingHosting}
              badge={t("events.badge_host")}
              badgeColor={sun700}
              emptyText={t("events.empty_none")}
              onOpenEvent={onOpenEvent}
            />
          ) : null}
          <EventBucket
            label={t("events.subhead_attending")}
            events={split.upcomingGoing}
            badge={t("events.badge_going")}
            badgeColor={moss600}
            emptyText={t("events.empty_upcoming")}
            onOpenEvent={onOpenEvent}
          />
        </>
      ) : (
        <>
          <EventBucket
            label={t("events.subhead_hosted")}
            count={split.pastHosted.length}
            events={split.pastHosted}
            badge={t("events.badge_hosted")}
            badgeColor={sun700}
            emptyText={t("events.empty_none")}
            onOpenEvent={onOpenEvent}
          />
          <EventBucket
            label={t("events.subhead_attended")}
            count={split.pastAttended.length}
            events={split.pastAttended}
            badge={t("events.badge_went")}
            badgeColor={moss600}
            emptyText={t("events.empty_none")}
            onOpenEvent={onOpenEvent}
          />
          {more?.isError ? (
            <Text style={sectionStyles.loadMoreError}>{t("events.load_more_error")}</Text>
          ) : null}
          {more?.canLoadMore ? (
            <Pressable
              onPress={more.loadMore}
              disabled={more.isLoadingMore}
              accessibilityRole="button"
              accessibilityState={{ disabled: more.isLoadingMore, busy: more.isLoadingMore }}
              accessibilityLabel={t("events.load_more_a11y")}
              {...focusRingProps}
              style={({ pressed }) => [
                sectionStyles.loadMore,
                pressed ? sectionStyles.loadMorePressed : null,
              ]}
            >
              <Text
                style={more.isRetry ? sectionStyles.loadMoreAccentText : sectionStyles.loadMoreText}
              >
                {more.isLoadingMore
                  ? t("events.loading_more")
                  : more.isRetry
                    ? t("events.load_more_retry")
                    : t("events.load_more")}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </>
  )
}

const useStyles = makeThemedStyles((t) => ({
  seg: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    backgroundColor: t.colors.bgAlt,
    borderRadius: t.radius.pill,
  },
  segBtn: {
    flex: 1,
    height: 34,
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segBtnOn: {
    backgroundColor: t.colors.surface,
    ...t.shadows.s1,
  },
  segText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13.5,
    color: t.colors.textSubtle,
  },
  segTextOn: {
    color: t.colors.text,
  },

  eventsList: {
    gap: t.space["2"],
  },
  erow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    paddingVertical: 11,
    paddingHorizontal: 13,
    ...t.shadows.s1,
  },
  erowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  erowDate: {
    width: 46,
    height: 46,
    flexShrink: 0,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  erowDay: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: 19,
    lineHeight: 20,
  },
  erowMonth: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  erowMeta: {
    flex: 1,
    minWidth: 0,
  },
  erowTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  erowSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  erowSub: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
  },
  erowSubLast: {
    flexShrink: 1,
  },
  erowSubDot: {
    marginHorizontal: 5,
  },
  erowTag: {
    flexShrink: 0,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: t.radius.pill,
  },
  erowTagText: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 10.5,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
}))
