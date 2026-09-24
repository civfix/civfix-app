import React, { useCallback, useMemo } from "react"
import { View } from "react-native"
import type { EventRegistrationDTO, EventSlotDTO } from "@civfix/shared"
import { makeThemedStyles } from "../../../theme"
import { TextLink } from "../../../typography"
import { useT } from "../../../i18n"
import { SlotGroupHeader } from "../../SlotGroupHeader"
import { groupRosterBySlot, type RosterListItem } from "../../rosterSlotGroups"
import { RosterCheckinRow } from "../RosterCheckinList"
import type { RosterPaging } from "../RosterPagedList"

export type CheckinRosterItem = RosterListItem<EventRegistrationDTO>

export function useCheckinRosterItems(
  rows: readonly EventRegistrationDTO[],
  slots: readonly EventSlotDTO[],
): CheckinRosterItem[] {
  const { t } = useT("event-slots")
  return useMemo<CheckinRosterItem[]>(
    () =>
      slots.length > 0
        ? groupRosterBySlot(rows, slots, { unassignedTitle: t("roster.unassigned") })
        : rows.map((person) => ({ kind: "member", person }) as const),
    [rows, slots, t],
  )
}

export function useCheckinRosterRenderer({
  timeZone,
  pending,
  onCheckIn,
  onUndo,
}: {
  timeZone: string | undefined
  pending: boolean
  onCheckIn: (seatId: string) => void
  onUndo: (seatId: string) => void
}) {
  return useCallback(
    ({ item }: { item: CheckinRosterItem }) => {
      if (item.kind === "slot-header") {
        return (
          <SlotGroupHeader
            title={item.title}
            claimed={item.claimed}
            capacity={item.capacity}
            startsAt={item.startsAt}
            endsAt={item.endsAt}
            timeZone={timeZone}
          />
        )
      }
      if (item.kind === "slot-empty") return null
      return (
        <RosterCheckinRow
          row={item.person}
          canCheckIn
          pending={pending}
          onCheckIn={onCheckIn}
          onUndo={onUndo}
        />
      )
    },
    [onCheckIn, onUndo, pending, timeZone],
  )
}

export function CheckinRosterMore({ paging }: { paging: RosterPaging }) {
  const styles = useStyles()
  const { t } = useT("host-common")
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = paging
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  if (!hasNextPage) return null
  return (
    <View style={styles.more}>
      <TextLink
        variant="label"
        standalone
        disabled={isFetchingNextPage}
        onPress={loadMore}
        accessibilityLabel={t("roster.load_more_a11y")}
      >
        {isFetchingNextPage ? t("roster.loading_more") : t("roster.load_more")}
      </TextLink>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  more: {
    alignSelf: "flex-start",
    paddingVertical: t.space["2"],
  },
}))
