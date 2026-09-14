/**
 * Who a viewer may SEE inside an expanded signup-slot row, and how much of the row is hidden from them.
 *
 * The same follow-only rule the chat roster uses (`chatInfoVisibility.ts`): a non-member's attendee read
 * comes back scoped to `following`, so the names they get are a subset. COUNTS are never suppressed -
 * `slot.claimed` rides on the public `getCleanup` response - so a gated viewer still learns how many
 * people signed up, only not who they are.
 *
 * `hidden` is derived from the DTO's `claimed`, never from the roster array, which folds three
 * truncation sources into one rule: the follow-only filter, the roster's 50-row cap, and a roster that
 * is momentarily behind the detail. A stale `claimed` below `shown` clamps to 0 rather than printing a
 * negative overflow.
 */
import type { CleanupAttendeesResponse } from "@civfix/shared"

export type SlotPeopleAccess = "full" | "followed-only"

export interface SlotPeopleView {
  access: SlotPeopleAccess
  shown: number
  claimed: number
  hidden: number
  showGate: boolean
}

export interface SlotPeopleInput {
  /** The roster read's scope. `undefined` while it is in flight - never a lock, so nothing flashes. */
  scope: CleanupAttendeesResponse["scope"] | undefined
  claimed: number
  shown: number
}

export function slotPeopleView(input: SlotPeopleInput): SlotPeopleView {
  const hidden = Math.max(0, input.claimed - input.shown)
  const followedOnly = input.scope === "following" && hidden > 0
  return {
    access: followedOnly ? "followed-only" : "full",
    shown: input.shown,
    claimed: input.claimed,
    hidden,
    showGate: followedOnly,
  }
}
