import React, { useMemo } from "react"
import { View } from "react-native"
import { headingLevel, makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import { announcementRows, useEventAnnouncements } from "../../data/hooks/announcements"
import { useT } from "../../i18n"
import {
  AnnouncementPreviewCards,
  AnnouncementRetryRow,
  AnnouncementSeeAllLink,
} from "./announcementPreviewParts"
import { EVENT_DETAIL_ANNOUNCEMENTS } from "./announcementModel"

export interface EventAnnouncementsBlockProps {
  cleanupId: string
}

export function EventAnnouncementsBlock({ cleanupId }: EventAnnouncementsBlockProps) {
  const styles = useStyles()
  const { t } = useT("host-broadcasts")
  const query = useEventAnnouncements(cleanupId)
  const rows = useMemo(() => announcementRows(query.data?.pages), [query.data?.pages])

  if (rows.length === 0 && !query.isError) return null

  const more = rows.length > EVENT_DETAIL_ANNOUNCEMENTS || query.hasNextPage

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header" {...headingLevel(3)}>
        {t("announce.section")}
      </Text>
      <AnnouncementPreviewCards
        cleanupId={cleanupId}
        announcements={rows.slice(0, EVENT_DETAIL_ANNOUNCEMENTS)}
      />
      {query.isError ? (
        <AnnouncementRetryRow
          onRetry={() => {
            void query.refetch()
          }}
        />
      ) : null}
      {more ? (
        <AnnouncementSeeAllLink
          cleanupId={cleanupId}
          loaded={rows.length}
          hasMore={query.hasNextPage}
        />
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
