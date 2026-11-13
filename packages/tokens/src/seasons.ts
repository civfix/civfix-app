import { colorSchemes, type ColorSchemeName } from "./design-tokens.js"

export type SeasonName = "none" | "christmas"

/**
 * The one switch for a holiday look on web and in the phone app. "none" is the everyday look, unchanged.
 * Web reads it at build time and the phone app at bundle time, so a change ships with the next web deploy
 * and the next app release.
 */
export const ACTIVE_SEASON: SeasonName = "christmas"

export interface SeasonLook {
  /** The six wordmark letters, c-i-v-f-i-x, per scheme. */
  wordmark: Readonly<Record<ColorSchemeName, readonly string[]>>
  /** A Santa hat on the wordmark's "c": its felt, its fur trim and the trim's outline (the fur would vanish on a white pill), per scheme. */
  hat: Readonly<Record<ColorSchemeName, { felt: string; trim: string; edge: string }>> | null
}

const light = colorSchemes.light
const dark = colorSchemes.dark

// Holiday letters reuse the palette's own reds, golds and greens, each at least as legible on paper as
// the everyday letter it replaces.
const SEASONS: Readonly<Record<Exclude<SeasonName, "none">, SeasonLook>> = {
  christmas: {
    wordmark: {
      light: [
        light.bloom["700"],
        light.sun["600"],
        light.moss["700"],
        light.bloom["700"],
        light.sun["600"],
        light.moss["700"],
      ],
      dark: [
        dark.bloom["500"],
        dark.sun["600"],
        dark.moss["600"],
        dark.bloom["500"],
        dark.sun["600"],
        dark.moss["600"],
      ],
    },
    hat: {
      light: { felt: light.bloom["700"], trim: light.neutral.card, edge: light.neutral.ink4 },
      dark: { felt: dark.bloom["500"], trim: dark.neutral.ink, edge: dark.neutral.ink },
    },
  },
}

/** The active season's look, or null on an everyday build. */
export const seasonLook: SeasonLook | null =
  (ACTIVE_SEASON as SeasonName) === "none"
    ? null
    : SEASONS[ACTIVE_SEASON as Exclude<SeasonName, "none">]
