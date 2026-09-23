/**
 * The "civfix" wordmark: each letter painted in a brand color (c=bloom, i=sun-600, v=moss, f=sky,
 * i=lilac, x=bloom), set in Baloo 2 800 (the design's rounder/heavier display face, matching the
 * handoff `.cf-logo`). Lowercase, very tight letter-spacing. Used inside the glass logo pill on the
 * map (-> About), the About card header, and the splash. `size` is the cap height in px (design uses
 * 23 for the pill, 44 for the About header, 84 for the splash).
 */
import React from "react"
import { View, StyleSheet } from "react-native"
import { fontFamily, wordmarkColors, WORDMARK_LETTERS } from "@/theme"
import { Text } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"

export function Wordmark({ size = 23 }: { size?: number }) {
  const { t } = useT("mobile-branding")
  // Baloo 2 is a tall, rounded face; tracking scales with size (design uses -0.05em).
  const letterSpacing = -size * 0.05
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel={t("a11y.brand_logo")}
    >
      {WORDMARK_LETTERS.map((letter, i) => (
        <Text
          key={`${letter}-${i}`}
          color={wordmarkColors[i]}
          style={[styles.letter, { fontSize: size, letterSpacing }]}
        >
          {letter}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  letter: {
    fontFamily: fontFamily.brand,
  },
})
