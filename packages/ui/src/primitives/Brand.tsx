/**
 * No header role: the wordmark always sits inside the home button's pill, and rn-web would render the role
 * as an extra `<h1>` above each surface's real heading (see `theme/webAffordances.headingLevel`).
 */
import { View, Text, StyleSheet } from "react-native"
import { fontFamily, wordmarkColors } from "../theme"

// Keyed by slot, not letter: the two "i" glyphs repeat but take different colors.
const GLYPHS = [
  { slot: "c", char: "c" },
  { slot: "i1", char: "i" },
  { slot: "v", char: "v" },
  { slot: "f", char: "f" },
  { slot: "i2", char: "i" },
  { slot: "x", char: "x" },
] as const

export interface BrandProps {
  size?: number
}

export function Brand({ size = 40 }: BrandProps) {
  const letterSpacing = -size * 0.04
  return (
    <View style={styles.row} accessibilityLabel="civfix">
      {GLYPHS.map((glyph, i) => (
        <Text
          key={glyph.slot}
          style={[styles.letter, { color: wordmarkColors[i], fontSize: size, letterSpacing }]}
        >
          {glyph.char}
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
