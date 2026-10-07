export interface ListenerSet {
  subscribe: (listener: () => void) => () => void
  notify: () => void
}

export function createListenerSet(): ListenerSet {
  const listeners = new Set<() => void>()
  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    // Iterates a snapshot, so a listener that subscribes or unsubscribes mid-notify leaves this round intact.
    notify: () => {
      for (const listener of [...listeners]) listener()
    },
  }
}
