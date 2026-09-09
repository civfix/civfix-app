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
 * The unassigned group is omitted entirely when it is empty (it is not a slot the host authored, so
 * an empty one says nothing).
 *
 * Generic over the person type so `MembersBody` can pass its own `RosterPerson` (a `PersonDTO` plus an
 * optional cleanup role) without a cast; all this module needs is an `id` and the optional `slot` ref.
 */
import type { EventSlotDTO } from "@civfix/shared"

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
      claimed: number
      capacity: number | null
    }
  | { kind: "slot-empty"; slotId: string | null; title: string }
  | { kind: "member"; person: P }

/**
 * `claimed` on the header is the number of roster rows ACTUALLY in the group, not `slot.claimed`:
 * the header sits directly above the rows it counts, so a disagreement between the two would be
 * visible on screen. `slot.claimed` still drives the attendee-facing picker, which has no roster.
 */
export function groupRosterBySlot<P extends RosterSlotPerson>(
  attendees: readonly P[],
  slots: readonly EventSlotDTO[],
  opts: { unassignedTitle: string; emptySlotTitle: string },
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
  const ordered = [...slots].sort((a, b) =>
    a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.title.localeCompare(b.title),
  )
  const known = new Set(ordered.map((s) => s.id))
  for (const slot of ordered) {
    const members = bySlot.get(slot.id) ?? []
    items.push({
      kind: "slot-header",
      slotId: slot.id,
      title: slot.title,
      claimed: members.length,
      capacity: slot.capacity ?? null,
    })
    if (members.length === 0) {
      items.push({ kind: "slot-empty", slotId: slot.id, title: opts.emptySlotTitle })
      continue
    }
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
      claimed: trailing.length,
      capacity: null,
    })
    for (const person of trailing) items.push({ kind: "member", person })
  }
  return items
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
