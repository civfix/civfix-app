import type { LinkedEventRef, PersonDTO, PostDTO, ReportDTO, UserMentionDTO } from "@civfix/shared"
import type { PostComposerMedia } from "../postComposerStore"
import { buildOptimisticPost } from "../postComposerSubmit"

/** Mirrors the server's own projection (`r.title ?? "Report"`), so the optimistic card never snaps. */
export const REPORT_TITLE_FALLBACK = "Report"

export interface OptimisticReplyInput {
  author: PersonDTO
  body: string | null
  readyMedia: readonly PostComposerMedia[]
  mentions: UserMentionDTO[]
  attachedEvent: LinkedEventRef | null
  attachedReport: ReportDTO | null
  attachedReportId: string | null
  focalPost: Pick<PostDTO, "id" | "threadRootId">
  now: Date
}

export function buildOptimisticReply({
  author,
  body,
  readyMedia,
  mentions,
  attachedEvent,
  attachedReport,
  attachedReportId,
  focalPost,
  now,
}: OptimisticReplyInput): PostDTO {
  const stamp = now.toISOString()
  return buildOptimisticPost({
    author,
    kind: "reply",
    body,
    now,
    media: readyMedia,
    mentions,
    event: attachedEvent ? { ...attachedEvent, linkedAt: stamp } : null,
    // Built from the picked ROW, exactly as `event` is built from the draft's event. A null here would render
    // an attachment-only reply as an essentially EMPTY row for the length of the request, then pop its card
    // in (shifting the list) when the server DTO replaced it. The report is fetched BY `attachedReportId`, so
    // the id check only covers the one render right after a re-aim where the new id's data has not landed.
    report:
      attachedReport && attachedReport.id === attachedReportId
        ? {
            id: attachedReport.id,
            category: attachedReport.category,
            ...(attachedReport.type ? { type: attachedReport.type } : {}),
            title: attachedReport.title?.trim() || REPORT_TITLE_FALLBACK,
            status: attachedReport.status,
            lat: attachedReport.lat,
            lng: attachedReport.lng,
            addr: attachedReport.addr ?? null,
            thumbUrl: null,
            linkedAt: stamp,
          }
        : null,
    replyToId: focalPost.id,
    // The server derives `parent.thread_root_id ?? parent.id`. Setting BOTH to the parent id is only
    // correct at depth 1, and drilling into a reply makes depth 2 real.
    threadRootId: focalPost.threadRootId ?? focalPost.id,
  })
}
