// The civfix theme now lives in @civfix/ui (single source of truth). This file re-exports it so the
// many existing "@/theme" importers keep working unchanged.
export * from "@civfix/ui/theme"

/**
 * The "civfix" wordmark letters, in render order (each painted with the matching `wordmarkColors[i]`).
 * Shared by <Wordmark> and the animated <LoadingSplash> so the two stay in lock-step.
 */
export const WORDMARK_LETTERS = ["c", "i", "v", "f", "i", "x"] as const
