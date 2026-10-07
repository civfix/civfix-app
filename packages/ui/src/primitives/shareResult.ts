/** Pure half of the share helper, free of `react-native` so it runs under plain Node vitest. */

/** Only "copied" gets feedback; "cancelled" is the user's own choice and stays silent. */
export type ShareResult = "shared" | "copied" | "cancelled" | "unavailable"

/**
 * An AbortError means the user dismissed the sheet, so it must not fall through to the clipboard fallback
 * and overwrite the clipboard with a link they declined to share.
 */
export function classifyWebShareRejection(err: unknown): "cancelled" | "failed" {
  const name = (err as { name?: unknown } | null | undefined)?.name
  return name === "AbortError" ? "cancelled" : "failed"
}

/** iOS resolves, not rejects, with `dismissedAction` on close; Android always reports `sharedAction`. */
export function nativeShareResult(action: string, dismissedAction: string): "shared" | "cancelled" {
  return action === dismissedAction ? "cancelled" : "shared"
}
