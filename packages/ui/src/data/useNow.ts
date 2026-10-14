import { useEffect, useState } from "react"

export const NOW_TICK_MS = 60_000

// setTimeout stores its delay as a signed 32-bit int: anything longer fires after ~1 ms instead.
export const MAX_TIMER_DELAY_MS = 2_147_483_647

export interface UseNowOptions {
  boundaryAt?: number | null
}

/**
 * Calls `onReached` once the clock passes `boundaryAt`, however far away it is: a boundary beyond the
 * timer limit is approached in capped steps. Returns the cancel function; a boundary already past arms
 * nothing.
 */
export function armBoundaryTimer(boundaryAt: number, onReached: () => void): () => void {
  let id: ReturnType<typeof setTimeout> | null = null
  const arm = () => {
    const delay = boundaryAt - Date.now()
    if (delay <= 0) {
      id = null
      onReached()
      return
    }
    id = setTimeout(arm, Math.min(delay, MAX_TIMER_DELAY_MS))
  }
  if (boundaryAt - Date.now() > 0) arm()
  return () => {
    if (id !== null) clearTimeout(id)
  }
}

export function useNow(intervalMs: number = NOW_TICK_MS, opts: UseNowOptions = {}): number {
  const boundaryAt = opts.boundaryAt ?? null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (intervalMs <= 0) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  useEffect(() => {
    if (boundaryAt === null) return
    return armBoundaryTimer(boundaryAt, () => setNow(Date.now()))
  }, [boundaryAt])

  return now
}
