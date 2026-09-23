"use client"

import { useCallback, useSyncExternalStore } from "react"

export const CONSOLE_NARROW_QUERY = "(max-width: 767px)"
export const CONSOLE_ICON_RAIL_QUERY = "(min-width: 768px) and (max-width: 1023px)"
export const CONSOLE_FULL_RAIL_QUERY = "(min-width: 1024px)"
export const CONSOLE_DRAWER_SHRINK_QUERY = "(min-width: 1440px)"

function canMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
}

function serverSnapshot(): boolean {
  return false
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!canMatchMedia()) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    [query],
  )
  const snapshot = useCallback(
    () => (canMatchMedia() ? window.matchMedia(query).matches : false),
    [query],
  )
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}

export function useIsNarrow(): boolean {
  return useMediaQuery(CONSOLE_NARROW_QUERY)
}

export type ConsoleRailMode = "bottom-tabs" | "icon" | "full"

export function useConsoleRailMode(): ConsoleRailMode {
  const narrow = useMediaQuery(CONSOLE_NARROW_QUERY)
  const full = useMediaQuery(CONSOLE_FULL_RAIL_QUERY)
  if (narrow) return "bottom-tabs"
  return full ? "full" : "icon"
}
