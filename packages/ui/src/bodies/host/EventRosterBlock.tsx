import React, { useCallback, useMemo, useState } from "react"
import { View } from "react-native"
import { TextInput } from "../../primitives/TextInput"
import type { EventSlotDTO, RegistrationRosterFilter } from "@civfix/shared"
import { makeThemedStyles, useTheme, webInputReset } from "../../theme"
import { Text, TextLink } from "../../typography"
import { FilterChip, fieldFocusedStyle, useToast } from "../../primitives"
import { useT } from "../../i18n"
import { useDebouncedValue } from "../../data/hooks/useDebouncedValue"
import {
  rosterRows,
  useCheckInEventSeat,
  useHostRoster,
  useUndoEventCheckIn,
} from "../../data/hooks/host"
import { useCleanup } from "../../data"
import { RosterCheckinList } from "./RosterCheckinList"
import { rosterMutationErrorKey, visibleRosterFilters } from "./rosterFiltersModel"

const NO_SLOTS: readonly EventSlotDTO[] = []

export interface EventRosterBlockProps {
  cleanupId: string
  canCheckIn?: boolean
  enabled?: boolean
}

export function EventRosterBlock({ cleanupId, canCheckIn = false, enabled = true }: EventRosterBlockProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-common")
  const toast = useToast()

  const [filter, setFilter] = useState<RegistrationRosterFilter>("all")
  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const q = useDebouncedValue(search, 250)

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

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = roster
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  return (
    <View style={styles.block}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t("roster.search_placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        accessibilityLabel={t("roster.search_a11y")}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
        style={[webInputReset, styles.search, searchFocused ? fieldFocusedStyle(th) : null]}
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
        <View>
          <RosterCheckinList
            rows={rows}
            slots={slots}
            timeZone={cleanup.data?.timezone ?? undefined}
            canCheckIn={canCheckIn}
            pending={pending}
            onCheckIn={onCheckIn}
            onUndo={onUndo}
          />
          {hasNextPage ? (
            <View style={styles.more}>
              <TextLink
                variant="label"
                standalone
                disabled={isFetchingNextPage}
                onPress={loadMore}
                accessibilityLabel={t("roster.load_more_a11y")}
              >
                {isFetchingNextPage ? t("roster.loading_more") : t("roster.load_more")}
              </TextLink>
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  block: {
    gap: t.space["3"],
  },
  search: {
    minHeight: 42,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
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
  more: {
    alignSelf: "flex-start",
    paddingVertical: t.space["2"],
  },
}))
