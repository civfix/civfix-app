import { colorSchemes, type ColorSchemeName } from "@civfix/tokens"

export type SeasonName = "none" | "christmas"

/**
 * The one switch for a holiday look on web and in the phone app; "none" is the everyday look. Web reads it
 * at build time and the app at bundle time, so a flip ships with the next web deploy and the next app release.
 */
export const ACTIVE_SEASON: SeasonName = "christmas"

export interface SeasonLook {
  /** The six wordmark letters, c-i-v-f-i-x. */
  wordmark: Readonly<Record<ColorSchemeName, readonly string[]>>
  /** Holly along the top of the navigation pill. */
  garland: Readonly<Record<ColorSchemeName, { leaf: string; berry: string; cord: string }>> | null
  /** A hat on the wordmark's "c"; the edge outlines the trim, which would vanish on a white pill. */
  hat: Readonly<Record<ColorSchemeName, { felt: string; trim: string; edge: string }>> | null
}

const L = colorSchemes.light
const D = colorSchemes.dark

// Roles mapped onto existing palette values only, so a season never brings a color the tokens lack.
const LOOKS: Readonly<Record<Exclude<SeasonName, "none">, SeasonLook>> = {
  christmas: {
    wordmark: {
      light: [
        L.bloom["700"],
        L.sun["600"],
        L.moss["700"],
        L.bloom["700"],
        L.sun["600"],
        L.moss["700"],
      ],
      dark: [
        D.bloom["500"],
        D.sun["600"],
        D.moss["600"],
        D.bloom["500"],
        D.sun["600"],
        D.moss["600"],
      ],
    },
    garland: {
      light: { leaf: L.moss["700"], berry: L.bloom["700"], cord: L.moss["600"] },
      dark: { leaf: D.moss["500"], berry: D.bloom["500"], cord: D.moss["300"] },
    },
    hat: {
      light: { felt: L.bloom["700"], trim: L.neutral.card, edge: L.neutral.ink4 },
      dark: { felt: D.bloom["500"], trim: D.neutral.ink, edge: D.neutral.ink },
    },
  },
}

export function seasonLook(season: SeasonName): SeasonLook | null {
  return season === "none" ? null : LOOKS[season]
}
