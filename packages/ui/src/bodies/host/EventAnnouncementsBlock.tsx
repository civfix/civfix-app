import React, { useMemo } from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { Text, TextLink } from "../../typography"
import { announcementRows, useEventAnnouncements } from "../../data/hooks/announcements"
import { useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { AnnouncementCard } from "./AnnouncementCard"
import { EVENT_DETAIL_ANNOUNCEMENTS } from "./announcementModel"

export interface EventAnnouncementsBlockProps {
  cleanupId: string
}

export function EventAnnouncementsBlock({ cleanupId }: EventAnnouncementsBlockProps) {
  const styles = useStyles()
  const { t } = useT("host-broadcasts")
  const query = useEventAnnouncements(cleanupId)
  const rows = useMemo(() => announcementRows(query.data?.pages), [query.data?.pages])

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
      {query.isError ? (
        <View style={styles.errorRow}>
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
      ) : null}
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
  errorRow: {
    gap: t.space["1"],
  },
  sectionTitle: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
}))
