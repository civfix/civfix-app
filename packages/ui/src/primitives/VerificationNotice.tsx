import React from "react"
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import {
  makeThemedStyles,
  useTheme,
  webCursor,
  webTransition,
  webHover,
  focusRingProps,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { VerifiedBadge } from "./VerifiedBadge"

export interface VerificationNoticeProps {
  verified: boolean
  message: string
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export function VerificationNotice({
  verified,
  message,
  onPress,
  accessibilityLabel,
  style,
}: VerificationNoticeProps) {
  const styles = useStyles()
  const t = useTheme()
  const tone = verified ? styles.verified : styles.unverified
  const textColor = verified ? t.colors.sky["700"] : t.colors.bloom["700"]

  const inner = (
    <>
      {verified ? (
        <VerifiedBadge size="md" />
      ) : (
        <Icon icon={iconMap.Info} size={16} color={t.colors.textSubtle} />
      )}
      <Text variant="body" color={textColor} style={styles.text}>
        {message}
      </Text>
      {onPress ? <Icon icon={iconMap.ChevronRight} size={16} color={textColor} /> : null}
    </>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? message}
        {...focusRingProps}
        style={(state) => [
          styles.banner,
          tone,
          webTransition,
          webCursor(false),
          webHover(state) || state.pressed ? styles.pressed : null,
          style,
        ]}
      >
        {inner}
      </Pressable>
    )
  }

  return (
    <View style={[styles.banner, tone, style]} accessibilityRole="text">
      {inner}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingVertical: t.space["2"] + 2,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  verified: {
    backgroundColor: t.colors.sky["50"],
    borderColor: t.colors.sky["100"],
  },
  unverified: {
    backgroundColor: t.colors.bgAlt,
    borderColor: t.colors.border,
  },
  pressed: {
    opacity: 0.9,
  },
  text: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
  },
}))
