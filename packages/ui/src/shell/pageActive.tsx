/**
 * "Am I the page the user is actually looking at?" - the one signal a RETAINED page layer needs.
 *
 * THE PROBLEM IT SOLVES. `shell/PageStack` (both seams) keeps every page on the stack MOUNTED so a pop can
 * reveal its parent instead of rebuilding it (see `fullEntryStack`). A mounted body runs its effects, so
 * any body that writes a PROCESS-GLOBAL store from a mount effect now writes it on behalf of a screen that
 * is buried two layers down - and its unmount/cleanup writes on behalf of one that is already gone. The
 * live case is the map: `ReportDetailBody`/`EventDetailBody` publish `useMapFocus` on mount, so without
 * this an under-page would fight the top page for the map's single focused entity, and the retained
 * parent's cleanup would wipe the focus its child had just set.
 *
 * THE CONTRACT. A body that writes a global on mount gates the write on `usePageIsActive()` and releases
 * it with an id-scoped clear (`useMapFocus.clearFor(id)`), never an unconditional one. Both halves are
 * needed: the gate stops an inactive page ASSERTING, and the scoped release stops a departing page
 * CLEARING what the surviving page owns. Re-activation is automatic - `isActive` is an effect dependency,
 * so a page returning to the top re-asserts its focus on the pop.
 *
 * DEFAULT TRUE, deliberately. Every other host in this repo mounts exactly one body at a time (the compact
 * sheet, the expanded panel, the /bodies gallery, a unit test), and for all of them "the body I mounted is
 * the active one" is simply correct. So only the two PageStack seams (and the retained tab slots) provide
 * a value, and nothing else in the tree changes behaviour by a byte.
 *
 * React + no RN: shared bodies import this module DIRECTLY (`../shell/pageActive`, the ScrollHost
 * pattern) rather than through the shell barrel, which would close an import cycle through BodyRouter.
 */
import React, { createContext, useContext } from "react"

const PageActiveContext = createContext<boolean>(true)
PageActiveContext.displayName = "PageActiveContext"

export interface PageActiveProviderProps {
  /** Is the page layer this wraps the TOP of the stack (and not a retained leaving layer)? */
  value: boolean
  children: React.ReactNode
}

/** Declare whether everything rendered inside is the page the user is looking at. */
export function PageActiveProvider({ value, children }: PageActiveProviderProps) {
  return <PageActiveContext.Provider value={value}>{children}</PageActiveContext.Provider>
}

/**
 * Is this body the ACTIVE page? True with no provider mounted (every single-body host - see the module
 * doc), so a body may read it unconditionally.
 */
export function usePageIsActive(): boolean {
  return useContext(PageActiveContext)
}
