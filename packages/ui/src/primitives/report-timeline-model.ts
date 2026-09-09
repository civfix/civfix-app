import type { ReportStatus, ReportTimelineEntryDTO } from "@civfix/shared"

export const TIMELINE_VISIBILITY_KINDS = {
  hidden: "hidden",
  unhidden: "unhidden",
} as const

export type TimelineVisibilityKind =
  (typeof TIMELINE_VISIBILITY_KINDS)[keyof typeof TIMELINE_VISIBILITY_KINDS]

export function visibilityKindOf(kind: string | null | undefined): TimelineVisibilityKind | null {
  if (kind === TIMELINE_VISIBILITY_KINDS.hidden) return TIMELINE_VISIBILITY_KINDS.hidden
  if (kind === TIMELINE_VISIBILITY_KINDS.unhidden) return TIMELINE_VISIBILITY_KINDS.unhidden
  return null
}

export type TimelineEntryRender =
  | TimelineVisibilityKind
  | "skip"
  | "reply"
  | "reopened"
  | "note"
  | "status"

export function timelineEntryRender(
  entry: Pick<ReportTimelineEntryDTO, "status" | "kind" | "note" | "body">,
  index: number,
  prevStatus: ReportStatus | null,
): TimelineEntryRender {
  const visibility = visibilityKindOf(entry.kind)
  if (visibility !== null) return visibility
  if (
    index === 0 &&
    (entry.status === "submitted" || entry.status === "held" || entry.status === "published")
  ) {
    return "skip"
  }
  if (entry.kind === "reply" && entry.body) return "reply"
  if (entry.status === "published" && (prevStatus === "resolved" || prevStatus === "rejected")) {
    return "reopened"
  }
  if (entry.status === prevStatus) return entry.note ? "note" : "skip"
  return "status"
}
