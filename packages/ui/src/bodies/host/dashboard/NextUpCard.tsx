import React, { useCallback } from "react"
import { Pressable, View } from "react-native"
import type { EventPhase, EventSlotDTO, HostedEventDTO } from "@civfix/shared"
import { deriveCleanupStatus } from "@civfix/shared/host"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursorPointer,
  webHover,
  webTransition,
} from "../../../theme"
import { Icon, Text, TextLink, iconMap } from "../../../typography"
import { DateBadge, MetaDot, Meter, PrimaryButton, SectionCard } from "../../../primitives"
import { LIST_TILE } from "../../../primitives"
import { useEventWhen, useRelativeTime, useT } from "../../../i18n"
import { boardHasTimedSlots, slotDisplayOrder } from "../../eventSlotsModel"
import { PhaseDot } from "../PhaseHeader"
import { ShiftRow } from "../ShiftRow"
import { hostedEventWhen, hostedEventWindow } from "./dashboardModel"

const MAX_STRIP_SHIFTS = 3

const MIN_STRIP_SHIFTS = 2

const SHARE_SIZE = 32

const MIN_TOUCH_TARGET = 44

const SHARE_HIT_SLOP = (MIN_TOUCH_TARGET - SHARE_SIZE) / 2

const SHARE_ICON = 18

export interface NextUpCardProps {
  event: HostedEventDTO
  phase: EventPhase
  slots: readonly EventSlotDTO[]
  liveCheckedIn: number | null
  now: number
  onOpen: (event: HostedEventDTO) => void
  onHostTools: (event: HostedEventDTO) => void
  onShare: (event: HostedEventDTO) => void
}

export function NextUpCard({
  event,
  phase,
  slots,
  liveCheckedIn,
  now,
  onOpen,
  onHostTools,
  onShare,
}: NextUpCardProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const { relative } = useRelativeTime()
  const when = useEventWhen(hostedEventWhen(event))

  const open = useCallback(() => onOpen(event), [event, onOpen])
  const hostTools = useCallback(() => onHostTools(event), [event, onHostTools])
  const share = useCallback(() => onShare(event), [event, onShare])

  const underway = deriveCleanupStatus(hostedEventWindow(event), now) === "active"
  const live = phase === "live"
  const capacity = event.capacity ?? null
  const seats =
    capacity !== null
      ? t("next_up.signed_up_of", { registered: event.registeredCount, capacity })
      : t("next_up.signed_up", { registered: event.registeredCount })
  const whenLine = underway
    ? t("next_up.started", { ago: relative(event.startsAt, now) })
    : t("next_up.starts_in", {
        dow: when.dow,
        time: when.timeWithZone,
        relative: relative(now, Date.parse(event.startsAt)),
      })

  const cardLabel = [
    t("events.open_a11y", { title: event.title }),
    whenLine,
    seats,
    event.waitlistCount > 0 ? t("next_up.waiting", { count: event.waitlistCount }) : null,
    live && liveCheckedIn !== null ? t("next_up.checked_in", { count: liveCheckedIn }) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(". ")

  const timed = boardHasTimedSlots(slots)
    ? slotDisplayOrder(slots).filter((slot) => !!slot.startsAt && !!slot.endsAt)
    : []
  const strip = timed.length >= MIN_STRIP_SHIFTS ? timed.slice(0, MAX_STRIP_SHIFTS) : []
  const hidden = timed.length - strip.length

  return (
    <SectionCard label={t("next_up.section")}>
      <View style={styles.root}>
        <Pressable
          onPress={share}
          accessibilityRole="button"
          accessibilityLabel={t("next_up.share_a11y", { title: event.title })}
          hitSlop={SHARE_HIT_SLOP}
          {...focusRingProps}
          style={(state) => [
            styles.share,
            webTransition,
            webCursorPointer,
            webHover(state) ? styles.shareHovered : null,
            state.pressed ? styles.sharePressed : null,
          ]}
        >
          <Icon icon={iconMap.Share} size={SHARE_ICON} color={th.colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={cardLabel}
          {...focusRingProps}
          style={({ pressed }) => [
            styles.body,
            webTransition,
            webCursorPointer,
            pressed ? styles.pressed : null,
          ]}
        >
          <View style={styles.head}>
            <DateBadge iso={event.startsAt} size={LIST_TILE} timeZone={when.timeZone} />
            <View style={styles.meta}>
              <Text style={styles.title} numberOfLines={2}>
                {event.title}
              </Text>
              <View style={styles.whenLine}>
                {live ? <PhaseDot phase={phase} /> : null}
                <Text variant="label" numberOfLines={1} style={styles.when}>
                  {whenLine}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.staffing}>
            {capacity !== null && capacity > 0 ? (
              <Meter
                value={event.registeredCount}
                max={capacity}
                accessibilityLabel={t("next_up.meter_a11y", {
                  registered: event.registeredCount,
                  capacity,
                })}
              />
            ) : null}
            <View style={styles.countsRow}>
              <Text variant="caption" numberOfLines={1} style={styles.counts}>
                {seats}
              </Text>
              {event.waitlistCount > 0 ? (
                <>
                  <MetaDot color={th.colors.textSubtle} />
                  <Text variant="caption" numberOfLines={1} style={styles.counts}>
                    {t("next_up.waiting", { count: event.waitlistCount })}
                  </Text>
                </>
              ) : null}
              <View style={styles.spacer} />
              {live && liveCheckedIn !== null ? (
                <Text style={styles.checkedIn} numberOfLines={1}>
                  {t("next_up.checked_in", { count: liveCheckedIn })}
                </Text>
              ) : null}
            </View>
          </View>

          {strip.length > 0 ? (
            <View style={styles.shifts}>
              {strip.map((slot) => (
                <ShiftRow key={slot.id} slot={slot} timeZone={event.timezone ?? undefined} />
              ))}
            </View>
          ) : null}
        </Pressable>

        {strip.length > 0 && hidden > 0 ? (
          <TextLink
            variant="label"
            standalone
            numberOfLines={1}
            accessibilityLabel={t("next_up.more_shifts_a11y", {
              total: timed.length,
              title: event.title,
            })}
            onPress={hostTools}
          >
            {t("next_up.more_shifts", { count: hidden })}
          </TextLink>
        ) : null}

        <PrimaryButton
          label={t("next_up.host_tools")}
          icon={iconMap.Building}
          accessibilityLabel={t("next_up.host_tools_a11y", { title: event.title })}
          onPress={hostTools}
        />
      </View>
    </SectionCard>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["3"],
  },
  body: {
    gap: t.space["3"],
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingRight: SHARE_SIZE + t.space["2"],
  },
  pressed: {
    opacity: 0.92,
  },
  share: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 1,
    width: SHARE_SIZE,
    height: SHARE_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  shareHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  sharePressed: {
    opacity: 0.92,
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: t.space["1"],
  },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    lineHeight: 20,
    color: t.colors.text,
  },
  whenLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  when: {
    flex: 1,
    minWidth: 0,
  },
  staffing: {
    gap: t.space["2"],
  },
  countsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  counts: {
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
  },
  checkedIn: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.successInk,
  },
  shifts: {
    gap: t.space["3"],
  },
}))
