import React from "react"
import { View, StyleSheet } from "react-native"
import { fontFamily, wordmarkColors, WORDMARK_LETTERS } from "@/theme"
import { Text } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"

export function Wordmark({ size = 23 }: { size?: number }) {
  const { t } = useT("mobile-branding")
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
