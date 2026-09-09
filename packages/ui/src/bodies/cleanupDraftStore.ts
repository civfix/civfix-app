/**
 * The persistent in-memory host-event (create-cleanup) draft (zustand). Mirrors report/draftStore.ts: the
 * host form's whole value lives here instead of in HostForm's local state, so navigating to a linked
 * report's detail and back (which UNMOUNTS the form) preserves all progress. The store is the single source
 * of truth for the form value INCLUDING linkedReportIds, so the report detail's "Add to event" can toggle a
 * link while the form (and thus the transient eventReportLinkStore) is unmounted.
 *
 * Platform-neutral (no expo/next/maplibre) so both seams use it and it unit-tests directly. It imports only
 * the CleanupFormValue TYPE (erased at runtime) to avoid pulling CleanupForm's heavy deps into the store.
 */
import { create } from "zustand"
import type { CleanupFormValue } from "./CleanupForm"

interface CleanupDraftState {
  /** A host flow is in progress (drives the report detail's "Back to your event" bar + keep-on-unmount). */
  active: boolean
  /** The full host-form value, or null when no draft is in progress. */
  value: CleanupFormValue | null
  /** Start a draft from `initial`, OR resume the existing one (no-op) when a draft is already active. */
  begin: (initial: CleanupFormValue) => void
  /** Replace the value (the host form's onChange). */
  patch: (value: CleanupFormValue) => void
  /** Add/remove a report id in the draft's linkedReportIds (the report detail's Add/Remove). No-op if idle. */
  toggleLinkedReport: (id: string) => void
  /** Whether a report id is currently linked in the draft. */
  isLinked: (id: string) => boolean
  /** Count of linked reports (for the "Back to your event (N)" bar). */
  linkedCount: () => number
  /** Clear the draft (publish success / genuine exit). */
  clear: () => void
}

export const useCleanupDraft = create<CleanupDraftState>((set, get) => ({
  active: false,
  value: null,

  begin: (initial) =>
    set((s) => (s.active ? s : { active: true, value: initial })),

  patch: (value) => set({ value }),

  toggleLinkedReport: (id) =>
    set((s) => {
      if (!s.value) return s
      const ids = s.value.linkedReportIds
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
      return { value: { ...s.value, linkedReportIds: next } }
    }),

  isLinked: (id) => get().value?.linkedReportIds.includes(id) ?? false,

  linkedCount: () => get().value?.linkedReportIds.length ?? 0,

  clear: () => set({ active: false, value: null }),
}))
