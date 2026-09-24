import React, { useMemo } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { EventRegistrationDTO, EventSlotDTO } from "@civfix/shared"
import { DELETED_USER_LABEL } from "@civfix/shared"
import { attendeeDisplayName, lastCheckedInSeat, nextCheckinSeat } from "@civfix/shared/host"
import {
  hitSlopToTarget,
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
  webTransition,
} from "../../theme"
import { Text, TextLink, Icon, iconMap } from "../../typography"
import { Avatar } from "../../primitives"
import { joinParts } from "../../primitives/joinParts"
import { useT } from "../../i18n"
import { SlotGroupHeader } from "../SlotGroupHeader"
import { rosterListKey } from "../rosterSlotGroups"
import { rosterCheckinItems, type RosterCheckinItem } from "./rosterListModel"

const CHECK_IN_MIN_HEIGHT = 32

const CHECK_IN_SLOP_Y = hitSlopToTarget(CHECK_IN_MIN_HEIGHT)

const CHECK_IN_HIT_SLOP = { top: CHECK_IN_SLOP_Y, bottom: CHECK_IN_SLOP_Y }

const NAME_FALLBACKS = { guest: "", deleted: DELETED_USER_LABEL }

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
  const name = attendeeDisplayName(row, NAME_FALLBACKS)
  const checkedIn = row.checkedInAt != null
  const nextSeat = nextCheckinSeat(row)
  const undoSeat = lastCheckedInSeat(row)
  const meta = joinParts([
    row.ticketTypeName ?? null,
    row.seatCount > 1 ? t("roster.seats", { count: row.seatCount }) : null,
    row.kind === "guest" ? t("roster.guest") : null,
    row.waitlistPosition != null
      ? t("roster.waitlist_position", { position: row.waitlistPosition })
      : null,
  ])

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

export function useRosterListItems(
  rows: readonly EventRegistrationDTO[],
  slots: readonly EventSlotDTO[],
): RosterCheckinItem[] {
  const { t } = useT("event-slots")
  return useMemo(() => rosterCheckinItems(rows, slots, t("roster.unassigned")), [rows, slots, t])
}

export interface RosterRowOptions {
  timeZone: string | undefined
  canCheckIn: boolean
  pending: boolean
  onCheckIn: (seatId: string) => void
  onUndo: (seatId: string) => void
}

export function rosterItemRenderer({ timeZone, canCheckIn, pending, onCheckIn, onUndo }: RosterRowOptions) {
  return function renderRosterItem({ item }: { item: RosterCheckinItem }) {
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
  }
}

export function useRosterItemRenderer({ timeZone, canCheckIn, pending, onCheckIn, onUndo }: RosterRowOptions) {
  return useMemo(
    () => rosterItemRenderer({ timeZone, canCheckIn, pending, onCheckIn, onUndo }),
    [timeZone, canCheckIn, pending, onCheckIn, onUndo],
  )
}

export interface RosterCheckinListProps extends RosterRowOptions {
  rows: readonly EventRegistrationDTO[]
  slots: readonly EventSlotDTO[]
}

export function RosterCheckinList({ rows, slots, ...rowOptions }: RosterCheckinListProps) {
  const items = useRosterListItems(rows, slots)
  const renderItem = useRosterItemRenderer(rowOptions)
  return <View>{items.map((item) => renderItem({ item }))}</View>
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
