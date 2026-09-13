import React, { useCallback, useMemo, useState } from "react"
import { View, Image, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from "react-native"
import { avatarColor, monogram } from "@civfix/shared"
import { makeThemedStyles, fontFamily, useTheme } from "../theme"
import { Text } from "../typography"

export function Avatar({
  name,
  photoUrl,
  seed,
  gradient,
  size = 36,
  style,
  accessibilityLabel,
  decorative,
}: {
  name: string
  photoUrl?: string | null
  seed?: string
  gradient?: readonly [string, string] | null
  size?: number
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  decorative?: boolean
}) {
  const styles = useStyles()
  const t = useTheme()
  const radius = size / 2
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showPhoto = !!photoUrl && failedUrl !== photoUrl
  const color = gradient?.[0] ?? avatarColor(seed ?? name)
  const monogramStyle = useMemo<TextStyle>(
    () => ({ fontFamily: fontFamily.displaySemiBold, fontSize: size * 0.42 }),
    [size],
  )
  const onPhotoError = useCallback(() => setFailedUrl(photoUrl ?? null), [photoUrl])
  const photoSource = useMemo(() => ({ uri: photoUrl as string }), [photoUrl])
  return (
    <View
      accessibilityLabel={!decorative && accessibilityLabel ? accessibilityLabel : undefined}
      accessibilityRole={!decorative && accessibilityLabel ? "image" : undefined}
      {...(decorative ? { "aria-hidden": true, importantForAccessibility: "no" as const } : {})}
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: color,
        },
        style,
      ]}
    >
      <Text
        color={t.colors.onAccent}
        style={monogramStyle}
        aria-hidden
        importantForAccessibility="no"
      >
        {monogram(name)}
      </Text>
      {showPhoto ? (
        <Image
          source={photoSource}
          accessibilityIgnoresInvertColors
          onError={onPhotoError}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: t.colors.neutral.card,
  },
}))
