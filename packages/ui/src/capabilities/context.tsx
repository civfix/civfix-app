/**
 * React context that carries the host-injected PlatformCapabilities bundle to shared components.
 * A host (mobile app, web app, or a test/Storybook harness with fakes) wraps its tree in
 * <CapabilitiesProvider value={...}> once at the root; shared components read it via the typed hooks
 * in `./hooks` (which build on `useCapabilities` here).
 */
import React, { createContext, useContext } from "react"
import type { PlatformCapabilities } from "./types"

const CapabilitiesContext = createContext<PlatformCapabilities | null>(null)
CapabilitiesContext.displayName = "CapabilitiesContext"

export interface CapabilitiesProviderProps {
  /** The platform capability bundle for this host (native impls, web impls, or fakes). */
  value: PlatformCapabilities
  children: React.ReactNode
}

export function CapabilitiesProvider({ value, children }: CapabilitiesProviderProps) {
  return <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>
}

/**
 * Access the full capability bundle. Throws a clear error if no provider is mounted, so a missing
 * root wrapper fails loudly instead of silently handing back undefined.
 */
export function useCapabilities(): PlatformCapabilities {
  const ctx = useContext(CapabilitiesContext)
  if (ctx === null) {
    throw new Error(
      "useCapabilities: no CapabilitiesProvider found. Wrap your app root in " +
        "<CapabilitiesProvider value={...}> (use makeFakeCapabilities() in tests).",
    )
  }
  return ctx
}
