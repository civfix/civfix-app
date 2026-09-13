import { useEffect, useState } from "react"

export const NOW_TICK_MS = 60_000

export interface UseNowOptions {
  boundaryAt?: number | null
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
    const delay = boundaryAt - Date.now()
    if (delay <= 0) return
    const id = setTimeout(() => setNow(Date.now()), delay)
    return () => clearTimeout(id)
  }, [boundaryAt])

  return now
}
