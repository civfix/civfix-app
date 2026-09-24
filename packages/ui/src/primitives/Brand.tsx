/**
 * No header role: the wordmark always sits inside the home button's pill, and rn-web would render the role
 * as an extra `<h1>` above each surface's real heading (see `theme/webAffordances.headingLevel`).
 */
import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { fontFamily, wordmarkColors } from "../theme"

// Keyed by index, not letter: the two "i" glyphs repeat but take different colors.
const CHARS = ["c", "i", "v", "f", "i", "x"] as const

export interface BrandProps {
  size?: number
}

export function Brand({ size = 40 }: BrandProps) {
  const letterSpacing = -size * 0.04
  return (
    <View style={styles.row} accessibilityLabel="civfix">
      {CHARS.map((char, i) => (
        <Text
          key={`${char}-${i}`}
          style={[styles.letter, { color: wordmarkColors[i], fontSize: size, letterSpacing }]}
        >
          {char}
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
    fontWeight: "800",
  },
})
