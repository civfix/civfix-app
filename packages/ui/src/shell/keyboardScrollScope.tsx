import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react"
import {
  makeKeyboardHostReserveStore,
  type KeyboardHostReserveStore,
} from "./keyboardHostReserveStore"

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

const KeyboardHostReserveScopeContext = createContext<KeyboardHostReserveStore | null>(null)
KeyboardHostReserveScopeContext.displayName = "KeyboardHostReserveScopeContext"

export interface KeyboardHostReserveScopeProps {
  children: React.ReactNode
}

export function KeyboardHostReserveScope({ children }: KeyboardHostReserveScopeProps) {
  const [store] = useState(makeKeyboardHostReserveStore)
  return (
    <KeyboardHostReserveScopeContext.Provider value={store}>
      {children}
    </KeyboardHostReserveScopeContext.Provider>
  )
}

export function useKeyboardHostReserveScope(): KeyboardHostReserveStore | null {
  return useContext(KeyboardHostReserveScopeContext)
}

function useRequiredKeyboardHostReserveScope(): KeyboardHostReserveStore {
  const store = useKeyboardHostReserveScope()
  if (store === null) {
    throw new Error(
      "KeyboardPinnedFooter: no KeyboardPinnedSurface found. Wrap the scrollers and the pinned " +
        "footer in <KeyboardPinnedSurface> so they share one reservation of the keyboard overlap.",
    )
  }
  return store
}

export function useKeyboardHostReserveClaim(active: boolean): void {
  const store = useRequiredKeyboardHostReserveScope()
  useEffect(() => {
    if (!active) return
    return store.claim()
  }, [active, store])
}

const unscopedSubscribe = (): (() => void) => () => {}
const unscopedState = (): boolean => false

export function useKeyboardHostReserved(): boolean {
  const store = useKeyboardHostReserveScope()
  const subscribe = store ? store.subscribe : unscopedSubscribe
  const getState = store ? store.getState : unscopedState
  return useSyncExternalStore(subscribe, getState, getState)
}
