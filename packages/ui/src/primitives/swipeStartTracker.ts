export const UNTRACKED_SWIPE_START_X = Number.POSITIVE_INFINITY

export interface SwipeStartTracker {
  noteTouchStart: (pageX: number) => void
  startX: () => number
}

export function createSwipeStartTracker(): SwipeStartTracker {
  let recorded = UNTRACKED_SWIPE_START_X
  return {
    noteTouchStart: (pageX) => {
      recorded = Number.isFinite(pageX) ? pageX : UNTRACKED_SWIPE_START_X
    },
    startX: () => recorded,
  }
}
