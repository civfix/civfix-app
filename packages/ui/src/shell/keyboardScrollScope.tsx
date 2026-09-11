import React, { createContext, useContext } from "react"

const KeyboardScrollScopeContext = createContext<string | null>(null)
KeyboardScrollScopeContext.displayName = "KeyboardScrollScopeContext"

export interface KeyboardScrollScopeProviderProps {
  value: string | null
  children: React.ReactNode
}

export function KeyboardScrollScopeProvider({ value, children }: KeyboardScrollScopeProviderProps) {
  return (
    <KeyboardScrollScopeContext.Provider value={value}>{children}</KeyboardScrollScopeContext.Provider>
  )
}

export function useKeyboardScrollScope(): string | null {
  return useContext(KeyboardScrollScopeContext)
}
