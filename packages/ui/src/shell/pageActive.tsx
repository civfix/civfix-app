/**
 * Whether a body is the page the user is looking at: the one signal a retained page layer needs.
 *
 * PageStack keeps every page on the stack mounted so a pop reveals its parent instead of rebuilding it, so
 * a body that writes a process-global store from a mount effect writes it on behalf of a buried screen,
 * and its cleanup writes on behalf of one that is gone. For the map focus (`useMapFocus`), an under-page
 * would fight the top page for the single focused entity and a retained parent's cleanup would wipe the
 * focus its child just set.
 *
 * A body that writes a global on mount gates the write on `usePageIsActive()` and releases it with an
 * id-scoped clear (`useMapFocus.clearFor(id)`), never an unconditional one: the gate stops an inactive page
 * asserting, the scoped release stops a departing page clearing what the surviving page owns. Include
 * `isActive` in the effect deps so a page revealed by a pop re-asserts its focus.
 *
 * Defaults to true because every other host mounts exactly one body at a time. Shared bodies import this
 * module directly rather than through the shell barrel, which would close an import cycle via BodyRouter.
 */
import React, { createContext, useContext } from "react"

const PageActiveContext = createContext<boolean>(true)
PageActiveContext.displayName = "PageActiveContext"

export interface PageActiveProviderProps {
  value: boolean
  children: React.ReactNode
}

export function PageActiveProvider({ value, children }: PageActiveProviderProps) {
  return <PageActiveContext.Provider value={value}>{children}</PageActiveContext.Provider>
}

export function usePageIsActive(): boolean {
  return useContext(PageActiveContext)
}
