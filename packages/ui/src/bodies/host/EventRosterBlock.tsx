import React, { useCallback, useMemo, useState } from "react"
import { View } from "react-native"
import type { EventSlotDTO, RegistrationRosterFilter } from "@civfix/shared"
import { makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import { FilterChip, useToast } from "../../primitives"
import { useT } from "../../i18n"
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../data/hooks/useDebouncedValue"
import {
  rosterRows,
  useCheckInEventSeat,
  useHostRoster,
  useUndoEventCheckIn,
} from "../../data/hooks/host"
import { useCleanup } from "../../data"
import { RosterPagedList, RosterSearchField } from "./RosterPagedList"
import { rosterMutationErrorKey, visibleRosterFilters } from "./rosterFiltersModel"

const NO_SLOTS: readonly EventSlotDTO[] = []

export interface EventRosterBlockProps {
  cleanupId: string
  canCheckIn?: boolean
  enabled?: boolean
}

export function EventRosterBlock({ cleanupId, canCheckIn = false, enabled = true }: EventRosterBlockProps) {
  const styles = useStyles()
  const { t } = useT("host-common")
  const toast = useToast()

  const [filter, setFilter] = useState<RegistrationRosterFilter>("all")
  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const q = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  const roster = useHostRoster(cleanupId, { filter, q, enabled })
  const rows = useMemo(() => rosterRows(roster.data?.pages), [roster.data?.pages])
  const cleanup = useCleanup(cleanupId)
  const slots = cleanup.data?.slots ?? NO_SLOTS
  const filters = visibleRosterFilters((cleanup.data?.ticketTypes.length ?? 0) > 0)

  const checkIn = useCheckInEventSeat(cleanupId)
  const undo = useUndoEventCheckIn(cleanupId)
  const pending = checkIn.isPending || undo.isPending

  const onError = useCallback(
    (err: unknown) => {
      toast.show(t(rosterMutationErrorKey(err)), { variant: "error" })
    },
    [t, toast],
  )

  const onCheckIn = useCallback(
    (seatId: string) => checkIn.mutate({ seatId }, { onError }),
    [checkIn, onError],
  )
  const onUndo = useCallback(
    (seatId: string) => undo.mutate({ seatId }, { onError }),
    [onError, undo],
  )

  return (
    <View style={styles.block}>
      <RosterSearchField
        value={search}
        onChangeText={setSearch}
        placeholder={t("roster.search_placeholder")}
        accessibilityLabel={t("roster.search_a11y")}
        focused={searchFocused}
        onFocusChange={setSearchFocused}
      />

      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t("roster.filter_a11y")}>
        {filters.map((value) => (
          <FilterChip
            key={value}
            label={t(`roster.filter.${value}`)}
            selected={value === filter}
            onPress={() => setFilter(value)}
          />
        ))}
      </View>

      {roster.isLoading ? (
        <Text style={styles.state}>{t("roster.loading")}</Text>
      ) : roster.isError ? (
        <Text style={styles.state} accessibilityRole="alert">
          {t("roster.error")}
        </Text>
      ) : rows.length === 0 ? (
        <Text style={styles.state}>{t("roster.empty")}</Text>
      ) : (
        <RosterPagedList
          rows={rows}
          slots={slots}
          timeZone={cleanup.data?.timezone ?? undefined}
          canCheckIn={canCheckIn}
          pending={pending}
          onCheckIn={onCheckIn}
          onUndo={onUndo}
          paging={roster}
        />
      )}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  block: {
    gap: t.space["3"],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
  },
  state: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
    paddingVertical: t.space["2"],
  },
}))
