import React from "react"
import { View, Pressable } from "react-native"
import {
  focusRingProps,
  makeThemedStyles,
  MIN_TOUCH_TARGET,
  useTheme,
  webCursor,
  webHover,
  webTransition,
} from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import { useT } from "../../../i18n"
import { clampPartySize } from "./registrationModel"

export interface PartySizeStepperProps {
  value: number
  max: number
  onChange: (next: number) => void
  disabled?: boolean
}

export function PartySizeStepper({ value, max, onChange, disabled = false }: PartySizeStepperProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-ticket")
  const ceiling = Math.max(1, Math.floor(max))
  const current = clampPartySize(value, ceiling)
  const canDecrement = !disabled && current > 1
  const canIncrement = !disabled && current < ceiling

  if (ceiling <= 1) return null

  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Text style={styles.label}>{t("party.label")}</Text>
        <Text style={styles.hint}>{t("party.hint", { count: ceiling })}</Text>
      </View>
      <View style={styles.stepper}>
        <Pressable
          onPress={canDecrement ? () => onChange(current - 1) : undefined}
          disabled={!canDecrement}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canDecrement }}
          accessibilityLabel={t("party.decrement_a11y")}
          {...focusRingProps}
          style={(state) => [
            styles.step,
            webTransition,
            webCursor(!canDecrement),
            !canDecrement ? styles.stepOff : null,
            canDecrement && webHover(state) ? styles.stepHovered : null,
          ]}
        >
          <Icon icon={iconMap.Minus} size={16} color={th.colors.text} />
        </Pressable>
        <Text style={styles.value} accessibilityLabel={t("party.value_a11y", { count: current })}>
          {current}
        </Text>
        <Pressable
          onPress={canIncrement ? () => onChange(current + 1) : undefined}
          disabled={!canIncrement}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canIncrement }}
          accessibilityLabel={t("party.increment_a11y")}
          {...focusRingProps}
          style={(state) => [
            styles.step,
            webTransition,
            webCursor(!canIncrement),
            !canIncrement ? styles.stepOff : null,
            canIncrement && webHover(state) ? styles.stepHovered : null,
          ]}
        >
          <Icon icon={iconMap.Plus} size={16} color={th.colors.text} />
        </Pressable>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: MIN_TOUCH_TARGET,
  },
  labels: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  hint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  step: {
    width: 36,
    height: 36,
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  stepHovered: {
    backgroundColor: t.colors.surface,
  },
  stepOff: {
    opacity: 0.45,
  },
  value: {
    minWidth: 24,
    textAlign: "center",
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
}))
