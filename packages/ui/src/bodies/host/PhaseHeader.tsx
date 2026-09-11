import React, { useEffect, useRef } from "react"
import { Animated, Easing, View } from "react-native"
import { makeThemedStyles, useReducedMotion, useTheme } from "../../theme"
import { useT } from "../../i18n"
import { MetaDot } from "../../primitives/MetaDot"
import { PrimaryButton } from "../../primitives/PrimaryButton"
import { SecondaryButton } from "../../primitives/SecondaryButton"
import { Text, type LucideIcon } from "../../typography"

export const PHASE_NAMES = ["upcoming", "live", "ended", "cancelled"] as const

export type PhaseName = (typeof PHASE_NAMES)[number]

const DOT_SIZE = 8
const PULSE_MIN_OPACITY = 0.35

export interface PhaseDotProps {
  phase: PhaseName
}

export interface PhaseHeaderAction {
  label: string
  icon?: LucideIcon
  onPress: () => void
  loading?: boolean
}

export interface PhaseHeaderProps {
  phase: PhaseName
  title: string
  when: string
  relative: string
  cta?: PhaseHeaderAction
  secondary?: PhaseHeaderAction
  wide?: boolean
}

export function PhaseDot({ phase }: PhaseDotProps) {
  const styles = useStyles()
  const t = useTheme()
  const reducedMotion = useReducedMotion()
  const pulse = useRef(new Animated.Value(1)).current
  const live = phase === "live"

  useEffect(() => {
    if (!live || reducedMotion !== false) {
      pulse.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: PULSE_MIN_OPACITY,
          duration: t.motion.dur.d4,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: t.motion.dur.d4,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [live, pulse, reducedMotion, t.motion])

  const color =
    phase === "live"
      ? t.colors.successInk
      : phase === "upcoming"
        ? t.colors.sky["500"]
        : phase === "cancelled"
          ? t.colors.dangerInk
          : t.colors.textSubtle

  return <Animated.View style={[styles.dot, { backgroundColor: color, opacity: pulse }]} />
}

export function PhaseHeader({
  phase,
  title,
  when,
  relative,
  cta,
  secondary,
  wide = false,
}: PhaseHeaderProps) {
  const styles = useStyles()
  const { t } = useT("host-mode")
  return (
    <View style={styles.root}>
      <View style={styles.phaseRow}>
        <PhaseDot phase={phase} />
        <Text variant="label">{t(`phase.${phase}`)}</Text>
        <MetaDot />
        <Text variant="caption" style={styles.relative} numberOfLines={1}>
          {relative}
        </Text>
      </View>
      <Text variant="title" numberOfLines={2}>
        {title}
      </Text>
      <Text variant="caption" numberOfLines={2}>
        {when}
      </Text>
      {cta || secondary ? (
        <View style={[styles.actions, wide ? styles.actionsWide : null]}>
          {cta ? (
            <PrimaryButton
              label={cta.label}
              icon={cta.icon}
              loading={cta.loading}
              onPress={cta.onPress}
              style={wide ? styles.ctaWide : null}
            />
          ) : null}
          {secondary ? (
            <SecondaryButton
              label={secondary.label}
              icon={secondary.icon}
              onPress={secondary.onPress}
              style={wide ? styles.secondaryWide : styles.secondaryStacked}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["2"],
  },
  phaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: t.radius.pill,
  },
  relative: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    gap: t.space["2"],
    marginTop: t.space["2"],
  },
  actionsWide: {
    flexDirection: "row",
    alignItems: "center",
  },
  ctaWide: {
    flex: 2,
  },
  secondaryWide: {
    flex: 1,
  },
  secondaryStacked: {
    alignSelf: "stretch",
  },
}))
