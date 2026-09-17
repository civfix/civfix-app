import React, { useCallback } from "react"
import { View } from "react-native"
import { eventWhenLabel } from "@civfix/shared/datetime"
import { headingLevel, makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import { Avatar, Markdown, SecondaryButton, SkeletonDetail, SkeletonGroup } from "../../primitives"
import { useCleanup } from "../../data/hooks/cleanups"
import { useAnnouncement } from "../../data/hooks/announcements"
import { useLocale, useRelativeTime, useT, useViewerTimeZone } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import {
  announcementCounts,
  announcementHeading,
  announcementSentAt,
} from "./announcementModel"

const AVATAR_SIZE = 32

export interface AnnouncementBodyProps {
  id: string
  announcementId: string
}

export function AnnouncementBody({ id, announcementId }: AnnouncementBodyProps) {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()
  const { t } = useT("host-broadcasts")
  const { t: tEnums } = useT("enums")
  const { locale } = useLocale()
  const { relative, weekdays } = useRelativeTime()
  const viewerTimeZone = useViewerTimeZone()

  const cleanup = useCleanup(id)
  const query = useAnnouncement(id, announcementId)

  const onOpenEvent = useCallback(() => {
    useNavStore.getState().push({ kind: "cleanup", id })
  }, [id])

  if (query.isPending) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <SkeletonGroup>
          <SkeletonDetail hero={false} lines={5} rows={0} />
        </SkeletonGroup>
      </ScrollView>
    )
  }

  if (query.isError || !query.data) {
    return (
      <View style={styles.fill}>
        <FeedNotice
          plain
          icon="CloudOff"
          title={t("announce.detail_error_title")}
          body={t("announce.detail_error_body")}
          actionLabel={t("announce.retry")}
          onAction={() => void query.refetch()}
        />
      </View>
    )
  }

  const announcement = query.data
  const heading = announcementHeading(announcement)
  const org = announcement.authorOrg ?? null
  const author = announcement.author ?? null
  const byline = org?.name ?? author?.name ?? t("announce.byline_host")
  const counts = announcementCounts(announcement)
  const event = cleanup.data
  const eventWhen = event
    ? eventWhenLabel(event, { locale, weekdays, viewerTimeZone })
    : null

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {event ? (
        <View style={styles.eventChip}>
          <Text variant="caption" numberOfLines={1}>
            {eventWhen ? `${event.title} · ${eventWhen}` : event.title}
          </Text>
        </View>
      ) : null}

      <View style={styles.byline}>
        <Avatar
          name={byline}
          seed={org?.id ?? author?.id ?? announcement.id}
          photoUrl={org?.logoUrl ?? author?.avatarUrl ?? null}
          gradient={org ? null : (author?.avatar ?? null)}
          size={AVATAR_SIZE}
          decorative
        />
        <View style={styles.bylineMeta}>
          <Text style={styles.bylineName} numberOfLines={1}>
            {byline}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {t("announce.sent_when", { when: relative(announcementSentAt(announcement)) })}
          </Text>
        </View>
      </View>

      {heading ? (
        <Text variant="title" accessibilityRole="header" {...headingLevel(1)} style={styles.title}>
          {heading}
        </Text>
      ) : null}

      <Markdown source={announcement.bodyMd} />

      {counts && announcement.audience ? (
        <Text variant="caption" style={styles.delivery}>
          {t("announce.delivery_line", {
            audience: tEnums(`broadcastSegment.${announcement.audience.kind}`),
            notified: counts.sent,
          })}
        </Text>
      ) : null}

      <SecondaryButton label={t("announce.open_event")} onPress={onOpenEvent} size="sm" />
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
    paddingTop: t.space["3"],
    paddingBottom: t.space["10"],
    gap: t.space["3"],
  },
  eventChip: {
    alignSelf: "flex-start",
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["1"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  byline: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  bylineMeta: {
    flex: 1,
    minWidth: 0,
  },
  bylineName: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  title: {
    marginTop: t.space["1"],
  },
  delivery: {
    marginTop: t.space["2"],
  },
}))
