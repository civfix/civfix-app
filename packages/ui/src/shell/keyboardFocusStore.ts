import { createListenerSet } from "./listenerSet"

export interface KeyboardFocusNode {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void
}

export interface KeyboardFocusState {
  node: KeyboardFocusNode | null
  revealNode: KeyboardFocusNode | null
  scope: string | null
  version: number
}

let state: KeyboardFocusState = { node: null, revealNode: null, scope: null, version: 0 }
const listeners = createListenerSet()

function publish(next: KeyboardFocusState): void {
  state = next
  listeners.notify()
}

export const keyboardFocusStore = {
  getState: (): KeyboardFocusState => state,
  subscribe: listeners.subscribe,
  setFocused: (
    node: KeyboardFocusNode | null,
    scope: string | null,
    revealNode: KeyboardFocusNode | null = null,
  ): void => {
    if (!node) return
    publish({ node, revealNode, scope, version: state.version + 1 })
  },
  clearFocused: (node: KeyboardFocusNode | null): void => {
    if (!node || state.node !== node) return
    publish({ node: null, revealNode: null, scope: null, version: state.version + 1 })
  },
  bump: (): void => {
    if (!state.node) return
    publish({ ...state, version: state.version + 1 })
  },
  reset: (): void => {
    publish({ node: null, revealNode: null, scope: null, version: 0 })
  },
}
