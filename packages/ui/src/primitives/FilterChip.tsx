import React from "react"
import { Pressable } from "react-native"
import {
  focusRingProps,
  makeThemedStyles,
  webCursor,
  webHover,
  webTransition,
} from "../theme"
import { Text } from "../typography"

export const FILTER_CHIP_MIN_TOUCH_TARGET = 44
const CHIP_HEIGHT = 34
const CHIP_HIT_SLOP = (FILTER_CHIP_MIN_TOUCH_TARGET - CHIP_HEIGHT) / 2

export interface FilterChipProps {
  label: string
  selected: boolean
  onPress: () => void
  count?: number
  accessibilityLabel?: string
}

export function FilterChip({ label, selected, onPress, count, accessibilityLabel }: FilterChipProps) {
  const styles = useStyles()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={CHIP_HIT_SLOP}
      {...focusRingProps}
      style={(state) => [
        styles.chip,
        webTransition,
        webCursor(),
        selected ? styles.chipOn : null,
        !selected && webHover(state) ? styles.chipHovered : null,
        state.pressed ? styles.chipPressed : null,
      ]}
    >
      <Text numberOfLines={1} style={[styles.label, selected ? styles.labelOn : null]}>
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
    height: CHIP_HEIGHT,
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
  count: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
}))
