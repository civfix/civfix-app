import { useEffect, useState } from "react"

export const SEARCH_DEBOUNCE_MS = 250

export function armDebounce<T>(value: T, delay: number, commit: (value: T) => void): () => void {
  const handle = setTimeout(() => commit(value), delay)
  return () => clearTimeout(handle)
}

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => armDebounce(value, delay, setDebounced), [value, delay])
  return debounced
}
