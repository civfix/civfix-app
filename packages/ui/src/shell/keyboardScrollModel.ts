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
  | {
      type: "focus"
      scope: string | null
      focused: boolean
      overlap: number
      reserves: boolean
      hostReserved: boolean
    }
  | { type: "show"; overlap: number; reserves: boolean; hostReserved: boolean }
  | { type: "hide" }
  | { type: "hold-expired" }
  | { type: "content-grew" }

export function initialScrollKeyboardState(scope: string): ScrollKeyboardState {
  return { scope, focusedScope: null, overlap: 0, reserve: 0, holding: false, revealVersion: 0 }
}

function engage(
  state: ScrollKeyboardState,
  scope: string,
  overlap: number,
  reserves: boolean,
  hostReserved: boolean,
): ScrollKeyboardState {
  return {
    ...state,
    focusedScope: scope,
    overlap,
    holding: false,
    reserve: reserves ? scrollKeyboardReserve(overlap, KEYBOARD_REVEAL_MARGIN, hostReserved) : 0,
    revealVersion: overlap > 0 ? state.revealVersion + 1 : state.revealVersion,
  }
}

export function reduceScrollKeyboard(
  state: ScrollKeyboardState,
  signal: ScrollKeyboardSignal,
): ScrollKeyboardState {
  switch (signal.type) {
    case "focus": {
      if (signal.scope !== null && signal.scope === state.scope) {
        const overlap = signal.overlap > 0 ? signal.overlap : state.overlap
        const next = engage(state, signal.scope, overlap, signal.reserves, signal.hostReserved)
        if (
          overlap <= 0 &&
          state.focusedScope === next.focusedScope &&
          state.overlap === next.overlap &&
          state.reserve === next.reserve &&
          state.holding === next.holding
        ) {
          return state
        }
        return next
      }
      if (!signal.focused) {
        return state.focusedScope === null ? state : { ...state, focusedScope: null }
      }
      if (state.focusedScope === null && state.reserve === 0 && !state.holding) return state
      return { ...state, focusedScope: null, reserve: 0, holding: false }
    }
    case "show": {
      const owned = state.focusedScope !== null && state.focusedScope === state.scope
      if (!owned) {
        if (state.overlap === signal.overlap && state.reserve === 0 && !state.holding) return state
        return { ...state, overlap: signal.overlap, reserve: 0, holding: false }
      }
      return engage(state, state.scope, signal.overlap, signal.reserves, signal.hostReserved)
    }
    case "hide":
      if (state.reserve <= 0) {
        return state.overlap === 0 && !state.holding ? state : { ...state, overlap: 0, holding: false }
      }
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

export function scrollKeyboardReveals(state: ScrollKeyboardState): boolean {
  return state.revealVersion > 0 && state.overlap > 0 && state.focusedScope === state.scope
}
