/**
 * Pure presentation model for the ATTENDEE-facing signup-slot picker (`EventSlotsBlock`).
 *
 * Slots are ADDITIVE to RSVP: claiming a slot implies joining, and v1 allows exactly one slot per
 * attendee, which is why "I already hold another slot" is its own row state (`switch`) rather than a
 * two-step release + claim.
 *
 * Ownership is read off `slot.mine` - the server-computed flag - never re-derived from a roster.
 */
import type { EventSlotDTO } from "@civfix/shared"

export type SlotRowState =
  /** Claimable: has room (or is unlimited) and the viewer holds nothing. */
  | "open"
  /** The viewer's own slot; the trailing pill releases it. */
  | "mine"
  /** No room left and the viewer does not hold it. */
  | "full"
  /** Claimable, but the viewer already holds a DIFFERENT slot - one tap switches. */
  | "switch"
  /** Past / non-interactive rendering: counts only, no pills. */
  | "readonly"

/** The id of the slot the viewer currently holds, or null. At most one in v1. */
export function mySlotId(slots: readonly EventSlotDTO[]): string | null {
  return slots.find((s) => s.mine === true)?.id ?? null
}

/**
 * Spots left, or `null` for an UNLIMITED slot (`capacity` null/absent).
 *
 * Clamped at 0 because `claimed` may legitimately EXCEED `capacity`: a host is allowed to lower a
 * capacity below the current claim count and no existing claimant is ever evicted.
 */
export function slotRemaining(slot: EventSlotDTO): number | null {
  if (slot.capacity == null) return null
  return Math.max(0, slot.capacity - slot.claimed)
}

/**
 * The row's state. Precedence is deliberate:
 *
 *   readonly > mine > full > switch > open
 *
 * `mine` outranks `full` so the viewer's own slot never renders as an untouchable "Full" chip when it
 * is exactly at capacity - which is the normal case for the person who took the last spot. A slot with
 * no capacity is never full.
 */
export function slotRowState(
  slot: EventSlotDTO,
  mySlot: string | null,
  readonly: boolean,
): SlotRowState {
  if (readonly) return "readonly"
  if (slot.mine === true || slot.id === mySlot) return "mine"
  const remaining = slotRemaining(slot)
  if (remaining !== null && remaining <= 0) return "full"
  return mySlot === null ? "open" : "switch"
}

/**
 * The block's one-line summary. `capacity` is null when ANY slot is unlimited - summing a mix and
 * printing "6/8" would understate an event that can actually take everyone.
 */
export function slotsFilledSummary(slots: readonly EventSlotDTO[]): {
  claimed: number
  capacity: number | null
} {
  let claimed = 0
  let capacity: number | null = 0
  for (const slot of slots) {
    claimed += slot.claimed
    if (slot.capacity == null) capacity = null
    else if (capacity !== null) capacity += slot.capacity
  }
  return { claimed, capacity }
}

/** By `sortOrder`, then title, so two slots the host never reordered still render deterministically. */
export function sortSlots(slots: readonly EventSlotDTO[]): EventSlotDTO[] {
  return [...slots].sort((a, b) =>
    a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.title.localeCompare(b.title),
  )
}
