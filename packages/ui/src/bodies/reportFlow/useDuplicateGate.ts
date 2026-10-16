import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { create } from "zustand"
import type { LatLng } from "@civfix/contract/geocode"
import { useNearbyReports } from "../../data/hooks/reports"
import { useNavStore } from "../../nav"
import { needsDuplicateCheck, useDraftReportStore } from "../../report/draftStore"
import { pinToCardData } from "../linkedReportCards"
import type { NearbyReportRow } from "../linkReportsModel"
import { usePostComposerStore } from "../postComposerStore"
import { refFromCard } from "../reportPicker/reportPickerModel"
import { DUPLICATE_WAIT_MS, duplicateMatches } from "./duplicateModel"

interface OpenScreen {
  point: LatLng
  rows: NearbyReportRow[]
}

// Outside the body, because opening a match swaps the body out for the report's page on the expanded
// layout, and Back from that page has to land on the screen again.
const useDuplicateScreen = create<{ open: OpenScreen | null }>(() => ({ open: null }))

interface PendingCheck {
  point: LatLng
  onClear: () => void
  timer: ReturnType<typeof setTimeout>
}

const samePoint = (a: LatLng, b: LatLng) => a.lat === b.lat && a.lng === b.lng

export interface DuplicateGate {
  busy: boolean
  /** The open "Possible duplicate" screen's rows, or null when it is not showing. */
  matches: NearbyReportRow[] | null
  /** Checks an unchecked draft point, then calls `onClear` unless a match opens the screen. */
  run: (onClear: () => void) => void
  /** Back: closes the screen, or drops a check still waiting, and keeps the draft. */
  dismiss: () => void
  /** "Report a new problem": closes the screen and carries on where the press was heading. */
  reportNew: () => void
  openMatch: (row: NearbyReportRow) => void
}

/**
 * The duplicate check on the report flow's forward presses (GH#159). The pins start loading as soon as the
 * draft has an unchecked point, so a press usually finds them ready; it waits at most DUPLICATE_WAIT_MS and
 * a failure or a timeout carries on as if nothing matched. Every outcome stores the point as checked.
 *
 * `resume` carries on when the screen outlived the body whose press opened it (Back from a match on the
 * expanded layout), since that press's continuation went with the old body.
 */
export function useDuplicateGate(resume?: () => void): DuplicateGate {
  const lat = useDraftReportStore((s) => s.draft.lat)
  const lng = useDraftReportStore((s) => s.draft.lng)
  const checked = useDraftReportStore((s) => s.draft.duplicateCheckedPoint)
  const needsCheck = useDraftReportStore((s) => needsDuplicateCheck(s.draft))
  const center = useMemo(() => (lat != null && lng != null ? { lat, lng } : null), [lat, lng])
  const nearby = useNearbyReports(needsCheck ? center : null)
  // A previous point's pins stay as placeholder data while this point's pins load.
  const pins = nearby.isSuccess && !nearby.isPlaceholderData && !nearby.isFetching ? nearby.data : null
  const failed = nearby.isError

  const open = useDuplicateScreen((s) => s.open)
  const matches =
    open && center && checked && samePoint(open.point, center) && samePoint(checked, center) ? open.rows : null

  const resetDraft = useDraftReportStore((s) => s.reset)
  const [busy, setBusy] = useState(false)
  const pending = useRef<PendingCheck | null>(null)
  const continuation = useRef<(() => void) | null>(null)

  const cancelPending = useCallback(() => {
    const p = pending.current
    if (!p) return
    clearTimeout(p.timer)
    pending.current = null
    setBusy(false)
  }, [])

  const settle = useCallback((rows: NearbyReportRow[]) => {
    const p = pending.current
    if (!p) return
    clearTimeout(p.timer)
    pending.current = null
    setBusy(false)
    useDraftReportStore.getState().setDuplicateCheckedPoint(p.point)
    if (rows.length > 0) {
      continuation.current = p.onClear
      useDuplicateScreen.setState({ open: { point: p.point, rows } })
      return
    }
    useDuplicateScreen.setState({ open: null })
    p.onClear()
  }, [])

  // The answer for `center`, which is behind the draft when a press lands in the same tick as a new point
  // (the picker's confirm advances at once); that press waits for the render that loads its own point.
  const answer = useCallback(
    (point: LatLng): NearbyReportRow[] | null => {
      if (!center || !samePoint(center, point)) return null
      if (pins) return duplicateMatches(pins, point)
      return failed ? [] : null
    },
    [center, pins, failed],
  )

  // A waiting check follows the draft's point, read from the store because this render's `center` can lag
  // behind it: a point moved while the button spins is the one the press would carry on with, so it is the
  // one to check, within the press's own deadline.
  useEffect(() => {
    const p = pending.current
    if (!p) return
    const draft = useDraftReportStore.getState().draft
    if (draft.lat == null || draft.lng == null) {
      cancelPending()
      return
    }
    p.point = { lat: draft.lat, lng: draft.lng }
    if (!needsDuplicateCheck(draft)) {
      settle([])
      return
    }
    const rows = answer(p.point)
    if (rows) settle(rows)
  }, [answer, settle, cancelPending])

  const run = useCallback(
    (onClear: () => void) => {
      if (pending.current) return
      const draft = useDraftReportStore.getState().draft
      if (!needsDuplicateCheck(draft) || draft.lat == null || draft.lng == null) {
        onClear()
        return
      }
      const point = { lat: draft.lat, lng: draft.lng }
      pending.current = { point, onClear, timer: setTimeout(() => settle([]), DUPLICATE_WAIT_MS) }
      const rows = answer(point)
      if (rows) settle(rows)
      else setBusy(true)
    },
    [answer, settle],
  )

  const dismiss = useCallback(() => {
    cancelPending()
    continuation.current = null
    useDuplicateScreen.setState({ open: null })
  }, [cancelPending])

  const reportNew = useCallback(() => {
    const next = continuation.current ?? resume
    continuation.current = null
    useDuplicateScreen.setState({ open: null })
    next?.()
  }, [resume])

  const openMatch = useCallback((row: NearbyReportRow) => {
    const composer = usePostComposerStore.getState()
    if (composer.claimedCreate !== "report") {
      useNavStore.getState().push({ kind: "pin", id: row.pin.id, lat: row.pin.lat, lng: row.pin.lng })
      return
    }
    // The same hand-back as a report filed from the composer (useReportSubmitFlow): this run ends here.
    composer.setAttachedReport(refFromCard(pinToCardData(row.pin), new Date().toISOString()))
    composer.releaseClaimedCreate("report")
    continuation.current = null
    useDuplicateScreen.setState({ open: null })
    resetDraft()
    useNavStore.getState().finishReportFlow({ kind: "composer" })
  }, [resetDraft])

  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current.timer)
    },
    [],
  )

  return { busy, matches, run, dismiss, reportNew, openMatch }
}
