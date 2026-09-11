export interface KeyboardFocusNode {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void
}

export interface KeyboardFocusState {
  node: KeyboardFocusNode | null
  scope: string | null
  version: number
}

let state: KeyboardFocusState = { node: null, scope: null, version: 0 }
const listeners = new Set<() => void>()

function publish(next: KeyboardFocusState): void {
  state = next
  for (const listener of [...listeners]) listener()
}

export const keyboardFocusStore = {
  getState: (): KeyboardFocusState => state,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  setFocused: (node: KeyboardFocusNode | null, scope: string | null): void => {
    if (!node) return
    publish({ node, scope, version: state.version + 1 })
  },
  clearFocused: (node: KeyboardFocusNode | null): void => {
    if (!node || state.node !== node) return
    publish({ node: null, scope: null, version: state.version + 1 })
  },
  bump: (): void => {
    if (!state.node) return
    publish({ ...state, version: state.version + 1 })
  },
  reset: (): void => {
    publish({ node: null, scope: null, version: 0 })
  },
}
