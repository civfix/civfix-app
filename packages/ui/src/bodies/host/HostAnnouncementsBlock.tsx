import React, { useMemo } from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { Text, TextLink } from "../../typography"
import { SectionCard } from "../../primitives"
import { announcementRows, useEventAnnouncements } from "../../data/hooks/announcements"
import { useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { RowsSkeleton } from "./HostSkeletons"
import { AnnouncementCard } from "./AnnouncementCard"
import { HOST_HISTORY_ANNOUNCEMENTS, seeAllTotal } from "./announcementModel"

export interface HostAnnouncementsBlockProps {
  cleanupId: string
}

export function HostAnnouncementsBlock({ cleanupId }: HostAnnouncementsBlockProps) {
  const styles = useStyles()
  const { t } = useT("host-broadcasts")
  const query = useEventAnnouncements(cleanupId)
  const rows = useMemo(() => announcementRows(query.data?.pages), [query.data?.pages])
  const total = seeAllTotal(rows.length, query.hasNextPage)

  const seeAll =
    rows.length > HOST_HISTORY_ANNOUNCEMENTS || query.hasNextPage ? (
      <TextLink
        variant="label"
        standalone
        accessibilityLabel={t("announce.see_all_a11y")}
        onPress={() => useNavStore.getState().push({ kind: "announcements", id: cleanupId })}
      >
        {total === null ? t("announce.see_all_open") : t("announce.see_all", { total })}
      </TextLink>
    ) : undefined

  return (
    <SectionCard label={t("announce.sent_section")} {...(seeAll ? { trailing: seeAll } : {})}>
      {query.isPending ? <RowsSkeleton rows={2} /> : null}

      {query.isError ? (
        <View style={styles.note}>
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

      {!query.isPending && !query.isError && rows.length === 0 ? (
        <Text variant="label">{t("announce.empty")}</Text>
      ) : null}

      {rows.slice(0, HOST_HISTORY_ANNOUNCEMENTS).map((announcement) => (
        <AnnouncementCard
          key={announcement.id}
          announcement={announcement}
          showDelivery
          onPress={() =>
            useNavStore.getState().push({
              kind: "announcement",
              id: cleanupId,
              announcementId: announcement.id,
            })
          }
        />
      ))}
    </SectionCard>
  )
}

const useStyles = makeThemedStyles((t) => ({
  note: {
    gap: t.space["1"],
  },
}))
