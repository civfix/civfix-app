export interface KeyboardHostReserveStore {
  getState: () => boolean
  subscribe: (listener: () => void) => () => void
  claim: () => () => void
}

export function makeKeyboardHostReserveStore(): KeyboardHostReserveStore {
  let claims = 0
  const listeners = new Set<() => void>()

  const publish = (): void => {
    for (const listener of [...listeners]) listener()
  }

  return {
    getState: () => claims > 0,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    claim: () => {
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
  }
}
