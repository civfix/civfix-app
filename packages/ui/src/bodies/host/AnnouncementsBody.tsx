import React, { useMemo } from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { Text, TextLink } from "../../typography"
import { SkeletonGroup, SkeletonList } from "../../primitives"
import { useCleanup } from "../../data/hooks/cleanups"
import { announcementRows, useEventAnnouncements } from "../../data/hooks/announcements"
import { hasHostCapability } from "../../data/hooks/host"
import { useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { AnnouncementCard } from "./AnnouncementCard"

const MORE_ROW_HEIGHT = 44

export function AnnouncementsBody({ id }: { id: string }) {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()
  const { t } = useT("host-broadcasts")

  const cleanup = useCleanup(id)
  const query = useEventAnnouncements(id)
  const rows = useMemo(() => announcementRows(query.data?.pages), [query.data?.pages])
  const showDelivery = hasHostCapability(cleanup.data, "broadcast")

  if (query.isPending) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <SkeletonGroup>
          <SkeletonList kind="report" rows={3} />
        </SkeletonGroup>
      </ScrollView>
    )
  }

  if (query.isError) {
    return (
      <View style={styles.fill}>
        <FeedNotice
          plain
          icon="CloudOff"
          title={t("announce.list_error_title")}
          body={t("announce.list_error_body")}
          actionLabel={t("announce.retry")}
          onAction={() => void query.refetch()}
        />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {rows.length === 0 ? (
        <Text variant="label" style={styles.empty}>
          {t("announce.empty")}
        </Text>
      ) : null}

      {rows.map((announcement) => (
        <AnnouncementCard
          key={announcement.id}
          announcement={announcement}
          showDelivery={showDelivery}
          onPress={() =>
            useNavStore.getState().push({
              kind: "announcement",
              id,
              announcementId: announcement.id,
            })
          }
        />
      ))}

      {query.hasNextPage ? (
        <View style={styles.moreRow}>
          <TextLink
            variant="label"
            standalone
            accessibilityLabel={t("announce.show_more")}
            onPress={() => {
              void query.fetchNextPage()
            }}
          >
            {query.isFetchingNextPage ? t("announce.loading_more") : t("announce.show_more")}
          </TextLink>
        </View>
      ) : null}
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
  empty: {
    paddingVertical: t.space["4"],
  },
  moreRow: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: MORE_ROW_HEIGHT,
  },
}))
