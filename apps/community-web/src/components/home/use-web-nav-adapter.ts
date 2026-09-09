"use client"

import * as React from "react"
import {
  useNavStore,
  entryFromPath,
  layoutModeFor,
  pathForEntry,
  type DetailKind,
  type NavState,
  type View,
} from "@civfix/ui"

/**
 * The WEB deep-link / URL adapter for the unified nav store (UI-unification, stage 3B-2).
 *
 * The shared @civfix/ui nav store + shell are platform-agnostic and NEVER touch window.history; this
 * web-app-side hook owns the URL <-> store bridge, lifting the logic that used to live in
 * home-shell.tsx (seed-on-mount + popstate re-seed) and use-panel-nav.ts (syncUrl on push). It:
 *
 *   (a) seeds the store from the LIVE window.location.pathname on mount (handling the static-export
 *       SPA-fallback placeholder segments like "/pin/_"),
 *   (b) subscribes to the store's active entry and history.pushState's the canonical path on change,
 *   (c) on popstate, re-seeds the store from the new pathname.
 *
 * URL sync uses raw history.pushState/replaceState (NOT next/navigation) on purpose, matching the
 * deliberate choice in the old use-panel-nav.ts: a Next client navigation to /pin/<id> would unmount
 * the shell (and the map) and mount the catch-all route shell. We want the opposite - keep the shell,
 * swap the active panel, and merely reflect the URL. The catch-all routes still exist for cold deep
 * links / SPA fallback; when one boots it renders HomeShell, which calls this hook to seed the store.
 */

/**
 * The live layout mode at call time, so the mount seed branches list-kinds correctly. Delegates to the
 * shared `layoutModeFor` (the same rule useLayoutMode() applies: landscape/square AND wide enough for
 * the expanded frame) so the seed matches the surface the store + shell will render.
 */
function liveMode(): "compact" | "expanded" {
  if (typeof window === "undefined") return "compact"
  return layoutModeFor(window.innerWidth, window.innerHeight)
}

/**
 * Resolve the pathname to seed from. Under output:"export" a fallback-served deep link arrives at the
 * placeholder route ("/pin/_") while window.location holds the real "/pin/<id>"; prefer the live
 * location unless it is itself a placeholder ("/.../_/..."). Mirrors the old HomeShell seed logic.
 */
function seedPathname(): string {
  if (typeof window === "undefined") return "/"
  const live = window.location.pathname
  return live && live !== "/" && !live.includes("/_/") ? live : "/"
}

/**
 * Seed (replace) the whole store from a pathname, branching list-kind vs detail by the live mode.
 *
 * The store's `seed` ACTION owns the seeding invariant (apply `seedFor`, re-derive `active` from the
 * resulting stack, and clear a stale panel on a home/unmapped path) - this adapter only decides WHICH
 * entry and WHICH layout mode. It used to hand-merge the partial through a raw `setState`, which
 * shallow-merges without running reducers and so had to repair `active` itself.
 */
function seedStoreFromPath(pathname: string): void {
  useNavStore.getState().seed(entryFromPath(pathname), liveMode())
}

/**
 * The list DetailKind that a `View` maps to (the inverse of the shared `viewForEntry`). A selected list
 * lives in `view` with no active detail in BOTH layouts now that `seedFor` unified the list kinds onto
 * their views, so this is the only way those four URLs are derived. "home" has no URL of its own (it is
 * "/"), so it is absent here.
 */
const LIST_KIND_FOR_VIEW: Partial<Record<View, DetailKind>> = {
  events: "cleanups",
  messaging: "messages",
  social: "people",
  reports: "myreports",
}

/**
 * The canonical URL for the current nav state. An active detail/panel wins (`pathForEntry(active)`);
 * otherwise a non-home list `view` maps to its list URL; otherwise home. Both layouts select a seeded list
 * as `view`, so this is what round-trips `/cleanups` `/people` `/reports` `/messages` in either mode. A
 * list that a flow still PUSHES (a stacked drill-down) is an `active` entry and takes the first branch.
 */
