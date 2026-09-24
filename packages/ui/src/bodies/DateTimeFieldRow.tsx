import React from "react"
import { View, Pressable } from "react-native"
import {
  makeThemedStyles,
  useTheme,
  focusRingProps,
  webCursorPointer,
  webTransition,
  webHover,
} from "../theme"
import { Text, Icon, iconMap, type LucideIcon } from "../typography"
import type { DateFieldRowProps, TimeFieldRowProps } from "./InlineDateTimePicker.types"

const ROW_HEIGHT = 52

export interface DateTimeFieldRowProps {
  icon: LucideIcon
  value: string
  accessibilityLabel: string
  label?: string | undefined
  placeholder?: boolean
  valueSlot?: React.ReactNode
  trailing?: React.ReactNode
  suffix?: string | null
  error?: string | null
  spaced?: boolean
  onPress?: (() => void) | undefined
}

export function DateTimeFieldRow({
  icon,
  value,
  accessibilityLabel,
  label,
  placeholder = false,
  valueSlot,
  trailing,
  suffix,
  error,
  spaced = false,
  onPress,
}: DateTimeFieldRowProps) {
  const styles = useStyles()
  const th = useTheme()

  const body = (
    <>
      <Icon icon={icon} size={16} color={th.colors.textSubtle} />
      {label ? (
        <Text numberOfLines={1} style={styles.fieldLabel}>
          {label}
        </Text>
      ) : null}
      {valueSlot ?? (
        <Text
          numberOfLines={1}
          style={[styles.fieldValue, placeholder ? styles.fieldPlaceholder : null]}
        >
          {value}
        </Text>
      )}
      {suffix ? (
        <Text numberOfLines={1} style={styles.fieldSuffix}>
          {suffix}
        </Text>
      ) : null}
      {trailing}
    </>
  )

  const slotOwnsAccessibility = valueSlot !== undefined
  const rowAccessibility = slotOwnsAccessibility
    ? { focusable: false }
    : {
        accessibilityRole: "button" as const,
        accessibilityLabel,
        accessibilityValue: { text: value },
        ...focusRingProps,
      }

  return (
    <View style={spaced ? styles.blockSpaced : null}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          {...rowAccessibility}
          style={(state) => [
            styles.fieldRow,
            webCursorPointer,
            webTransition,
            webHover(state) ? styles.fieldRowHovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.fieldRow}>{body}</View>
      )}
      {error ? (
        <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Icon icon={iconMap.AlertCircle} size={13} color={th.colors.accentText} />
          <Text numberOfLines={2} style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

/** The row chrome both seams' date and time rows hand to `DateTimeFieldRow` unchanged. */
export function fieldRowChrome(
  props: DateFieldRowProps | TimeFieldRowProps,
): Pick<
  DateTimeFieldRowProps,
  "value" | "placeholder" | "accessibilityLabel" | "label" | "suffix" | "error" | "spaced"
> {
  return {
    value: props.displayValue,
    placeholder: props.placeholder,
    accessibilityLabel: props.accessibilityLabel,
    label: props.label,
    suffix: "suffix" in props ? props.suffix : undefined,
    error: props.error,
    spaced: props.spaced,
  }
}

const useStyles = makeThemedStyles((t) => ({
  blockSpaced: {
    marginTop: t.space["2"],
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    minHeight: ROW_HEIGHT,
    paddingHorizontal: t.space["4"],
  },
  fieldRowHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  fieldLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  fieldValue: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  fieldPlaceholder: {
    color: t.colors.textSubtle,
  },
  fieldSuffix: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: t.space["1"],
    paddingHorizontal: t.space["1"],
  },
  errorText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
  pressed: {
    opacity: 0.85,
  },
}))
