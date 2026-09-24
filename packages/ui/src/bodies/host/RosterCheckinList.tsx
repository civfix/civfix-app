import React, { useMemo } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { EventRegistrationDTO, EventSlotDTO } from "@civfix/shared"
import { DELETED_USER_LABEL } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
  webTransition,
} from "../../theme"
import { Text, TextLink, Icon, iconMap } from "../../typography"
import { Avatar } from "../../primitives"
import { useT } from "../../i18n"
import { SlotGroupHeader } from "../SlotGroupHeader"
import { groupRosterBySlot, rosterListKey, type RosterListItem } from "../rosterSlotGroups"

const CHECK_IN_MIN_HEIGHT = 32

const MIN_TOUCH_TARGET = 44

const CHECK_IN_SLOP_Y = (MIN_TOUCH_TARGET - CHECK_IN_MIN_HEIGHT) / 2

const CHECK_IN_HIT_SLOP = { top: CHECK_IN_SLOP_Y, bottom: CHECK_IN_SLOP_Y }

export function attendeeName(row: EventRegistrationDTO): string {
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

export const RosterCheckinRow = React.memo(function RosterCheckinRow({
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
    row.waitlistPosition != null
      ? t("roster.waitlist_position", { position: row.waitlistPosition })
      : null,
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
          hitSlop={CHECK_IN_HIT_SLOP}
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

export interface RosterCheckinListProps {
  rows: readonly EventRegistrationDTO[]
  slots: readonly EventSlotDTO[]
  timeZone: string | undefined
  canCheckIn: boolean
  pending: boolean
  onCheckIn: (seatId: string) => void
  onUndo: (seatId: string) => void
}

export function RosterCheckinList({
  rows,
  slots,
  timeZone,
  canCheckIn,
  pending,
  onCheckIn,
  onUndo,
}: RosterCheckinListProps) {
  const { t } = useT("event-slots")
  const items = useMemo<RosterListItem<EventRegistrationDTO>[]>(
    () =>
      slots.length > 0
        ? groupRosterBySlot(rows, slots, { unassignedTitle: t("roster.unassigned") })
        : rows.map((person) => ({ kind: "member", person }) as const),
    [rows, slots, t],
  )

  return (
    <View>
      {items.map((item) => {
        if (item.kind === "slot-header") {
          return (
            <SlotGroupHeader
              key={rosterListKey(item)}
              title={item.title}
              claimed={item.claimed}
              capacity={item.capacity}
              startsAt={item.startsAt}
              endsAt={item.endsAt}
              timeZone={timeZone}
            />
          )
        }
        if (item.kind === "slot-empty") return null
        return (
          <RosterCheckinRow
            key={rosterListKey(item)}
            row={item.person}
            canCheckIn={canCheckIn}
            pending={pending}
            onCheckIn={onCheckIn}
            onUndo={onUndo}
          />
        )
      })}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
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
    minHeight: CHECK_IN_MIN_HEIGHT,
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
}))
