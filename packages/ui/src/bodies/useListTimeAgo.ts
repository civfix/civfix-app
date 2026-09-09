import { useCallback, useSyncExternalStore } from "react"
import { useLocale, useRelativeTime } from "../i18n"
import { listTimeAgo } from "./relativeTime"

export const LIST_TIME_TICK_MS = 60_000

const tickListeners = new Set<() => void>()
let tickTimer: ReturnType<typeof setInterval> | null = null
let tickAt = Date.now()

function subscribeTick(listener: () => void): () => void {
  tickListeners.add(listener)
  if (tickTimer === null) {
    tickAt = Date.now()
    tickTimer = setInterval(() => {
      tickAt = Date.now()
      for (const notify of [...tickListeners]) notify()
    }, LIST_TIME_TICK_MS)
  }
  return () => {
    tickListeners.delete(listener)
    if (tickListeners.size === 0 && tickTimer !== null) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }
}

const readTick = (): number => tickAt

export function useListTimeTick(): number {
  return useSyncExternalStore(subscribeTick, readTick, readTick)
}

export function useListTimeAgo(): (iso: string) => string {
  const { justNow, units } = useRelativeTime()
  const { locale } = useLocale()
  return useCallback(
    (iso: string) => listTimeAgo(iso, { justNow, units, locale }),
    [justNow, units, locale],
  )
}

export function useTickingListTimeAgo(): (iso: string) => string {
  const format = useListTimeAgo()
  const tick = useListTimeTick()
  return useCallback((iso: string) => format(iso), [format, tick])
}
