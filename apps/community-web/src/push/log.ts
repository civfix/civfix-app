import { isAppErrorLike } from "@civfix/contract"

/**
 * Push runs in the background with nobody to show an error to; the page goes on without it. Only the
 * error's code or name is logged: a subscription's endpoint is a capability URL.
 */
export function warnPush(step: string, err: unknown): void {
  const reason = isAppErrorLike(err) ? err.code : err instanceof Error ? err.name : typeof err
  console.warn(`[push] ${step} failed`, reason)
}
