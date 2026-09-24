/**
 * The pure half of the share helper: the result enum + the "did the user cancel or did it fail?" rule.
 *
 * Kept in its own module (no `react-native` import) so it is unit-testable under plain Node vitest, the
 * way every other model in this folder is. `share.ts` owns the platform branches and re-exports these.
 */

/**
 * What `shareLink` did: opened the OS/browser share sheet, copied the link, was dismissed by the user, or
 * could do none of those. Callers surface "Link copied" feedback on "copied" ONLY - "cancelled" is the
 * user's own no-op and must stay silent.
 */
export type ShareResult = "shared" | "copied" | "cancelled" | "unavailable"

/**
 * Classify a rejected `navigator.share`. The Web Share API rejects with a DOMException named
 * "AbortError" when the user dismisses the sheet (and, in some engines, when a second share is requested
 * while one is open) - that is a deliberate cancel, not a failure, so it must NOT fall through to the
 * clipboard copy and silently clobber the clipboard with a link the user just declined to share.
 * Everything else (NotAllowedError, DataError, a plain Error) is a genuine failure the clipboard fallback
 * should still rescue.
 */
export function classifyWebShareRejection(err: unknown): "cancelled" | "failed" {
  const name = (err as { name?: unknown } | null | undefined)?.name
  return name === "AbortError" ? "cancelled" : "failed"
}

/**
 * Classify a resolved native `Share.share`. iOS RESOLVES (does not reject) with `dismissedAction` when
 * the user closes the sheet, which is a cancel, not a share. Android always reports `sharedAction`.
 */
export function nativeShareResult(action: string, dismissedAction: string): "shared" | "cancelled" {
  return action === dismissedAction ? "cancelled" : "shared"
}
