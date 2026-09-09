"use client"

import { useEffect, useState } from "react"

export const CONSOLE_NARROW_QUERY = "(max-width: 767px)"
export const CONSOLE_ICON_RAIL_QUERY = "(min-width: 768px) and (max-width: 1023px)"
export const CONSOLE_FULL_RAIL_QUERY = "(min-width: 1024px)"
export const CONSOLE_DRAWER_SHRINK_QUERY = "(min-width: 1440px)"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const list = window.matchMedia(query)
    const apply = () => setMatches(list.matches)
    apply()
    list.addEventListener("change", apply)
    return () => list.removeEventListener("change", apply)
  }, [query])

  return matches
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
