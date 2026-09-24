import React, { useCallback, useMemo, useState } from "react"
import { View } from "react-native"
import type { CleanupDTO } from "@civfix/shared"
import { headingLevel, makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import { useToast } from "../../primitives"
import {
  rosterRows,
  useCheckInEventSeat,
  useHostRoster,
  useUndoEventCheckIn,
} from "../../data/hooks/host"
import { useDebouncedValue } from "../../data/hooks/useDebouncedValue"
import { useT } from "../../i18n"
import { FeedNotice } from "../FeedNotice"
import { ROSTER_SEARCH_DEBOUNCE_MS, RosterPagedList, RosterSearchField } from "./RosterPagedList"

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
        { onError: () => toast.show(tRoster("roster.error"), { variant: "error" }) },
      )
    },
    [checkIn, tRoster, toast],
  )
  const onRosterUndo = useCallback(
    (seatId: string) => {
      undo.mutate(
        { seatId },
        { onError: () => toast.show(tRoster("roster.error"), { variant: "error" }) },
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

export function CheckinRosterSection({
  cleanup,
  rosterState,
}: {
  cleanup: CleanupDTO
  rosterState: ReturnType<typeof useCheckinRoster>
}) {
  const styles = useStyles()
  const { t } = useT("host-checkin")
  const { t: tRoster } = useT("host-common")
  const { roster, waiting } = rosterState
  return (
    <View style={styles.roster}>
      <Text style={styles.rosterTitle} accessibilityRole="header" {...headingLevel(2)}>
        {t("roster.title")}
      </Text>
      <RosterSearchField
        value={rosterState.rosterSearch}
        onChangeText={rosterState.setRosterSearch}
        placeholder={t("roster.search")}
        accessibilityLabel={t("roster.search")}
        focused={rosterState.rosterFocused}
        onFocusChange={rosterState.setRosterFocused}
      />
      {roster.isLoading ? (
        <Text style={styles.muted}>{tRoster("roster.loading")}</Text>
      ) : roster.isError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {tRoster("roster.error")}
        </Text>
      ) : waiting.length === 0 ? (
        <FeedNotice plain icon="UserCheck" title={t("roster.empty_title")} body={t("roster.empty_body")} />
      ) : (
        <RosterPagedList
          rows={waiting}
          slots={cleanup.slots}
          timeZone={cleanup.timezone ?? undefined}
          canCheckIn
          pending={rosterState.pending}
          onCheckIn={rosterState.onRosterCheckIn}
          onUndo={rosterState.onRosterUndo}
          paging={roster}
        />
      )}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  roster: {
    gap: t.space["2"],
  },
  rosterTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
  muted: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.dangerInk,
  },
}))
