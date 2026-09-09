import type { BroadcastSegment } from "@civfix/shared"

export const QUICK_SEGMENT_KINDS = [
  "all_registered",
  "checked_in",
  "not_checked_in",
  "waitlist",
] as const

export type QuickSegmentKind = (typeof QUICK_SEGMENT_KINDS)[number]

export function quickSegment(kind: QuickSegmentKind): BroadcastSegment {
  return { kind }
}

export function broadcastErrorKey(code: string | undefined): string {
  if (code === "RATE_LIMITED") return "error.rate_limited"
  if (code === "FORBIDDEN") return "error.forbidden"
  if (code === "CONFLICT") return "error.conflict"
  if (code === "VALIDATION") return "error.validation"
  if (code === "ABUSE_HELD") return "error.held"
  return "error.generic"
}

export function quickBroadcastReady(subject: string, body: string): boolean {
  return subject.trim().length > 0 && body.trim().length > 0
}
