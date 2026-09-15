import type { ReportStatus } from "@civfix/shared"
import { hasEventEnded, type EventWindowLike } from "@civfix/shared/host"

export const ATTACHABLE_REPORT_STATUSES = [
  "submitted",
  "published",
  "acknowledged",
  "in_progress",
] as const satisfies readonly ReportStatus[]

const ATTACHABLE_REPORT_STATUS_SET: ReadonlySet<ReportStatus> = new Set(ATTACHABLE_REPORT_STATUSES)

export function isAttachableReport(report: { status: ReportStatus }): boolean {
  return ATTACHABLE_REPORT_STATUS_SET.has(report.status)
}

export function isAttachableEvent(event: EventWindowLike, now: number): boolean {
  return event.status !== "cancelled" && !hasEventEnded(event, now)
}

export function attachableReports<T extends { status: ReportStatus }>(reports: readonly T[]): T[] {
  return reports.filter(isAttachableReport)
}

export function attachableEvents<T extends EventWindowLike>(events: readonly T[], now: number): T[] {
  return events.filter((event) => isAttachableEvent(event, now))
}
