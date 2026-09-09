/**
 * Brand - the "civfix" wordmark, the FIRST real shared @civfix/ui primitive (Stage 1 walking
 * skeleton). It renders the six letters of "civfix" each in its own brand color, authored in
 * React-Native primitives (View / Text / StyleSheet) so the SAME .tsx renders on mobile (Metro /
 * native) and on web (react-native-web). It proves the RNW pipeline end to end.
 *
 * Colors come from the @civfix/ui theme's `wordmarkColors` (the single source of truth, itself
 * derived from @civfix/shared/tokens), NOT from any mobile theme nor an inline token list here:
 *   c = brand.bloom, i = sun.600, v = brand.moss, f = brand.sky, i = brand.lilac, x = brand.bloom.
 * The glyphs render in the brand wordmark face (`theme.fontFamily.brand` = "Baloo2_800ExtraBold",
 * the @expo-google-fonts / self-hosted-web contract name) with tight letter spacing; `fontWeight 800`
 * stays as a graceful fallback for any platform/timing where the face has not yet loaded.
 *
 * a11y: the wrapping View carries accessibilityLabel="civfix" so the wordmark announces as one word
 * rather than as six letters, and NOTHING ELSE. It used to carry accessibilityRole="header" as well - a
 * Stage-1 seed from before there was a shell around it - and react-native-web turns that into a real
 * `<h1>`. Every surface renders the wordmark inside `MapControls`' brand pill, so on EVERY route in the
 * app a decorative 16px wordmark announced as the page's FIRST heading, one level above the 32pt tab-root
 * title beneath it. It is a BUTTON (the pill it lives in owns `accessibilityRole="button"` and the
 * "civfix, home" label), so the role was not merely mis-levelled, it was the wrong role. Dropping it
 * leaves exactly one level-1 heading per surface; see `theme/webAffordances.headingLevel`.
 */
import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { theme, wordmarkColors } from "../theme"

// The six glyphs of the wordmark, colored by the matching index of theme.wordmarkColors. The two
// "i"/"x" letters intentionally repeat the glyph but differ in color, so we key on index, not letter.
const CHARS = ["c", "i", "v", "f", "i", "x"] as const

export interface BrandProps {
  /** Cap height / fontSize of the wordmark in px. Defaults to 40. */
  size?: number
}

export function Brand({ size = 40 }: BrandProps) {
  // Tracking scales with size so the tight wordmark spacing reads the same at any size.
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
    fontFamily: theme.fontFamily.brand,
    fontWeight: "800",
  },
})
