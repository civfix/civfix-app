/**
 * The persistent in-memory host-event (create-cleanup) draft (zustand). Mirrors report/draftStore.ts: the
 * host form's whole value lives here instead of in HostForm's local state, so navigating to a linked
 * report's detail and back (which UNMOUNTS the form) preserves all progress. The store is the single source
 * of truth for the form value INCLUDING linkedReportIds, so the report detail's host-draft toggle can add or
 * remove a link while the form is unmounted.
 *
 * Platform-neutral (no expo/next/maplibre) so both seams use it and it unit-tests directly.
 */
import { create } from "zustand"
import { randomId } from "../data/randomId"
import type { CleanupFormValue } from "./cleanupFormModel"
import { registerViewerScopedDrafts } from "../viewerScope"

interface CleanupDraftState {
  /** A host flow is in progress (drives the report detail's "Back to your event" bar + keep-on-unmount). */
  active: boolean
  value: CleanupFormValue | null
  /**
   * The create request's idempotency key. The server dedupes per organizer on it, so it must live exactly
   * as long as this draft: a retry after an ambiguous failure reuses it, and a new draft never inherits it
   * (a reused key would hand back the previous event instead of creating this one).
   */
  idempotencyKey: string | null
  /** Start a draft from `initial`, OR resume the existing one (no-op) when a draft is already active. */
  begin: (initial: CleanupFormValue) => void
  patch: (value: CleanupFormValue) => void
  /**
   * Merge fields into the value as it stands NOW. For writes that land after an await (the cover upload),
   * where replacing with a value captured before the await would drop everything typed meanwhile. No-op
   * once the draft is cleared, so a late write cannot resurrect an abandoned draft.
   */
  merge: (partial: Partial<CleanupFormValue>) => void
  toggleLinkedReport: (id: string) => void
  isLinked: (id: string) => boolean
  linkedCount: () => number
  clear: () => void
}

export const useCleanupDraft = create<CleanupDraftState>((set, get) => ({
  active: false,
  value: null,
  idempotencyKey: null,

  begin: (initial) =>
    set((s) => (s.active ? s : { active: true, value: initial, idempotencyKey: randomId() })),

  patch: (value) => set({ value }),

  merge: (partial) =>
    set((s) => (s.active && s.value ? { value: { ...s.value, ...partial } } : s)),

  toggleLinkedReport: (id) =>
    set((s) => {
      if (!s.value) return s
      const ids = s.value.linkedReportIds
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
      return { value: { ...s.value, linkedReportIds: next } }
    }),

  isLinked: (id) => get().value?.linkedReportIds.includes(id) ?? false,

  linkedCount: () => get().value?.linkedReportIds.length ?? 0,

  clear: () => set({ active: false, value: null, idempotencyKey: null }),
}))

registerViewerScopedDrafts(useCleanupDraft, { discard: () => useCleanupDraft.getState().clear() })
