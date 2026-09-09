import React, { createContext, useContext } from "react"

const NestedShellHostContext = createContext<boolean>(false)
NestedShellHostContext.displayName = "NestedShellHostContext"

export interface NestedShellHostProviderProps {
  children: React.ReactNode
}

export function NestedShellHostProvider({ children }: NestedShellHostProviderProps) {
  return <NestedShellHostContext.Provider value={true}>{children}</NestedShellHostContext.Provider>
}

export function useNestedShellHost(): boolean {
  return useContext(NestedShellHostContext)
}
