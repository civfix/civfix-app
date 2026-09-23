import React from "react"
import { Pressable } from "react-native"
import {
  a11yState,
  focusRingProps,
  makeThemedStyles,
  webCursor,
  webHover,
  webTransition,
} from "../theme"
import { Text } from "../typography"

export const FILTER_CHIP_MIN_TOUCH_TARGET = 44
export const FILTER_CHIP_HEIGHT = 34
const CHIP_HIT_SLOP = (FILTER_CHIP_MIN_TOUCH_TARGET - FILTER_CHIP_HEIGHT) / 2

/**
 * What pressing the chip means to assistive tech: one choice of a set ("single", a radio), one of
 * several independent toggles ("multiple", a checkbox), or a plain command with no selected state
 * ("action", a button).
 */
export type FilterChipSelection = "single" | "multiple" | "action"

const SELECTION_ROLE = {
  single: "radio",
  multiple: "checkbox",
  action: "button",
} as const satisfies Record<FilterChipSelection, string>

export interface FilterChipProps {
  label: string
  selected: boolean
  onPress: () => void
  count?: number
  disabled?: boolean
  accessibilityLabel?: string
  selection?: FilterChipSelection
}

export function FilterChip({
  label,
  selected,
  onPress,
  count,
  disabled = false,
  accessibilityLabel,
  selection = "single",
}: FilterChipProps) {
  const styles = useStyles()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={SELECTION_ROLE[selection]}
      {...a11yState(selection === "action" ? { disabled } : { checked: selected, disabled })}
      accessibilityLabel={accessibilityLabel ?? (count === undefined ? label : `${label}, ${count}`)}
      hitSlop={CHIP_HIT_SLOP}
      {...focusRingProps}
      style={(state) => [
        styles.chip,
        webTransition,
        webCursor(disabled),
        selected ? styles.chipOn : null,
        !selected && !disabled && webHover(state) ? styles.chipHovered : null,
        state.pressed && !disabled ? styles.chipPressed : null,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          selected ? styles.labelOn : null,
          disabled ? styles.labelDisabled : null,
        ]}
      >
        {label}
      </Text>
      {count === undefined ? null : (
        <Text style={[styles.count, selected ? styles.labelOn : null]}>{count}</Text>
      )}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
    height: FILTER_CHIP_HEIGHT,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  chipOn: {
    backgroundColor: t.colors.selectedFill,
  },
  chipHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  chipPressed: {
    opacity: 0.86,
  },
  label: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  labelOn: {
    color: t.colors.selectedInk,
  },
  labelDisabled: {
    color: t.colors.textSubtle,
  },
  count: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
}))
