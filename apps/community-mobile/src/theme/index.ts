import { themeFor } from "@civfix/ui/theme"

export * from "@civfix/ui/theme"

// Shared by <Wordmark> and the animated <LoadingSplash> so the two stay in lock-step.
export const WORDMARK_LETTERS = ["c", "i", "v", "f", "i", "x"] as const

// Camera chrome sits over the live feed, so it keeps the light palette whatever the app scheme is.
export const CAMERA_CHROME_THEME = themeFor("light")
