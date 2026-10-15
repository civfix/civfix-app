import { useCallback, useEffect, useRef, useState } from "react"
import { useNearbyReports } from "../../data/hooks/reports"
import { useDraftReportStore } from "../../report/draftStore"
import type { NearbyReportRow } from "../linkReportsModel"
import { DUPLICATE_WAIT_MS, duplicateMatches } from "./duplicateModel"

/**
 * Design mock (GH#159): the pins load as soon as the draft has a point, and a press waits for them
 * at most DUPLICATE_WAIT_MS. The checked-point memory in the draft is the engineer's (D8).
 */
export function useDuplicateGate() {
  const lat = useDraftReportStore((s) => s.draft.lat)
  const lng = useDraftReportStore((s) => s.draft.lng)
  const center = lat != null && lng != null ? { lat, lng } : null
  const nearby = useNearbyReports(center)
  const [busy, setBusy] = useState(false)
  const [gate, setGate] = useState<{ rows: NearbyReportRow[]; onNew: () => void } | null>(null)
  const pending = useRef<{ onClear: () => void; timer: ReturnType<typeof setTimeout> } | null>(null)

  const settle = useCallback((rows: NearbyReportRow[]) => {
    const p = pending.current
    if (!p) return
    clearTimeout(p.timer)
    pending.current = null
    setBusy(false)
    if (rows.length > 0) setGate({ rows, onNew: p.onClear })
    else p.onClear()
  }, [])

  const ready = nearby.isSuccess && !nearby.isPlaceholderData && !nearby.isFetching
  useEffect(() => {
    if (!pending.current || !center) return
    if (ready) settle(duplicateMatches(nearby.data ?? [], center))
    else if (nearby.isError) settle([])
  })

  const run = useCallback(
    (onClear: () => void) => {
      if (pending.current) return
      if (!center) {
        onClear()
        return
      }
      const timer = setTimeout(() => settle([]), DUPLICATE_WAIT_MS)
      pending.current = { onClear, timer }
      setBusy(true)
      if (ready) settle(duplicateMatches(nearby.data ?? [], center))
    },
    [center, nearby.data, ready, settle],
  )

  const dismiss = useCallback(() => setGate(null), [])
  const reportNew = useCallback(() => {
    const onNew = gate?.onNew
    setGate(null)
    onNew?.()
  }, [gate])

  useEffect(() => () => {
    if (pending.current) clearTimeout(pending.current.timer)
  }, [])

  return { busy, matches: gate?.rows ?? null, run, dismiss, reportNew }
}
