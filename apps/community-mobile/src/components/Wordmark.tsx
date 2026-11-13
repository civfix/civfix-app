import { View, StyleSheet } from "react-native"
import { fontFamily, useColorSchemeName, wordmarkColorsFor, WORDMARK_GLYPHS } from "@/theme"
import { SeasonHat, Text } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"

export function Wordmark({ size = 23 }: { size?: number }) {
  const { t } = useT("mobile-branding")
  const scheme = useColorSchemeName()
  const colors = wordmarkColorsFor(scheme)
  const letterSpacing = -size * 0.05
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel={t("a11y.brand_logo")}
    >
      {WORDMARK_GLYPHS.map((glyph, i) => (
        <Text
          key={glyph.slot}
          color={colors[i]}
          style={[styles.letter, { fontSize: size, letterSpacing }]}
        >
          {glyph.char}
        </Text>
      ))}
      <SeasonHat size={size} scheme={scheme} />
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
