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
import { isEventEndedRefusal } from "../data/errorCode"

export type SlotRowState =
  | "open"
  /** The viewer's own slot; the trailing pill releases it. */
  | "mine"
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

export interface SlotBoardSummary {
  /** Every slot is capped, so a "{claimed} of {capacity}" line is honest. */
  kind: "capped" | "open"
  claimed: number
  capacity: number | null
}

/**
 * The board's head line. Wraps {@link slotsFilledSummary} and names the two shapes the copy needs: a
 * capped board prints "N of M spots filled", anything else prints the claim count alone, because summing
 * a mix of capped and unlimited slots would understate a board that can actually take everyone.
 */
export function slotBoardSummary(slots: readonly EventSlotDTO[]): SlotBoardSummary {
  const { claimed, capacity } = slotsFilledSummary(slots)
  if (slots.length === 0 || capacity === null) return { kind: "open", claimed, capacity: null }
  return { kind: "capped", claimed, capacity }
}

/** The id the synthetic general row carries. Never a server id - it addresses no `event_slots` row. */
export const GENERAL_SLOT_ID = "general"

/**
 * The one-row board a LIVE event with no slots falls back to, so the page keeps a working join path.
 *
 * Reachable only for an event the default-slot backfill has not reached, or off a cached `getCleanup`
 * written before it. The row mirrors membership rather than a claim - `claimed` is the
 * event's member count and `mine` is the viewer's own membership - and `EventSlotsBlock`'s `general`
 * mode commits it through the join/leave mutation, so nothing here ever addresses `PUT /slot`.
 */
export function generalSlotBoard(input: {
  title: string
  joined: boolean
  going: number
}): EventSlotDTO[] {
  return [
    {
      id: GENERAL_SLOT_ID,
      title: input.title,
      description: null,
      capacity: null,
      claimed: input.going,
      sortOrder: 0,
      mine: input.joined,
      startsAt: null,
      endsAt: null,
    },
  ]
}

export type SlotViewerState =
  | "holds"
  /** Joined, but holding no slot - the one state the board actively nudges. */
  | "going_no_slot"
  | "not_going"
  | "signed_out"
  /** Acting host holding no slot: they organise the board, they are never nagged to fill it. */
  | "host"
  /** Done / ended / cancelled - the board is a record, not a call to action. */
  | "ended"

/**
 * Which one-line strip sits above the rows. Precedence is deliberate: a read-only board says nothing
 * about what to do next, and holding a slot outranks every role, because "you're signed up for X" is
 * the most useful sentence the page can show that viewer.
 *
 * While auth is still pending the viewer is treated as signed-in-but-not-going, so the guest line never
 * flashes at someone who turns out to have a session.
 */
export function slotViewerState(input: {
  slots: readonly EventSlotDTO[]
  joined: boolean
  actsAsHost: boolean
  readonly: boolean
  isAuthenticated: boolean
  authPending: boolean
}): SlotViewerState {
  if (input.readonly) return "ended"
  if (mySlotId(input.slots) !== null) return "holds"
  if (input.actsAsHost) return "host"
  if (input.joined) return "going_no_slot"
  if (!input.isAuthenticated && !input.authPending) return "signed_out"
  return "not_going"
}

export function claimSlotErrorKey(
  code: string | undefined,
  fields?: Record<string, string> | undefined,
): string {
  if (isEventEndedRefusal(fields)) return "error.ended"
  if (code === "CONFLICT") return "error.full"
  return "error.generic"
}

export interface SlotWindow {
  start: Date
  end: Date
}

export function slotWindow(slot: EventSlotDTO): SlotWindow | null {
  if (slot.startsAt == null || slot.endsAt == null) return null
  const start = new Date(slot.startsAt)
  const end = new Date(slot.endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { start, end }
}

export function boardHasTimedSlots(slots: readonly EventSlotDTO[]): boolean {
  return slots.some((slot) => slotWindow(slot) !== null)
}

function byOrderThenTitle(a: EventSlotDTO, b: EventSlotDTO): number {
  return a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.title.localeCompare(b.title)
}

export function slotDisplayOrder(slots: readonly EventSlotDTO[]): EventSlotDTO[] {
  const timed: { slot: EventSlotDTO; start: number }[] = []
  const untimed: EventSlotDTO[] = []
  for (const slot of slots) {
    const window = slotWindow(slot)
    if (window === null) untimed.push(slot)
    else timed.push({ slot, start: window.start.getTime() })
  }
  timed.sort((a, b) => (a.start !== b.start ? a.start - b.start : byOrderThenTitle(a.slot, b.slot)))
  untimed.sort(byOrderThenTitle)
  return [...timed.map((entry) => entry.slot), ...untimed]
}

export function currentShifts(slots: readonly EventSlotDTO[], now: Date): EventSlotDTO[] {
  const at = now.getTime()
  return slots.filter((slot) => {
    const window = slotWindow(slot)
    return window !== null && window.start.getTime() <= at && at < window.end.getTime()
  })
}

export function sortSlots(slots: readonly EventSlotDTO[]): EventSlotDTO[] {
  return [...slots].sort(byOrderThenTitle)
}
