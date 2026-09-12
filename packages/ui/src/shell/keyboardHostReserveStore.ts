import { useSyncExternalStore } from "react"

let claims = 0
const listeners = new Set<() => void>()

function publish(): void {
  for (const listener of [...listeners]) listener()
}

const getState = (): boolean => claims > 0

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const keyboardHostReserveStore = {
  getState,
  subscribe,
  claim: (): (() => void) => {
    claims += 1
    publish()
    let released = false
    return () => {
      if (released) return
      released = true
      claims -= 1
      publish()
    }
  },
  reset: (): void => {
    claims = 0
    publish()
  },
}

export function useKeyboardHostReserved(): boolean {
  return useSyncExternalStore(subscribe, getState, getState)
}
