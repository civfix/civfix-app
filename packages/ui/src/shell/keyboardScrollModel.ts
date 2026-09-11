import { KEYBOARD_REVEAL_MARGIN, scrollKeyboardReserve } from "./keyboardInsetModel"

export interface ScrollKeyboardState {
  scope: string
  focusedScope: string | null
  overlap: number
  reserve: number
  holding: boolean
  revealVersion: number
}

export type ScrollKeyboardSignal =
  | { type: "focus"; scope: string | null; version: number }
  | { type: "show"; overlap: number; reserves: boolean }
  | { type: "hide" }
  | { type: "hold-expired" }
  | { type: "content-grew" }

export function initialScrollKeyboardState(scope: string): ScrollKeyboardState {
  return { scope, focusedScope: null, overlap: 0, reserve: 0, holding: false, revealVersion: 0 }
}

export function reduceScrollKeyboard(
  state: ScrollKeyboardState,
  signal: ScrollKeyboardSignal,
): ScrollKeyboardState {
  switch (signal.type) {
    case "focus": {
      const owned = signal.scope !== null && signal.scope === state.scope
      if (owned) {
        return {
          ...state,
          focusedScope: signal.scope,
          revealVersion: state.overlap > 0 ? state.revealVersion + 1 : state.revealVersion,
        }
      }
      if (signal.scope === null) return { ...state, focusedScope: null }
      return { ...state, focusedScope: signal.scope, reserve: 0, holding: false }
    }
    case "show": {
      const owned = state.focusedScope !== null && state.focusedScope === state.scope
      if (!owned) {
        return { ...state, overlap: signal.overlap, reserve: 0, holding: false }
      }
      return {
        ...state,
        overlap: signal.overlap,
        holding: false,
        reserve: signal.reserves ? scrollKeyboardReserve(signal.overlap, KEYBOARD_REVEAL_MARGIN) : 0,
        revealVersion: state.revealVersion + 1,
      }
    }
    case "hide":
      if (state.reserve <= 0) return { ...state, overlap: 0, holding: false }
      return { ...state, overlap: 0, holding: true }
    case "hold-expired":
      if (!state.holding) return state
      return { ...state, holding: false, reserve: 0 }
    case "content-grew": {
      const owned = state.focusedScope !== null && state.focusedScope === state.scope
      if (!owned || state.overlap <= 0) return state
      return { ...state, revealVersion: state.revealVersion + 1 }
    }
  }
}
