import type { CleanupStatus, ReportStatus } from "@civfix/shared"

export const ATTACHABLE_REPORT_STATUSES = [
  "submitted",
  "published",
  "acknowledged",
  "in_progress",
] as const satisfies readonly ReportStatus[]

export const ATTACHABLE_EVENT_STATUSES = ["upcoming", "active"] as const satisfies readonly CleanupStatus[]

const ATTACHABLE_REPORT_STATUS_SET: ReadonlySet<ReportStatus> = new Set(ATTACHABLE_REPORT_STATUSES)
const ATTACHABLE_EVENT_STATUS_SET: ReadonlySet<CleanupStatus> = new Set(ATTACHABLE_EVENT_STATUSES)

export function isAttachableReport(report: { status: ReportStatus }): boolean {
  return ATTACHABLE_REPORT_STATUS_SET.has(report.status)
}

export function isAttachableEvent(event: { status: CleanupStatus }): boolean {
  return ATTACHABLE_EVENT_STATUS_SET.has(event.status)
}

export function attachableReports<T extends { status: ReportStatus }>(reports: readonly T[]): T[] {
  return reports.filter(isAttachableReport)
}

export function attachableEvents<T extends { status: CleanupStatus }>(events: readonly T[]): T[] {
  return events.filter(isAttachableEvent)
}
