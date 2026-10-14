import { create } from "zustand"
import type { EventKind, ReportCategory } from "@civfix/shared"

export interface FocusedReport {
  kind: "report"
  id: string
  lat: number
  lng: number
  category: ReportCategory
}

export interface FocusedEvent {
  kind: "cleanup"
  id: string
  lat: number
  lng: number
  eventKind: EventKind
}

export type FocusedEntity = FocusedReport | FocusedEvent

export interface MapFocusState {
  focus: FocusedEntity | null
  setReport: (report: Omit<FocusedReport, "kind">) => void
  setEvent: (event: Omit<FocusedEvent, "kind">) => void
  clear: () => void
  /**
   * `PageStack.native` keeps every stacked page mounted, so two focus-publishing bodies can share this one
   * slot. The `usePageIsActive()` gate is what prevents the defect; the ownership check keeps it true under
   * orderings the store does not produce today (a second writer, a handoff split across commits), where the
   * failure would be a blank map behind the page the user navigated back to.
   */
  clearFor: (id: string) => void
}

export const useMapFocus = create<MapFocusState>((set, get) => ({
  focus: null,
  setReport: (report) => set({ focus: { kind: "report", ...report } }),
  setEvent: (event) => set({ focus: { kind: "cleanup", ...event } }),
  clear: () => set({ focus: null }),
  // Guarded with `get()` so a stale-id release never calls `set` and never notifies a subscriber.
  clearFor: (id) => {
    if (get().focus?.id === id) set({ focus: null })
  },
}))
