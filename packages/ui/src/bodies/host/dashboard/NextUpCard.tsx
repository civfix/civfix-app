import React, { useCallback } from "react"
import { Pressable, View } from "react-native"
import type { EventPhase, EventSlotDTO, HostedEventDTO } from "@civfix/shared"
import { deriveCleanupStatus } from "@civfix/shared/host"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursorPointer,
  webTransition,
} from "../../../theme"
import { Text, TextLink, iconMap } from "../../../typography"
import {
  DateBadge,
  ICON_ACTION_SIZE,
  IconActionButton,
  LIST_TILE,
  MetaDot,
  Meter,
  PrimaryButton,
  SectionCard,
} from "../../../primitives"
import { joinParts } from "../../../primitives/joinParts"
import { useEventWhen, useRelativeTime, useT } from "../../../i18n"
import { boardHasTimedSlots, slotDisplayOrder } from "../../eventSlotsModel"
import { PhaseDot } from "../PhaseHeader"
import { ShiftRow } from "../ShiftRow"
import { relativeLineFor } from "../hostSurfaceModel"
import { relativeUntil } from "../hostTime"
import { hostedEventWhen, hostedEventWindow } from "./dashboardModel"

const MAX_STRIP_SHIFTS = 3

const MIN_STRIP_SHIFTS = 2

const A11Y_SENTENCE_SEPARATOR = ". "

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
    ? relativeLineFor(relative(event.startsAt, now), (ago) => t("next_up.started", { ago }))
    : relativeLineFor(relativeUntil(relative, Date.parse(event.startsAt), now), (rel) =>
        t("next_up.starts_in", { dow: when.dow, time: when.timeWithZone, relative: rel }),
      )

  const cardLabel = joinParts(
    [
      t("events.open_a11y", { title: event.title }),
      whenLine,
      seats,
      event.waitlistCount > 0 ? t("next_up.waiting", { count: event.waitlistCount }) : null,
      live && liveCheckedIn !== null ? t("next_up.checked_in", { count: liveCheckedIn }) : null,
    ],
    A11Y_SENTENCE_SEPARATOR,
  )

  const timed = boardHasTimedSlots(slots)
    ? slotDisplayOrder(slots).filter((slot) => !!slot.startsAt && !!slot.endsAt)
    : []
  const strip = timed.length >= MIN_STRIP_SHIFTS ? timed.slice(0, MAX_STRIP_SHIFTS) : []
  const hidden = timed.length - strip.length

  return (
    <SectionCard label={t("next_up.section")}>
      <View style={styles.root}>
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
                {whenLine !== null ? (
                  <Text variant="label" numberOfLines={1} style={styles.when}>
                    {whenLine}
                  </Text>
                ) : null}
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

        <IconActionButton
          icon={iconMap.Share}
          iconColor={th.colors.textMuted}
          onPress={share}
          accessibilityLabel={t("next_up.share_a11y", { title: event.title })}
          style={styles.share}
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
    paddingRight: ICON_ACTION_SIZE + t.space["2"],
  },
  pressed: {
    opacity: 0.92,
  },
  share: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 1,
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
