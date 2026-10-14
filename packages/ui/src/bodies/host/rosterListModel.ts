import type { EventRegistrationDTO, EventSlotDTO } from "@civfix/shared"
import { groupRosterBySlot, type RosterListItem } from "../rosterSlotGroups"

export type RosterCheckinItem = RosterListItem<EventRegistrationDTO>

export interface RosterPaging {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => Promise<unknown>
}

/**
 * No `emptySlotTitle`: a paged and filtered roster cannot call a slot empty, because its rows may simply not be
 * on the pages read so far.
 */
export function rosterCheckinItems(
  rows: readonly EventRegistrationDTO[],
  slots: readonly EventSlotDTO[],
  unassignedTitle: string,
): RosterCheckinItem[] {
  return slots.length > 0
    ? groupRosterBySlot(rows, slots, { unassignedTitle })
    : rows.map((person) => ({ kind: "member", person }) as const)
}

/** A press while a page is already in flight would fetch the same cursor twice. */
export function requestNextRosterPage(paging: RosterPaging): void {
  if (!paging.hasNextPage || paging.isFetchingNextPage) return
  void paging.fetchNextPage()
}
