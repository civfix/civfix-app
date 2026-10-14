import React from "react"
import {
  Pressable,
  type AccessibilityState,
  type StyleProp,
  type View as RNView,
  type ViewStyle,
} from "react-native"
import {
  focusRingProps,
  hitSlopToTarget,
  makeThemedStyles,
  webCursorPointer,
  webHover,
  webTransition,
} from "../theme"
import { Icon, type LucideIcon } from "../typography"

export const ICON_ACTION_SIZE = 32
const ICON_ACTION_GLYPH = 18
const ICON_ACTION_HIT_SLOP = hitSlopToTarget(ICON_ACTION_SIZE)
const ICON_ACTION_PRESSED_OPACITY = 0.92

export interface IconActionButtonProps {
  icon: LucideIcon
  iconColor: string
  onPress: () => void
  accessibilityLabel: string
  accessibilityState?: AccessibilityState
  style?: StyleProp<ViewStyle>
  ref?: React.Ref<RNView>
}

/** A borderless round icon control for a row or card corner: 32pt drawn, 44pt reached on native. */
export function IconActionButton({
  icon,
  iconColor,
  onPress,
  accessibilityLabel,
  accessibilityState,
  style,
  ref,
}: IconActionButtonProps) {
  const styles = useStyles()
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      hitSlop={ICON_ACTION_HIT_SLOP}
      {...focusRingProps}
      style={(state) => [
        styles.button,
        style,
        webTransition,
        webCursorPointer,
        webHover(state) ? styles.hovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <Icon icon={icon} size={ICON_ACTION_GLYPH} color={iconColor} />
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  button: {
    width: ICON_ACTION_SIZE,
    height: ICON_ACTION_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  hovered: {
    backgroundColor: t.colors.bgAlt,
  },
  pressed: {
    opacity: ICON_ACTION_PRESSED_OPACITY,
  },
}))
