import React, { useMemo } from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { Text, TextLink } from "../../typography"
import { SkeletonGroup, SkeletonDetail } from "../../primitives"
import { announcementRows, useEventAnnouncements } from "../../data/hooks/announcements"
import { useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { AnnouncementCard } from "./AnnouncementCard"
import { EVENT_DETAIL_ANNOUNCEMENTS } from "./announcementModel"

export interface EventAnnouncementsBlockProps {
  cleanupId: string
}

/**
 * Event-detail announcements: the newest two, readable by everyone who can read the event. Targeting
 * decides who gets NOTIFIED, never who may read, so this surface carries no audience chip and no
 * delivery counts - a reader outside the audience is never told the news was not for them.
 */
export function EventAnnouncementsBlock({ cleanupId }: EventAnnouncementsBlockProps) {
  const styles = useStyles()
  const { t } = useT("host-broadcasts")
  const query = useEventAnnouncements(cleanupId)
  const rows = useMemo(() => announcementRows(query.data?.pages), [query.data?.pages])

  if (query.isPending) {
    return (
      <View style={styles.section}>
        <SkeletonGroup>
          <SkeletonDetail hero={false} lines={2} rows={0} />
        </SkeletonGroup>
      </View>
    )
  }

  if (query.isError) {
    return (
      <View style={styles.section}>
        <Text variant="caption">{t("announce.section_error")}</Text>
        <TextLink
          variant="label"
          standalone
          accessibilityLabel={t("announce.retry")}
          onPress={() => {
            void query.refetch()
          }}
        >
          {t("announce.retry")}
        </TextLink>
      </View>
    )
  }

  if (rows.length === 0) return null

  const shown = rows.slice(0, EVENT_DETAIL_ANNOUNCEMENTS)
  const more = rows.length > EVENT_DETAIL_ANNOUNCEMENTS || query.hasNextPage

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("announce.section")}</Text>
      {shown.map((announcement) => (
        <AnnouncementCard
          key={announcement.id}
          announcement={announcement}
          onPress={() =>
            useNavStore.getState().push({
              kind: "announcement",
              id: cleanupId,
              announcementId: announcement.id,
            })
          }
        />
      ))}
      {more ? (
        <TextLink
          variant="label"
          standalone
          accessibilityLabel={t("announce.see_all_a11y")}
          onPress={() => useNavStore.getState().push({ kind: "announcements", id: cleanupId })}
        >
          {t("announce.see_all", { total: rows.length })}
        </TextLink>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  section: {
    gap: t.space["2"],
  },
  sectionTitle: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
}))
