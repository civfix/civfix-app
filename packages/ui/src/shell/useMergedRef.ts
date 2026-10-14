import { useCallback, type ForwardedRef, type MutableRefObject } from "react"

export function assignMergedRef<T extends I, I>(
  inner: MutableRefObject<I | null>,
  forwarded: ForwardedRef<T>,
  node: T | null,
): void {
  inner.current = node
  if (typeof forwarded === "function") forwarded(node)
  else if (forwarded) forwarded.current = node
}

export function useMergedRef<T extends I, I>(
  inner: MutableRefObject<I | null>,
  forwarded: ForwardedRef<T>,
): (node: T | null) => void {
  return useCallback((node: T | null) => assignMergedRef(inner, forwarded, node), [inner, forwarded])
}
