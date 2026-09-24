import type { CleanupDTO } from "@civfix/shared"
import type { HostStage } from "@civfix/shared/host"
import type { UseRelativeTime } from "../../i18n"
import type { HostRowKey } from "./hostSurfaceModel"
import { relativeUntil } from "./hostTime"

type Translate = (key: string, options?: Record<string, unknown>) => string

export interface HostRowCounts {
  stillToCheckIn: number
  unmarked: number
  checkedInSeats: number
  linkedReportCount: number
}

export function hostRowSub(
  row: HostRowKey,
  event: CleanupDTO,
  counts: HostRowCounts,
  t: Translate,
): string | undefined {
  switch (row) {
    case "share":
      return event.pageSlug ?? event.referenceCode ?? undefined
    case "chat":
      return t("row.chat_sub")
    case "announce":
      return t("row.announce_sub")
    case "check_in":
    case "scan":
      return counts.stillToCheckIn > 0
        ? t("row.check_in_sub", { count: counts.stillToCheckIn })
        : undefined
    case "mark_no_shows":
      return t("row.mark_no_shows_sub", { count: counts.unmarked })
    case "log_hours":
      return counts.checkedInSeats > 0
        ? t("row.log_hours_sub", { count: counts.checkedInSeats })
        : t("row.log_hours_none")
    case "resources":
      return event.jurisdictionGeoid == null ? t("row.resources_no_city") : undefined
    case "linked_reports":
      return counts.linkedReportCount > 0
        ? t("row.linked_reports_sub")
        : t("row.linked_reports_none")
    default:
      return undefined
  }
}

export function hostRowValue(
  row: HostRowKey,
  event: CleanupDTO,
  counts: HostRowCounts,
): string | undefined {
  if (row === "team" && event.teamCount != null) return String(event.teamCount)
  if (row === "linked_reports" && counts.linkedReportCount > 0) {
    return String(counts.linkedReportCount)
  }
  return undefined
}

export interface HostRelativeInput {
  stage: HostStage
  now: number
  startsAt: number
  endsAt: number | null
  scheduledAt: string
}

export function hostRelativeLine(
  input: HostRelativeInput,
  t: Translate,
  relative: UseRelativeTime["relative"],
): string {
  const { stage, now } = input
  if (stage === "cancelled") return t("phase.called_off")
  if (stage === "past" || stage === "wrapping_up") {
    return t("phase.ended_on", { when: relative(input.endsAt ?? input.scheduledAt, now) })
  }
  if (stage === "underway") return t("phase.started", { when: relative(input.scheduledAt, now) })
  return t("phase.starts", { when: relativeUntil(relative, input.startsAt, now) })
}
