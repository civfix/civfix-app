import type { ColorSchemeName } from "@civfix/tokens"

export type SeasonName = "none" | "christmas"

export const ACTIVE_SEASON: SeasonName = "none"

export interface SeasonLook {
  wordmark: Readonly<Record<ColorSchemeName, readonly string[]>>
  garland: Readonly<Record<ColorSchemeName, { leaf: string; berry: string; cord: string }>> | null
  hat: Readonly<Record<ColorSchemeName, { felt: string; trim: string; edge: string }>> | null
}

export function seasonLook(_season: SeasonName): SeasonLook | null {
  throw new Error("not implemented")
}
