/**
 * Group a cleanup roster by signup slot, as a FLAT item list.
 *
 * Flat on purpose: `MembersBody` renders the roster through `useScrollHost()`'s `FlatList`, and a
 * `SectionList` would bypass the sheet-handoff decorators entirely. So the section headers are items,
 * not sections.
 *
 * Order: slots by `sortOrder` (each header immediately followed by its members), then the UNASSIGNED
 * group last. A slot nobody claimed still emits its header plus one `slot-empty` placeholder so the
 * host can SEE the gap they need to fill - that visibility is the whole point of the grouped view.
 * Omit `emptySlotTitle` and an unclaimed slot is skipped entirely instead: a paginated or filtered
 * roster cannot honestly call a slot empty, because its rows may simply not be on the pages read so
 * far. The unassigned group is omitted entirely when it is empty (it is not a slot the host authored,
 * so an empty one says nothing).
 *
 * Generic over the person type so each caller passes its own row without a cast - `MembersBody`'s
 * `RosterPerson` (a `PersonDTO` plus an optional cleanup role) and the host roster's
 * `EventRegistrationDTO` alike; all this module needs is an `id` and the optional `slot` ref.
 */
import type { EventSlotDTO } from "@civfix/shared"
import { slotDisplayOrder } from "./eventSlotsModel"

/** The minimum this module needs off a roster row. `AttendeeDTO` satisfies it. */
export interface RosterSlotPerson {
  id: string
  slot?: { id: string; title: string } | null
}

export type RosterListItem<P extends RosterSlotPerson = RosterSlotPerson> =
  | {
      kind: "slot-header"
      /** null = the trailing "no slot" group. */
      slotId: string | null
      title: string
      claimed: number | null
      capacity: number | null
      startsAt: string | null
      endsAt: string | null
    }
  | { kind: "slot-empty"; slotId: string | null; title: string }
  | { kind: "member"; person: P }

/**
 * `claimed` on a slot header is that slot's OWN `claimed` off the event's slot board, never the
 * number of rows in the list: the roster is paged and filtered, so a page-local count would tell a
 * host filtering for "not checked in" that a full slot is nearly empty. The trailing "no slot" group
 * answers to no slot, so it carries `claimed: null` and the header prints no fraction for it.
 */
export function groupRosterBySlot<P extends RosterSlotPerson>(
  attendees: readonly P[],
  slots: readonly EventSlotDTO[],
  opts: { unassignedTitle: string; emptySlotTitle?: string | null },
): RosterListItem<P>[] {
  const bySlot = new Map<string, P[]>()
  const unassigned: P[] = []
  for (const person of attendees) {
    const slotId = person.slot?.id
    if (!slotId) {
      unassigned.push(person)
      continue
    }
    const bucket = bySlot.get(slotId)
    if (bucket) bucket.push(person)
    else bySlot.set(slotId, [person])
  }

  const items: RosterListItem<P>[] = []
  const ordered = slotDisplayOrder(slots)
  const known = new Set(ordered.map((s) => s.id))
  const emptySlotTitle = opts.emptySlotTitle ?? null
  const headerFor = (slot: EventSlotDTO): RosterListItem<P> => ({
    kind: "slot-header",
    slotId: slot.id,
    title: slot.title,
    claimed: slot.claimed,
    capacity: slot.capacity ?? null,
    startsAt: slot.startsAt ?? null,
    endsAt: slot.endsAt ?? null,
  })
  for (const slot of ordered) {
    const members = bySlot.get(slot.id) ?? []
    if (members.length === 0) {
      if (emptySlotTitle === null) continue
      items.push(headerFor(slot))
      items.push({ kind: "slot-empty", slotId: slot.id, title: emptySlotTitle })
      continue
    }
    items.push(headerFor(slot))
    for (const person of members) items.push({ kind: "member", person })
  }

  // An attendee whose slot was deleted between the roster read and the cleanup read would otherwise
  // vanish from the list. Fold those rows into "no slot" rather than dropping a real person.
  const orphaned: P[] = []
  for (const [slotId, members] of bySlot) {
    if (!known.has(slotId)) orphaned.push(...members)
  }
  const trailing = [...unassigned, ...orphaned]
  if (trailing.length > 0) {
    items.push({
      kind: "slot-header",
      slotId: null,
      title: opts.unassignedTitle,
      claimed: null,
      capacity: null,
      startsAt: null,
      endsAt: null,
    })
    for (const person of trailing) items.push({ kind: "member", person })
  }
  return items
}

/**
 * The same grouping, bucketed by slot id for a caller that renders PER SLOT rather than as one list
 * (the attendee-facing board's expanded rows). Walks the flat items so both surfaces read the SAME
 * grouping decision - including the orphan fold - instead of re-implementing it.
 *
 * The trailing "no slot" group is skipped: it belongs to no row. Server order is preserved.
 */
export function claimantsBySlot<P extends RosterSlotPerson>(
  items: readonly RosterListItem<P>[],
): Map<string, P[]> {
  const bySlot = new Map<string, P[]>()
  let current: string | null = null
  for (const item of items) {
    if (item.kind === "slot-header") {
      current = item.slotId
      continue
    }
    if (item.kind !== "member" || current === null) continue
    const bucket = bySlot.get(current)
    if (bucket) bucket.push(item.person)
    else bySlot.set(current, [item.person])
  }
  return bySlot
}

/** A stable React key. Members are unique by id (one slot per attendee in v1). */
export function rosterListKey(item: RosterListItem): string {
  switch (item.kind) {
    case "slot-header":
      return `slot-header:${item.slotId ?? "unassigned"}`
    case "slot-empty":
      return `slot-empty:${item.slotId ?? "unassigned"}`
    default:
      return `member:${item.person.id}`
  }
}
