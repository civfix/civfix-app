/**
 * Pure draft->request helpers for the host's signup-slot editor (`SlotEditor` inside `CleanupForm`).
 *
 * The editor keeps slots as DRAFTS, not as `EventSlotInput`s: `capacity` is a free-text string so a
 * half-typed value never fights a numeric type (the same convention `hoursEntries.ts` uses for the
 * per-attendee hours editor), and every draft carries a stable local `key` so React keys and the
 * reorder chevrons survive a re-render. `id` is present only for slots that already exist server-side.
 *
 * The caps are IMPORTED from `@civfix/shared` rather than re-declared: the editor's client-side limits
 * and `EventSlotInputSchema`'s server-side limits must be EQUAL, not merely compatible, or the editor
 * either blocks a legal payload or submits an illegal one.
 *
 * BLANK ROWS ARE NOT ERRORS. A freshly added card is empty, and an empty card is simply dropped at
 * build time - exactly the "empty = skip" rule `hoursEntries.hoursDraftValid` already encodes for the
 * hours editor. `slotDraftError` therefore returns `null` for a fully blank draft so the editor does
 * not paint a red "give this slot a name" line under a card the host has not typed into yet.
 */
import { MAX_SLOT_CAPACITY, MAX_SLOT_TITLE, type EventSlotDTO, type EventSlotInput } from "@civfix/shared"

/** One editable slot row. `key` is local-only; `id` is the server identity (absent = a new slot). */
export interface SlotDraft {
  key: string
  id?: string
  title: string
  description: string
  /** STRING draft. "" = unlimited (the server's `capacity: null`). */
  capacity: string
}

let slotKeySeq = 0

/**
 * A stable local key for a draft row. Monotonic per module load; `seed` is injectable so tests (and
 * any caller that needs determinism) do not depend on module state.
 */
export function makeSlotKey(seed?: number): string {
  return `slot-${seed ?? ++slotKeySeq}`
}

function blankDraft(key: string): SlotDraft {
  return { key, title: "", description: "", capacity: "" }
}

/** Append one empty draft. `nextKey` is passed in so the caller owns key generation. */
export function addSlotDraft(list: readonly SlotDraft[], nextKey: string): SlotDraft[] {
  return [...list, blankDraft(nextKey)]
}

/** Patch one draft by key; unknown keys are a no-op (the row may have been removed mid-keystroke). */
export function updateSlotDraft(
  list: readonly SlotDraft[],
  key: string,
  patch: Partial<SlotDraft>,
): SlotDraft[] {
  return list.map((d) => (d.key === key ? { ...d, ...patch, key: d.key } : d))
}

export function removeSlotDraft(list: readonly SlotDraft[], key: string): SlotDraft[] {
  return list.filter((d) => d.key !== key)
}

/**
 * Move one draft up (-1) or down (+1). A move off either end is a NO-OP that returns the SAME array
 * reference, so the caller's `onChange` can skip a pointless re-render and the disabled chevron at the
 * end of the list cannot silently reorder anything.
 */
export function moveSlotDraft(list: readonly SlotDraft[], key: string, direction: -1 | 1): SlotDraft[] {
  const from = list.findIndex((d) => d.key === key)
  if (from < 0) return list as SlotDraft[]
  const to = from + direction
  if (to < 0 || to >= list.length) return list as SlotDraft[]
  const next = [...list]
  const moved = next[from]
  const target = next[to]
  if (!moved || !target) return list as SlotDraft[]
  next[from] = target
  next[to] = moved
  return next
}

export type SlotDraftError =
  | "empty-title"
  | "title-too-long"
  | "capacity-invalid"
  | "capacity-below-claimed"
  | null

/** All three fields empty - the row exists but the host has not authored it. */
export function isBlankSlotDraft(d: SlotDraft): boolean {
  return d.title.trim() === "" && d.description.trim() === "" && d.capacity.trim() === ""
}

/**
 * Parse a capacity draft. `null` = unlimited (empty draft); `NaN` = the host typed something that is
 * not a usable count. Kept private: callers want `slotDraftError` / `buildSlotInputs`, not the raw
 * three-way result.
 */
