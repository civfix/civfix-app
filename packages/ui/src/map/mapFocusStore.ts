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

export type FocusOwner = "page" | "handoff"

export interface MapFocusState {
  focus: FocusedEntity | null
  owner: FocusOwner
  setReport: (report: Omit<FocusedReport, "kind">, owner?: FocusOwner) => void
  setEvent: (event: Omit<FocusedEvent, "kind">, owner?: FocusOwner) => void
  clear: () => void
  /**
   * Release a PAGE-owned focus only if `id` still owns it. The release valve for a body that publishes focus from
   * a mount effect and lets go on unmount.
   *
   * WHY IT EXISTS. This is a singleton, and `shell/PageStack.native` keeps every page on the stack mounted
   * so a pop can reveal its parent (see `fullEntryStack`), so two focus-publishing bodies can be mounted
   * at once over this ONE slot.
   *
   * THE DEFENSIVE HALF, stated honestly - because it is easy to over-credit it and then delete the half
   * that is actually load-bearing. React flushes a commit's passive effects in TWO WHOLE-TREE PASSES:
   * every cleanup first (`commitPassiveUnmountOnFiber`), then every create (`commitPassiveMountOnFiber`).
   * So in the single commit a pop produces, the departing page's cleanup ALWAYS lands before the revealed
   * page re-asserts - an unconditional `clear()` would order correctly there too. What actually closes the
   * defect is the `usePageIsActive()` gate: a buried or leaving layer neither asserts focus nor registers
   * a cleanup at all. `clearFor(id)` is the ownership check that keeps that true under orderings this
   * store does not currently produce (a second writer, a handoff split across commits) - cheap insurance
   * on a global whose failure mode is a blank map behind the page the user navigated back to.
   *
   * `clear()` is untouched and stays the right call for anything that genuinely owns the whole store
   * (a body that has no coordinates to focus at all).
   */
  clearFor: (id: string) => void
  releaseHandoff: () => void
}

export const useMapFocus = create<MapFocusState>((set, get) => ({
  focus: null,
  owner: "page",
  setReport: (report, owner = "page") => set({ focus: { kind: "report", ...report }, owner }),
  setEvent: (event, owner = "page") => set({ focus: { kind: "cleanup", ...event }, owner }),
  clear: () => set({ focus: null, owner: "page" }),
  // Guarded with `get()` rather than by returning the state unchanged from `set`: a no-op that never
  // calls `set` cannot notify a subscriber, so a stale-id release costs the map exactly nothing.
  clearFor: (id) => {
    const state = get()
    if (state.owner === "page" && state.focus?.id === id) set({ focus: null })
  },
  releaseHandoff: () => {
    if (get().owner === "handoff") set({ focus: null, owner: "page" })
  },
}))
