import { useCallback, useMemo, useRef, useState } from "react"
import { MAX_LINKED_REPORTS } from "@civfix/shared"
import { useHaptics } from "../../capabilities"
import { announce } from "../../announce"
import { useT } from "../../i18n"
import { pickerAction, selectionDiff, togglePickerId, type PickerMode } from "./reportPickerModel"

export function usePickerSelection({
  value,
  mode,
  busy,
  onCommit,
  onClose,
}: {
  value: readonly string[]
  mode: PickerMode
  busy: boolean
  onCommit: (ids: string[]) => void
  onClose: () => void
}) {
  const { t } = useT("report-picker")
  const { t: tForm } = useT("event-form")
  const haptics = useHaptics()
  const baselineRef = useRef<readonly string[]>(value)
  const linkedSet = useMemo(() => new Set(baselineRef.current), [])
  const [ids, setIds] = useState<string[]>(() => [...baselineRef.current])
  const idSet = useMemo(() => new Set(ids), [ids])

  const diff = useMemo(() => selectionDiff(ids, linkedSet), [ids, linkedSet])
  const action = pickerAction(mode, diff, busy)
  const atLimit = ids.length >= MAX_LINKED_REPORTS

  const toggle = useCallback(
    (id: string, title: string) => {
      const next = togglePickerId(ids, id)
      if (next.outcome === "at_limit") {
        announce(t("limit_reached", { max: MAX_LINKED_REPORTS }), { priority: "assertive" })
        return
      }
      haptics.selection()
      setIds(next.ids)
      announce(
        tForm(
          next.outcome === "added"
            ? "linkedReports.added_announce"
            : "linkedReports.removed_announce",
          { title },
        ),
      )
    },
    [haptics, ids, t, tForm],
  )

  const clear = useCallback(() => setIds([]), [])

  const commit = useCallback(() => {
    if (busy) return
    if (diff.dirty) onCommit(ids)
    else onClose()
  }, [busy, diff.dirty, ids, onClose, onCommit])

  return { idSet, linkedSet, diff, action, atLimit, toggle, clear, commit }
}
