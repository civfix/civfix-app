import { useCallback, useMemo, useState } from "react"
import { useToast } from "../../../primitives"
import {
  rosterRows,
  useCheckInEventSeat,
  useHostRoster,
  useUndoEventCheckIn,
} from "../../../data/hooks/host"
import { useDebouncedValue } from "../../../data/hooks/useDebouncedValue"
import { useT } from "../../../i18n"
import { ROSTER_SEARCH_DEBOUNCE_MS } from "../RosterPagedList"
import { rosterMutationErrorKey } from "../rosterFiltersModel"

type UndoCheckIn = ReturnType<typeof useUndoEventCheckIn>

export function useCheckinRoster(id: string, canCheckIn: boolean, undo: UndoCheckIn) {
  const { t: tRoster } = useT("host-common")
  const toast = useToast()
  const [rosterSearch, setRosterSearch] = useState("")
  const [rosterFocused, setRosterFocused] = useState(false)
  const rosterQuery = useDebouncedValue(rosterSearch, ROSTER_SEARCH_DEBOUNCE_MS)
  const roster = useHostRoster(id, {
    filter: "not_checked_in",
    q: rosterQuery,
    enabled: canCheckIn,
  })
  const waiting = useMemo(() => rosterRows(roster.data?.pages), [roster.data?.pages])
  const checkIn = useCheckInEventSeat(id)
  const onRosterCheckIn = useCallback(
    (seatId: string) => {
      checkIn.mutate(
        { seatId },
        { onError: (err) => toast.show(tRoster(rosterMutationErrorKey(err)), { variant: "error" }) },
      )
    },
    [checkIn, tRoster, toast],
  )
  const onRosterUndo = useCallback(
    (seatId: string) => {
      undo.mutate(
        { seatId },
        { onError: (err) => toast.show(tRoster(rosterMutationErrorKey(err)), { variant: "error" }) },
      )
    },
    [tRoster, toast, undo],
  )
  return {
    rosterSearch,
    setRosterSearch,
    rosterFocused,
    setRosterFocused,
    roster,
    waiting,
    pending: checkIn.isPending || undo.isPending,
    onRosterCheckIn,
    onRosterUndo,
  }
}
