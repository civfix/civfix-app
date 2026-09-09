export interface PollInteractivitySignals {
  closed: boolean
  disabled: boolean
  myVote: readonly number[]
}

export interface PollInteractivity {
  showResults: boolean
  votable: boolean
  inert: boolean
}

export function pollInteractivity(signals: PollInteractivitySignals): PollInteractivity {
  const showResults = signals.myVote.length > 0 || signals.closed
  const votable = !signals.closed && !signals.disabled
  return { showResults, votable, inert: !showResults && !votable }
}

export function reconcilePollSelection(prev: Set<number>, myVote: readonly number[]): Set<number> {
  if (myVote.length === 0) return prev
  if (prev.size === myVote.length && myVote.every((idx) => prev.has(idx))) return prev
  return new Set(myVote)
}