function pathForState(state: NavState): string {
  // The drop-pin menu is a TRANSIENT map affordance, not an addressable page — `pathForEntry` returns
  // "/map" for it on the assumption that the address bar already shows /map, so syncUrl's same-path skip
  // suppresses the write. That only holds on COMPACT. On EXPANDED the map is mounted for every view
  // (AppShell: `mountMap = mode === "expanded" || …`), so a desktop right-click from, say, "/" would
  // pushState("/map") and Cancel would push a second entry back — leaving a browser Back that lands on
  // the Map view instead of where the user was, and a reload that boots into Map with no menu. Fall
  // through to the view-derived path instead, so the skip fires on BOTH layouts.
  if (state.active && state.active.kind !== "drop-pin") return pathForEntry(state.active)
  if (state.view === "map") return "/map"
  if (state.view === "search") return "/search"
  const listKind = LIST_KIND_FOR_VIEW[state.view]
  return listKind ? pathForEntry({ kind: listKind }) : "/"
}

/** The canonical path of the in-progress report wizard ("drop"); see `pathForEntry({ kind: "drop" })`. */
const REPORT_FLOW_PATH = "/report"

/**
 * Push `path` into the address bar (replicates use-panel-nav.ts syncUrl). Skips the write when the bar
 * already matches (so a popstate-driven re-seed does not push a duplicate entry, and a no-op store
 * change does not spam history).
 *
 * REPLACE-on-leaving-the-report-flow: the report success CTAs ("View my report", "Back to map") leave the
 * in-progress "drop" flow via the store's `reset()` (+ `push`), so the nav transitions OUT of `/report`.
 * If that left `/report` underneath the new entry, a browser/OS Back from the report detail would popstate
 * back INTO the (now-finished, empty) wizard. So when the bar currently shows `/report` and we are moving
 * away from it, REPLACE that history entry instead of pushing - the `/report` URL is overwritten, so Back
 * from `/pin/<id>` lands on `/` (home). This is a general rule (any departure from the flow replaces it),
 * not a per-CTA special case, and never fires on normal navigation (map pin -> detail -> back), where the
 * bar is never on `/report` when the next entry is pushed.
 */
function syncUrl(path: string): void {
  if (typeof window === "undefined") return
  const current = window.location.pathname.replace(/\/$/, "") || "/"
  const next = path.replace(/\/$/, "") || "/"
  if (current === next) return
  if (current === REPORT_FLOW_PATH) {
    window.history.replaceState(window.history.state, "", path)
    return
  }
  window.history.pushState(window.history.state, "", path)
}

export function useWebNavAdapter(): void {
  // (a) Seed once on mount from the live URL. Done in a LAYOUT effect (not useEffect) so the store is
  // seeded BEFORE the first paint of the shell - otherwise a deep link would flash the map-only home for
  // one frame before the panel opens. Safe with no SSR guard: this hook only runs inside HomeShell,
  // which is mounted via dynamic(ssr:false), so useLayoutEffect never fires during the static export.
  React.useLayoutEffect(() => {
    seedStoreFromPath(seedPathname())
    // Mount-only: subsequent changes flow through the subscription below / popstate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // (b) Reflect the nav state in the address bar. Subscribe to the store and push the canonical path
  // whenever it changes (an active detail, or a compact list `view`). We compare against the live
  // pathname inside syncUrl so a re-seed from popstate is a no-op (no duplicate history entry).
  React.useEffect(() => {
    const unsub = useNavStore.subscribe((state) => {
      syncUrl(pathForState(state))
    })
    return unsub
  }, [])

  // (c) Browser Back/Forward: re-seed the store from the new path so the address bar and the visible
  // panel stay in sync. Popping a pushState entry lands on the matching panel (or home).
  React.useEffect(() => {
    const onPop = () => seedStoreFromPath(window.location.pathname)
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  // (d) Move focus to the active panel's heading on route change (WCAG 2.4.3). When the store gains a
  // NEW active detail entry, jump keyboard focus to the panel heading the shared shell marks with
  // `data-civfix-panel-heading` (+ tabIndex=-1). requestAnimationFrame defers until after the panel has
  // mounted/rendered. SSR-safe via the window guard (this hook only runs in HomeShell, ssr:false).
  //
  // The subscriber fires on EVERY store change, not only nav changes - the list header's search text
  // lives in the same store (`query`) - so we gate on the active entry actually CHANGING. Without that
  // gate, every search keystroke with a detail panel open would yank focus out of the search input and
  // onto the panel heading, making typing impossible.
  React.useEffect(() => {
    let prevActive = useNavStore.getState().active
    const unsub = useNavStore.subscribe((state) => {
      const active = state.active
      if (active === prevActive) return
      prevActive = active
      if (typeof window === "undefined") return
      if (active) {
        requestAnimationFrame(() => {
          const h = document.querySelector("[data-civfix-panel-heading]")
          if (h instanceof HTMLElement) h.focus()
        })
      }
    })
    return unsub
  }, [])
}
