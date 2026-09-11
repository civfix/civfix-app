import React, { useCallback } from "react"
import { Pressable, View } from "react-native"
import type { EventPhase, HostedEventDTO } from "@civfix/shared"
import { dowLabel, timeLabel } from "@civfix/shared/datetime"
import { focusRingProps, makeThemedStyles, useTheme } from "../../../theme"
import { Text, iconMap } from "../../../typography"
import { DateBadge, MetaDot, Meter, PrimaryButton, SectionCard } from "../../../primitives"
import { useLocale, useRelativeTime, useT } from "../../../i18n"
import { PhaseDot } from "../PhaseHeader"
import { nextUpCtaKey } from "./dashboardModel"

const DATE_BADGE_SIZE = 48

export interface NextUpCardProps {
  event: HostedEventDTO
  phase: EventPhase
  onOpen: (event: HostedEventDTO) => void
  onPrimary: (event: HostedEventDTO) => void
}

export function NextUpCard({ event, phase, onOpen, onPrimary }: NextUpCardProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const { t: tPhase } = useT("host-mode")
  const { locale } = useLocale()
  const { weekdays } = useRelativeTime()

  const open = useCallback(() => onOpen(event), [event, onOpen])
  const primary = useCallback(() => onPrimary(event), [event, onPrimary])

  const capacity = event.capacity ?? null
  const seats = t("events.meta_capacity", {
    registered: event.registeredCount,
    capacity: capacity ?? "",
  })
  const ctaKey = nextUpCtaKey(phase)
  const live = phase === "live"

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
          <DateBadge iso={event.startsAt} size={DATE_BADGE_SIZE} />
          <View style={styles.meta}>
            <Text style={styles.title} numberOfLines={2}>
              {event.title}
            </Text>
            <View style={styles.line}>
              <Text variant="caption" numberOfLines={1}>
                {dowLabel(event.startsAt, weekdays)}
              </Text>
              <MetaDot color={th.colors.textSubtle} style={styles.dot} />
              <Text variant="caption" numberOfLines={1}>
                {timeLabel(event.startsAt, locale)}
              </Text>
            </View>
            <View style={styles.line}>
              <PhaseDot phase={phase} />
              <Text variant="label" numberOfLines={1} style={styles.phase}>
                {tPhase(`phase.${phase}`)}
              </Text>
            </View>
          </View>
        </Pressable>

        {capacity !== null && capacity > 0 ? (
          <View style={styles.meter}>
            <Meter
              value={event.registeredCount}
              max={capacity}
              accessibilityLabel={t("next_up.meter_a11y", {
                registered: event.registeredCount,
                capacity,
              })}
            />
            <View style={styles.line}>
              <Text variant="caption">{seats}</Text>
              {event.waitlistCount > 0 ? (
                <>
                  <MetaDot color={th.colors.textSubtle} style={styles.dot} />
                  <Text variant="caption">
                    {t("events.meta_waiting", { count: event.waitlistCount })}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        <PrimaryButton
          label={t(ctaKey)}
          icon={live ? iconMap.QrCode : iconMap.Building}
          accessibilityLabel={
            live
              ? t("next_up.check_in_a11y", { title: event.title })
              : t("next_up.host_tools_a11y", { title: event.title })
          }
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
    color: t.colors.text,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  dot: {
    marginHorizontal: 0,
  },
  phase: {
    flex: 1,
    minWidth: 0,
  },
  meter: {
    gap: t.space["2"],
  },
}))
