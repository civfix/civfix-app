import React from "react"
import { Pressable, type StyleProp, type TextStyle } from "react-native"
import {
  focusRingProps,
  makeThemedStyles,
  webCursor,
  DISABLED_OPACITY,
  MIN_TOUCH_TARGET,
  PRESSED_OPACITY,
} from "../theme"
import { Text, type AppTextProps } from "./Text"

export interface TextLinkProps {
  children: React.ReactNode
  onPress?: () => void
  variant?: AppTextProps["variant"]
  disabled?: boolean
  style?: StyleProp<TextStyle>
  numberOfLines?: number
  standalone?: boolean
  accessibilityLabel?: string
  testID?: string
}

export function TextLink({
  children,
  onPress,
  variant = "body",
  disabled = false,
  style,
  numberOfLines,
  standalone = false,
  accessibilityLabel,
  testID,
}: TextLinkProps) {
  const styles = useStyles()
  const [pressed, setPressed] = React.useState(false)
  const interactive = onPress != null && !disabled
  const inline = !standalone && interactive

  const label = (
    <Text
      variant={variant}
      accessible={standalone ? false : interactive || undefined}
      accessibilityRole={inline ? "link" : undefined}
      accessibilityLabel={standalone ? undefined : accessibilityLabel}
      testID={standalone ? undefined : testID}
      numberOfLines={numberOfLines}
      suppressHighlighting
      onPress={inline ? onPress : undefined}
      onPressIn={inline ? () => setPressed(true) : undefined}
      onPressOut={inline ? () => setPressed(false) : undefined}
      style={[
        styles.link,
        inline ? LINK_CURSOR : null,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      {children}
    </Text>
  )

  if (!standalone) return label

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !interactive }}
      testID={testID}
      disabled={!interactive}
      onPress={interactive ? onPress : undefined}
      onPressIn={interactive ? () => setPressed(true) : undefined}
      onPressOut={interactive ? () => setPressed(false) : undefined}
      {...focusRingProps}
      style={[styles.standalone, webCursor(!interactive)]}
    >
      {label}
    </Pressable>
  )
}

const LINK_CURSOR = webCursor() as TextStyle

const useStyles = makeThemedStyles((t) => ({
  link: {
    fontFamily: t.fontFamily.bodySemiBold,
    color: t.colors.textMuted,
    textDecorationLine: "underline",
  },
  standalone: {
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: t.space["2"],
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  pressed: {
    opacity: PRESSED_OPACITY,
  },
  disabled: {
    opacity: DISABLED_OPACITY,
  },
}))
