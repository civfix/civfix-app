import { themeFor } from "@civfix/ui/theme"

export * from "@civfix/ui/theme"

// Shared by <Wordmark> and the animated <LoadingSplash> so the two stay in lock-step.
// Keyed by slot, not letter: the two "i" glyphs repeat but take different colors.
export const WORDMARK_GLYPHS = [
  { slot: "c", char: "c" },
  { slot: "i1", char: "i" },
  { slot: "v", char: "v" },
  { slot: "f", char: "f" },
  { slot: "i2", char: "i" },
  { slot: "x", char: "x" },
] as const

// Camera chrome sits over the live feed, so it keeps the light palette whatever the app scheme is.
export const CAMERA_CHROME_THEME = themeFor("light")
