"use client"

import { useEffect, useState } from "react"

export const CONSOLE_SEARCH_DEBOUNCE_MS = 300

export function useDebouncedValue<T>(value: T, delayMs = CONSOLE_SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    if (value === debounced) return
    const handle = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(handle)
  }, [value, delayMs, debounced])

  return debounced
}
