"use client"

import * as React from "react"

/**
 * Debounce a fast-changing value (the search box text) so we do not refetch on every keystroke.
 * Returns the latest value after it has been stable for `delayMs`.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}
