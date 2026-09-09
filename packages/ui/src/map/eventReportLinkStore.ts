/**
 * The shared "link reports to an event ON THE MAIN MAP" bus (the event/cleanup report-linking UX).
 *
 * On web in LANDSCAPE the persistent home map fills the screen behind the host sidebar, so linking reports
 * to a cleanup is done by tapping report PINS on the BIG map the user is already looking at rather than in a
 * separate inline list. This tiny zustand store bridges the SHARED components that must cooperate without
 * either importing the app:
 *   - the shared <Map/> (.web seam) REGISTERS itself (`setMapRegistered`) on mount, and while a link is
 *     `active` it highlights the `selectedIds` pins and routes a report-pin tap to `toggle(id)` (optionally
 *     scoping the shown pins to `filterCategories`);
 *   - the host create/edit-cleanup form STARTS a link on enter, seeding the currently-selected report ids
 *     and registering its `onToggle` mutation; `toggle(id)` calls back into that so the FORM owns the
 *     actual add/remove of a linked report (one code path, like locationPickStore's onChange resolution).
 *
 * The store holds ONLY the transient link state (active / selectedIds / filterCategories / whether a main
 * map is mounted). It does NOT mutate the form's linked-report list itself - the form that started the link
 * owns that via the `onToggle` it registered, so the toggle flows back through the same callback the form
 * uses. `mapRegistered` lets the form fall back to its own inline picker for a cold deep-link (the form
 * mounted before any main map did).
 *
 * The `onToggle` callback is deliberately kept OUTSIDE the reactive zustand state (a module-level slot):
 * it is a stable form handler, not render-affecting data, so parking it off-state avoids needless selector
 * churn and keeps the store snapshot serializable. `start` registers it, `stop`/`toggle` read it.
 *
 * Pure zustand (mirrors locationPickStore.ts) - no next / expo / react-native / maplibre - so it unit-tests
 * directly and both seam files (.web map + the form) may import it.
 */
import { create } from "zustand"
import type { ReportCategory } from "@civfix/shared"

export interface EventReportLinkState {
  /** Whether a "link reports on the main map" is in progress (the form is mounted/active). */
  active: boolean
  /** The currently-linked report ids (seeded by the form on start, mirrored as the form toggles). */
  selectedIds: string[]
  /** Optional category scope for the pins the picker shows; empty means "all categories". */
  filterCategories: ReportCategory[]
  /**
   * Transient UI: the report id whose inline marker-anchored panel is open (the small photo + description
   * card that appears when a badged pin is tapped while linking), or null when no panel is open. Purely
   * presentational - it does NOT affect the link selection (that is `selectedIds`) and is deliberately NOT
   * read by the marker reconcile so opening/closing the panel never rebuilds the pin markers. Cleared by
   * `stop()` alongside the rest of the link state.
   */
  openPanelReportId: string | null
  /**
   * Whether a SHARED <Map/> has registered itself as the active main map. The form only delegates to the
   * main map (tap pins to link) when this is true; otherwise it falls back to its own inline picker (a cold
   * deep-link before the home map mounts).
   */
  mapRegistered: boolean

  /**
   * Begin a link (the form calls this on enter), seeding `selectedIds` with the current selection and
   * registering the form's `onToggle` so `toggle(id)` reaches the form's add/remove mutation.
   */
  start: (a: { selectedIds: string[]; onToggle: (id: string) => void }) => void
  /** End the link (the form calls this on leave / done). Clears selection + filter + the registered onToggle. */
  stop: () => void
  /** Mirror the form's current selection into the store (so the map highlights the right pins). */
  setSelectedIds: (ids: string[]) => void
  /** Scope the shown pins to these categories (empty = all). */
  setFilterCategories: (c: ReportCategory[]) => void
  /** Open / close the inline marker-anchored report panel (null closes it). Purely presentational. */
  setOpenPanelReportId: (id: string | null) => void
  /** Toggle a report's linked state - invokes the form-registered `onToggle(id)` (the form owns the mutation). */
  toggle: (id: string) => void
  /** Whether a report id is currently in the selection. */
  isSelected: (id: string) => boolean
  /** The shared <Map/> registers / unregisters itself on mount / unmount. */
  setMapRegistered: (v: boolean) => void
}

/**
 * The form-registered toggle handler, parked OUTSIDE the reactive store (see the module note). `start`
 * sets it, `stop` clears it; `toggle` invokes it. Null when no link is active.
 */
let registeredOnToggle: ((id: string) => void) | null = null

export const useEventReportLink = create<EventReportLinkState>((set, get) => ({
  active: false,
  selectedIds: [],
  filterCategories: [],
  openPanelReportId: null,
  mapRegistered: false,

  start: ({ selectedIds, onToggle }) => {
    registeredOnToggle = onToggle
    set({ active: true, selectedIds })
  },

  stop: () => {
    registeredOnToggle = null
    set({ active: false, selectedIds: [], filterCategories: [], openPanelReportId: null })
  },

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  // Changing the pin scope can remove the report whose inline panel is open; close it so a panel never
  // floats over the map with no underlying pin.
  setFilterCategories: (c) => set({ filterCategories: c, openPanelReportId: null }),

  setOpenPanelReportId: (id) => set({ openPanelReportId: id }),

  // The form owns the actual add/remove of a linked report; the store just relays the tap so there is a
  // single mutation code path. A no-op when nothing has registered (no active link).
  toggle: (id) => registeredOnToggle?.(id),

  isSelected: (id) => get().selectedIds.includes(id),

  setMapRegistered: (v) => set({ mapRegistered: v }),
}))
