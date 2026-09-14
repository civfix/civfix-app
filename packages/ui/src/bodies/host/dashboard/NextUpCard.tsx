import React, { useCallback } from "react"
import { Pressable, View } from "react-native"
import type { EventPhase, EventSlotDTO, HostedEventDTO } from "@civfix/shared"
import { deriveCleanupStatus } from "@civfix/shared/host"
import { focusRingProps, makeThemedStyles, useTheme } from "../../../theme"
import { Text, TextLink, iconMap, type LucideIcon } from "../../../typography"
import { DateBadge, MetaDot, Meter, PrimaryButton, SectionCard } from "../../../primitives"
import { LIST_TILE } from "../../../primitives"
import { useEventWhen, useRelativeTime, useT } from "../../../i18n"
import { boardHasTimedSlots, slotDisplayOrder } from "../../eventSlotsModel"
import { PhaseDot } from "../PhaseHeader"
import { ShiftRow } from "../ShiftRow"
import { hostedEventWhen, hostedEventWindow, type NextUpCtaKey } from "./dashboardModel"

const MAX_STRIP_SHIFTS = 3

const MIN_STRIP_SHIFTS = 2

const CTA_ICONS: Readonly<Record<NextUpCtaKey, LucideIcon>> = {
  check_in: iconMap.QrCode,
  message: iconMap.Megaphone,
  share: iconMap.Share,
  host_tools: iconMap.Building,
}

const CTA_LABELS: Readonly<Record<NextUpCtaKey, string>> = {
  check_in: "next_up.check_in",
  message: "next_up.message",
  share: "next_up.share",
  host_tools: "next_up.host_tools",
}

const CTA_A11Y: Readonly<Record<NextUpCtaKey, string>> = {
  check_in: "next_up.check_in_a11y",
  message: "next_up.message_a11y",
  share: "next_up.share_a11y",
  host_tools: "next_up.host_tools_a11y",
}

export interface NextUpCardProps {
  event: HostedEventDTO
  phase: EventPhase
  cta: NextUpCtaKey
  slots: readonly EventSlotDTO[]
  liveCheckedIn: number | null
  now: number
  onOpen: (event: HostedEventDTO) => void
  onPrimary: (event: HostedEventDTO) => void
  onHostTools: (event: HostedEventDTO) => void
}

export function NextUpCard({
  event,
  phase,
  cta,
  slots,
  liveCheckedIn,
  now,
  onOpen,
  onPrimary,
  onHostTools,
}: NextUpCardProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const { relative } = useRelativeTime()
  const when = useEventWhen(hostedEventWhen(event))

  const open = useCallback(() => onOpen(event), [event, onOpen])
  const primary = useCallback(() => onPrimary(event), [event, onPrimary])
  const hostTools = useCallback(() => onHostTools(event), [event, onHostTools])

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
          accessibilityLabel={t("events.open_a11y", { title: event.title })}
          {...focusRingProps}
          style={({ pressed }) => [styles.head, pressed ? styles.pressed : null]}
        >
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
        </Pressable>

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
            {hidden > 0 ? (
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
          </View>
        ) : null}

        <PrimaryButton
          label={t(CTA_LABELS[cta])}
          icon={CTA_ICONS[cta]}
          accessibilityLabel={t(CTA_A11Y[cta], { title: event.title })}
          onPress={primary}
        />
      </View>
    </SectionCard>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["3"],
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  pressed: {
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
