import { createListenerSet } from "./listenerSet"

export interface KeyboardHostReserveStore {
  getState: () => boolean
  subscribe: (listener: () => void) => () => void
  claim: () => () => void
}

export function makeKeyboardHostReserveStore(): KeyboardHostReserveStore {
  let claims = 0
  const listeners = createListenerSet()

  return {
    getState: () => claims > 0,
    subscribe: listeners.subscribe,
    claim: () => {
      claims += 1
      listeners.notify()
      let released = false
      return () => {
        if (released) return
        released = true
        claims -= 1
        listeners.notify()
      }
    },
  }
}
