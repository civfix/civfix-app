import React, { createContext, useContext } from "react"
import type { PlatformCapabilities } from "./types"

const CapabilitiesContext = createContext<PlatformCapabilities | null>(null)
CapabilitiesContext.displayName = "CapabilitiesContext"

export interface CapabilitiesProviderProps {
  value: PlatformCapabilities
  children: React.ReactNode
}

export function CapabilitiesProvider({ value, children }: CapabilitiesProviderProps) {
  return <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>
}

/** Throws rather than returning undefined, so a missing root provider fails loudly. */
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
