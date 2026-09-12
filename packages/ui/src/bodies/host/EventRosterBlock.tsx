import React, { useCallback, useMemo, useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { TextInput } from "../../primitives/TextInput"
import type { EventRegistrationDTO, RegistrationRosterFilter } from "@civfix/shared"
import { DELETED_USER_LABEL } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
  webInputReset,
  webTransition,
} from "../../theme"
import { Text, TextLink, Icon, iconMap } from "../../typography"
import { Avatar, FilterChip, fieldFocusedStyle, useToast } from "../../primitives"
import { useT } from "../../i18n"
import { useDebouncedValue } from "../../data/hooks/useDebouncedValue"
import {
  rosterRows,
  useCheckInEventSeat,
  useHostRoster,
  useUndoEventCheckIn,
} from "../../data/hooks/host"
import { appErrorCode } from "../errorCode"

export const ROSTER_FILTERS: readonly RegistrationRosterFilter[] = [
  "all",
  "not_checked_in",
  "checked_in",
  "waitlisted",
]

export interface EventRosterBlockProps {
  cleanupId: string
  canCheckIn?: boolean
  enabled?: boolean
}

function attendeeName(row: EventRegistrationDTO): string {
  if (row.person?.deleted) return DELETED_USER_LABEL
  return row.person?.name ?? row.guestName ?? ""
}

export function nextCheckinSeat(row: EventRegistrationDTO): string | null {
  const seat = row.seats.find((s) => s.status === "active" && s.checkedInAt == null)
  return seat?.id ?? null
}

export function lastCheckedInSeat(row: EventRegistrationDTO): string | null {
  let best: { id: string; at: string } | null = null
  for (const seat of row.seats) {
    if (seat.status !== "active" || !seat.checkedInAt) continue
    if (!best || seat.checkedInAt > best.at) best = { id: seat.id, at: seat.checkedInAt }
  }
  return best?.id ?? null
}

const RosterRowView = React.memo(function RosterRowView({
  row,
  canCheckIn,
  pending,
  onCheckIn,
  onUndo,
}: {
  row: EventRegistrationDTO
  canCheckIn: boolean
  pending: boolean
  onCheckIn: (seatId: string) => void
  onUndo: (seatId: string) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-common")
  const name = attendeeName(row)
  const checkedIn = row.checkedInAt != null
  const nextSeat = nextCheckinSeat(row)
  const undoSeat = lastCheckedInSeat(row)
  const meta = [
    row.ticketTypeName ?? null,
    row.seatCount > 1 ? t("roster.seats", { count: row.seatCount }) : null,
    row.kind === "guest" ? t("roster.guest") : null,
    row.waitlistPosition != null ? t("roster.waitlist_position", { position: row.waitlistPosition }) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ")

  return (
    <View style={styles.row}>
      <Avatar
        name={name}
        seed={row.person?.id ?? row.id}
        photoUrl={row.person?.avatarUrl ?? null}
        gradient={row.person?.avatar ?? null}
        size={36}
      />
      <View style={styles.rowMeta}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        {meta.length > 0 ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {checkedIn ? (
        <View style={styles.checkedIn}>
          <Icon icon={iconMap.UserCheck} size={16} color={th.colors.successInk} />
          {canCheckIn && undoSeat ? (
            <TextLink
              variant="label"
              standalone
              disabled={pending}
              onPress={() => onUndo(undoSeat)}
              accessibilityLabel={t("roster.undo_a11y", { name })}
            >
              {t("roster.undo")}
            </TextLink>
          ) : null}
        </View>
      ) : canCheckIn && nextSeat ? (
        <Pressable
          onPress={pending ? undefined : () => onCheckIn(nextSeat)}
          disabled={pending}
          accessibilityRole="button"
          accessibilityState={{ disabled: pending }}
          accessibilityLabel={t("roster.check_in_a11y", { name })}
          {...focusRingProps}
          style={(state) => [
            styles.checkInBtn,
            webTransition,
            webCursor(pending),
            webHover(state) && !pending ? styles.checkInBtnHovered : null,
          ]}
        >
          <Text style={styles.checkInLabel}>{t("roster.check_in")}</Text>
        </Pressable>
      ) : null}
    </View>
  )
})

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

  const checkIn = useCheckInEventSeat(cleanupId)
  const undo = useUndoEventCheckIn(cleanupId)
  const pending = checkIn.isPending || undo.isPending

  const onError = useCallback(
    (err: unknown) => {
      toast.show(appErrorCode(err) === "FORBIDDEN" ? t("roster.error_forbidden") : t("roster.error"), {
        variant: "error",
      })
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
        {ROSTER_FILTERS.map((value) => (
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
          {rows.map((row) => (
            <RosterRowView
              key={row.id}
              row={row}
              canCheckIn={canCheckIn}
              pending={pending}
              onCheckIn={onCheckIn}
              onUndo={onUndo}
            />
          ))}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  rowMeta: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  rowSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  checkedIn: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  checkInBtn: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  checkInBtnHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  checkInLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["12"],
    color: t.colors.text,
  },
  more: {
    alignSelf: "flex-start",
    paddingVertical: t.space["2"],
  },
}))
