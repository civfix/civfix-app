export const DEFAULT_RESEND_COOLDOWN_SEC = 30

export function parseResendAfterSec(
  raw: string | undefined,
  fallback: number = DEFAULT_RESEND_COOLDOWN_SEC,
): number {
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

export function resendDeadline(now: number, seconds: number): number {
  return now + Math.max(0, Math.floor(seconds)) * 1000
}

export function resendSecondsLeft(deadline: number, now: number): number {
  if (!Number.isFinite(deadline)) return 0
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

export function canResend(deadline: number, now: number): boolean {
  return resendSecondsLeft(deadline, now) === 0
}
