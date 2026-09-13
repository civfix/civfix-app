import React from "react"
import { Pressable, View } from "react-native"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
  webTransition,
} from "../theme"
import { Text } from "../typography"

export const SEGMENTED_MIN_TOUCH_TARGET = 44
const SEGMENT_HEIGHT_MD = 44
const SEGMENT_HEIGHT_SM = 32
const SEGMENT_SM_HIT_SLOP = (SEGMENTED_MIN_TOUCH_TARGET - SEGMENT_HEIGHT_SM) / 2

export type SegmentedControlSize = "sm" | "md"

export interface SegmentedOption {
  key: string
  label: string
}

export interface SegmentedControlProps {
  label: string
  options: readonly SegmentedOption[]
  selected: string
  onSelect: (key: string) => void
  size?: SegmentedControlSize
  disabled?: boolean
}

export function SegmentedControl({
  label,
  options,
  selected,
  onSelect,
  size = "md",
  disabled = false,
}: SegmentedControlProps) {
  const styles = useStyles()
  const t = useTheme()
  const sm = size === "sm"
  return (
    <View
      style={[styles.track, sm ? styles.trackSm : styles.trackMd]}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const on = option.key === selected
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled }}
            accessibilityLabel={option.label}
            hitSlop={sm ? SEGMENT_SM_HIT_SLOP : undefined}
            {...focusRingProps}
            style={(state) => [
              styles.segment,
              sm ? styles.segmentSm : styles.segmentMd,
              webTransition,
              webCursor(disabled),
              on ? styles.segmentOn : null,
              on ? t.shadows.s1 : null,
              !on && !disabled && webHover(state) ? styles.segmentHovered : null,
              !on && state.pressed && !disabled ? styles.segmentPressed : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.segmentText,
                sm ? styles.segmentTextSm : null,
                on ? styles.segmentTextOn : null,
                disabled ? styles.segmentTextDisabled : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  track: {
    flexDirection: "row",
    maxWidth: "100%",
    backgroundColor: t.colors.bgAlt,
    borderRadius: t.radius.pill,
    padding: t.space["1"],
    gap: t.space["1"],
  },
  trackMd: {
    alignSelf: "stretch",
  },
  trackSm: {
    alignSelf: "flex-end",
  },
  segment: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    paddingHorizontal: t.space["3"],
  },
  segmentMd: {
    flex: 1,
    height: SEGMENT_HEIGHT_MD - t.space["2"],
  },
  segmentSm: {
    height: SEGMENT_HEIGHT_SM - t.space["2"],
  },
  segmentOn: {
    backgroundColor: t.colors.surface,
  },
  segmentHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  segmentPressed: {
    opacity: 0.8,
  },
  segmentText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  segmentTextSm: {
    fontSize: t.fontSize["12"],
  },
  segmentTextOn: {
    color: t.colors.text,
  },
  segmentTextDisabled: {
    color: t.colors.textSubtle,
  },
}))
