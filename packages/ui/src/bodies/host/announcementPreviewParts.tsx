import React from "react"
import { View } from "react-native"
import type { AnnouncementDTO } from "@civfix/shared"
import { makeThemedStyles } from "../../theme"
import { Text, TextLink } from "../../typography"
import { useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { AnnouncementCard } from "./AnnouncementCard"
import { seeAllTotal } from "./announcementModel"

function openAnnouncement(cleanupId: string, announcementId: string): void {
  useNavStore.getState().push({ kind: "announcement", id: cleanupId, announcementId })
}

export interface AnnouncementPreviewCardsProps {
  cleanupId: string
  announcements: readonly AnnouncementDTO[]
  showDelivery?: boolean
}

export function AnnouncementPreviewCards({
  cleanupId,
  announcements,
  showDelivery = false,
}: AnnouncementPreviewCardsProps) {
  return (
    <>
      {announcements.map((announcement) => (
        <AnnouncementCard
          key={announcement.id}
          announcement={announcement}
          showDelivery={showDelivery}
          onPress={() => openAnnouncement(cleanupId, announcement.id)}
        />
      ))}
    </>
  )
}

export interface AnnouncementSeeAllLinkProps {
  cleanupId: string
  loaded: number
  hasMore: boolean
}

export function AnnouncementSeeAllLink({ cleanupId, loaded, hasMore }: AnnouncementSeeAllLinkProps) {
  const { t } = useT("host-broadcasts")
  const total = seeAllTotal(loaded, hasMore)
  return (
    <TextLink
      variant="label"
      standalone
      accessibilityLabel={t("announce.see_all_a11y")}
      onPress={() => useNavStore.getState().push({ kind: "announcements", id: cleanupId })}
    >
      {total === null ? t("announce.see_all_open") : t("announce.see_all", { total })}
    </TextLink>
  )
}

export function AnnouncementRetryRow({ onRetry }: { onRetry: () => void }) {
  const styles = useStyles()
  const { t } = useT("host-broadcasts")
  return (
    <View style={styles.retryRow}>
      <Text variant="caption">{t("announce.section_error")}</Text>
      <TextLink variant="label" standalone accessibilityLabel={t("announce.retry")} onPress={onRetry}>
        {t("announce.retry")}
      </TextLink>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  retryRow: {
    gap: t.space["1"],
  },
}))