function parseCapacity(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return Number.NaN
  if (n < 1 || n > MAX_SLOT_CAPACITY) return Number.NaN
  return n
}

/**
 * The first thing wrong with one draft, in the order the host reads the card top-to-bottom, or `null`.
 *
 * `claimed` is the CURRENT claim count for this slot on the edit form (absent on create). Lowering a
 * capacity below it is rejected HERE even though the server tolerates it: the server's tolerance
 * exists so an existing claimant is never evicted, not as an invitation for the editor to publish a
 * slot that is already over its own limit.
 */
export function slotDraftError(d: SlotDraft, claimed?: number): SlotDraftError {
  if (isBlankSlotDraft(d)) return null
  const title = d.title.trim()
  if (title === "") return "empty-title"
  if (title.length > MAX_SLOT_TITLE) return "title-too-long"
  const capacity = parseCapacity(d.capacity)
  if (capacity !== null && Number.isNaN(capacity)) return "capacity-invalid"
  if (capacity !== null && claimed !== undefined && capacity < claimed) return "capacity-below-claimed"
  return null
}

/**
 * The id -> current claim count map the EDIT form validates against. Built from the event's slots as they
 * exist SERVER-side, which is the only place the counts live; a draft carries no claim count of its own.
 */
export function claimedBySlotId(existing: readonly EventSlotDTO[]): Map<string, number> {
  return new Map(existing.map((s) => [s.id, s.claimed]))
}

/**
 * Every NON-blank draft is error-free (blank drafts are dropped, never submitted).
 *
 * `claimedById` is the EDIT form's claim counts (absent on create, where no slot exists yet). Without it
 * `slotDraftError` cannot produce "capacity-below-claimed" at all, so the card painted a red error line
 * under a Save that stayed enabled - the validation the module documents was decorative. Passing the map
 * here makes the SAME check that paints the line also gate the submit.
 */
export function slotsValid(
  list: readonly SlotDraft[],
  claimedById?: ReadonlyMap<string, number>,
): boolean {
  return list.every((d) => slotDraftError(d, d.id ? claimedById?.get(d.id) : undefined) === null)
}

/**
 * The wire payload: blanks dropped, strings trimmed, `sortOrder` renumbered 0..n-1 over the SURVIVING
 * rows (dropping a blank from the middle must not leave a gap). `description` and `capacity` are sent
 * explicitly as `null` when empty rather than omitted - on update this array is the FULL desired set,
 * so "absent" would be indistinguishable from "clear it".
 */
export function buildSlotInputs(list: readonly SlotDraft[]): EventSlotInput[] {
  const inputs: EventSlotInput[] = []
  for (const d of list) {
    if (isBlankSlotDraft(d)) continue
    const capacity = parseCapacity(d.capacity)
    const description = d.description.trim()
    inputs.push({
      ...(d.id ? { id: d.id } : {}),
      title: d.title.trim(),
      description: description === "" ? null : description,
      capacity: capacity === null || Number.isNaN(capacity) ? null : capacity,
      sortOrder: inputs.length,
    })
  }
  return inputs
}

/** Seed the edit form from the event's current slots (already server-sorted by `sortOrder`). */
export function slotsFromCleanup(slots: readonly EventSlotDTO[]): SlotDraft[] {
  return slots.map((s) => ({
    key: makeSlotKey(),
    id: s.id,
    title: s.title,
    description: s.description ?? "",
    capacity: s.capacity == null ? "" : String(s.capacity),
  }))
}

/**
 * How many people would lose their claim if this edit were published: the summed `claimed` of every
 * ORIGINAL slot whose id no longer appears in the drafts. Drives the edit form's removal caution.
 */
export function removedClaimedCount(
  original: readonly EventSlotDTO[],
  drafts: readonly SlotDraft[],
): number {
  const kept = new Set(drafts.map((d) => d.id).filter((id): id is string => !!id))
  let count = 0
  for (const slot of original) {
    if (!kept.has(slot.id)) count += slot.claimed
  }
  return count
}
