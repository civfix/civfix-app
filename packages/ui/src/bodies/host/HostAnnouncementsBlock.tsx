import React, { useMemo } from "react"
import { Text } from "../../typography"
import { SectionCard } from "../../primitives"
import { announcementRows, useEventAnnouncements } from "../../data/hooks/announcements"
import { useT } from "../../i18n"
import { RowsSkeleton } from "./HostSkeletons"
import {
  AnnouncementPreviewCards,
  AnnouncementRetryRow,
  AnnouncementSeeAllLink,
} from "./announcementPreviewParts"
import { HOST_HISTORY_ANNOUNCEMENTS } from "./announcementModel"

const PENDING_SKELETON_ROWS = 2

export interface HostAnnouncementsBlockProps {
  cleanupId: string
}

export function HostAnnouncementsBlock({ cleanupId }: HostAnnouncementsBlockProps) {
  const { t } = useT("host-broadcasts")
  const query = useEventAnnouncements(cleanupId)
  const rows = useMemo(() => announcementRows(query.data?.pages), [query.data?.pages])

  const seeAll =
    rows.length > HOST_HISTORY_ANNOUNCEMENTS || query.hasNextPage ? (
      <AnnouncementSeeAllLink cleanupId={cleanupId} loaded={rows.length} hasMore={query.hasNextPage} />
    ) : undefined

  return (
    <SectionCard label={t("announce.sent_section")} {...(seeAll ? { trailing: seeAll } : {})}>
      {query.isPending ? <RowsSkeleton rows={PENDING_SKELETON_ROWS} /> : null}

      {query.isError ? (
        <AnnouncementRetryRow
          onRetry={() => {
            void query.refetch()
          }}
        />
      ) : null}

      {!query.isPending && !query.isError && rows.length === 0 ? (
        <Text variant="label">{t("announce.empty")}</Text>
      ) : null}

      <AnnouncementPreviewCards
        cleanupId={cleanupId}
        announcements={rows.slice(0, HOST_HISTORY_ANNOUNCEMENTS)}
        showDelivery
      />
    </SectionCard>
  )
}
