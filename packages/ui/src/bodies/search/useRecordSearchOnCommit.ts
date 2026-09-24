import { useEffect, useRef } from "react"
import { useNavStore } from "../../nav"
import {
  discardSearchInput,
  pendingSearchInput,
  searchRecentCommit,
  trackSearchInput,
  useSearchRecentStore,
} from "../searchRecentStore"

export function commitSearchRecent(query: string): void {
  const value = searchRecentCommit(query)
  if (value) useSearchRecentStore.getState().record(value)
}

export function useRecordSearchOnCommit(query: string, pinned: boolean): void {
  useEffect(() => {
    trackSearchInput(query)
  }, [query])

  const lastCommittedRef = useRef<string | null>(null)

  const commitRef = useRef<(value: string) => void>(() => {})
  commitRef.current = (value: string) => {
    const normalized = searchRecentCommit(value)
    if (!normalized || normalized === lastCommittedRef.current) return
    lastCommittedRef.current = normalized
    commitSearchRecent(normalized)
  }

  const wasPinnedRef = useRef(pinned)
  useEffect(() => {
    const unpinned = wasPinnedRef.current && !pinned
    wasPinnedRef.current = pinned
    if (unpinned) commitRef.current(pendingSearchInput())
  }, [pinned])

  useEffect(
    () =>
      useNavStore.subscribe((state, prev) => {
        if (state.stack.length > prev.stack.length) commitRef.current(prev.query)
      }),
    [],
  )

  useEffect(() => () => discardSearchInput(), [])
}
